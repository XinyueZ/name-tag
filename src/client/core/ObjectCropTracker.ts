import type { BoundingBox, RecognizedDetection } from '../../invariant'
import { CutoutAugmenter } from './CutoutAugmenter'
import { FastSamInferenceEngine } from './FastSamInferenceEngine'

export interface DueTrackCrop {
  readonly trackId: string
  readonly queryCutoutUrl: string
  readonly rawPocketUrl: string
  readonly box: BoundingBox
}

/**
 * SegmentTrack: OOP track state inspired by detect.py Track,
 * buffering the sharpest cutout between memory queries.
 */
export class SegmentTrack {
  public readonly id: string
  public frames = 0
  public lastSeenMs = 0
  public lastQueryMs = 0
  public box: BoundingBox
  public salience = 0
  public cropQuality = 0
  public queryCutoutUrl: string | null = null
  public rawPocketUrl: string | null = null
  public matchedTargetId: string | null = null
  public matchedTitle: string | null = null
  public matchedAtMs = 0

  public constructor(id: string, box: BoundingBox, nowMs: number) {
    this.id = id
    this.box = box
    this.lastSeenMs = nowMs
  }

  public isStable(stableFrames: number): boolean {
    return this.frames >= stableFrames
  }

  public isDueForQuery(nowMs: number, stableFrames: number, requeryMs: number): boolean {
    return (
      this.isStable(stableFrames) &&
      this.queryCutoutUrl !== null &&
      this.rawPocketUrl !== null &&
      nowMs - this.lastQueryMs >= requeryMs
    )
  }
}

/**
 * ObjectCropTracker: Multi-frame IoU tracker with stability gating, salience ranking,
 * sharpest-crop buffering, and clean disappearance handling.
 */
export class ObjectCropTracker {
  public static readonly STABLE_FRAMES = 3
  public static readonly REQUERY_MS = 2000
  public static readonly DEAD_MS = 5000
  public static readonly MATCH_IOU = 0.35
  public static readonly MAX_QUERY_TRACKS = 6

  private readonly tracks = new Map<string, SegmentTrack>()
  private nextTrackSeq = 1

  public static computeSalience(box: BoundingBox, frameW: number, frameH: number): number {
    const area = Math.max(0, ((box.x2 - box.x1) * (box.y2 - box.y1)) / Math.max(1, frameW * frameH))
    const cx = (box.x1 + box.x2) * 0.5 / Math.max(1, frameW) - 0.5
    const cy = (box.y1 + box.y2) * 0.5 / Math.max(1, frameH) - 0.5
    return Math.sqrt(area) * Math.max(0.1, 1 - Math.sqrt(cx * cx + cy * cy))
  }

  public updateFrame(
    frameCanvas: HTMLCanvasElement | null,
    liveKept: readonly BoundingBox[],
    frameW: number,
    frameH: number,
    nowMs = Date.now(),
    qualityScorer?: (inst: BoundingBox) => number,
    cropExtractor?: (inst: BoundingBox) => { queryCutoutUrl: string; rawPocketUrl: string },
  ): void {
    const matchedTrackIds = new Set<string>()

    for (let i = 0; i < liveKept.length; i += 1) {
      const inst = liveKept[i]
      let bestTrack: SegmentTrack | null = null
      let bestIoU = ObjectCropTracker.MATCH_IOU

      for (const track of this.tracks.values()) {
        if (matchedTrackIds.has(track.id)) continue
        const iou = FastSamInferenceEngine.computeIoU(track.box, inst)
        if (iou >= bestIoU) {
          bestIoU = iou
          bestTrack = track
        }
      }

      if (bestTrack === null) {
        const tid = 'trk-' + this.nextTrackSeq
        this.nextTrackSeq += 1
        bestTrack = new SegmentTrack(tid, inst, nowMs)
        this.tracks.set(tid, bestTrack)
      }

      matchedTrackIds.add(bestTrack.id)
      bestTrack.frames = Math.min(bestTrack.frames + 1, ObjectCropTracker.STABLE_FRAMES + 1)
      bestTrack.lastSeenMs = nowMs
      bestTrack.box = inst
      bestTrack.salience = ObjectCropTracker.computeSalience(inst, frameW, frameH)

      if (frameCanvas !== null || (qualityScorer && cropExtractor)) {
        const q = qualityScorer
          ? qualityScorer(inst)
          : CutoutAugmenter.computeCropQuality(frameCanvas as HTMLCanvasElement, inst)
        if (q >= bestTrack.cropQuality || bestTrack.queryCutoutUrl === null) {
          if (cropExtractor) {
            const extracted = cropExtractor(inst)
            bestTrack.queryCutoutUrl = extracted.queryCutoutUrl
            bestTrack.rawPocketUrl = extracted.rawPocketUrl
          } else if (frameCanvas !== null) {
            bestTrack.queryCutoutUrl = CutoutAugmenter.extractTransparentCutout(frameCanvas, inst).toDataURL('image/png')
            bestTrack.rawPocketUrl = CutoutAugmenter.extractRawBboxCrop(frameCanvas, inst).toDataURL('image/png')
          }
          bestTrack.cropQuality = q
        }
      }
    }

    for (const [tid, track] of this.tracks.entries()) {
      if (!matchedTrackIds.has(tid)) {
        if (nowMs - track.lastSeenMs > ObjectCropTracker.DEAD_MS) {
          this.tracks.delete(tid)
        } else {
          track.frames = Math.max(0, track.frames - 1)
        }
      }
    }
  }

  public collectDueTracks(nowMs = Date.now()): DueTrackCrop[] {
    const due: SegmentTrack[] = []
    for (const track of this.tracks.values()) {
      if (track.isDueForQuery(nowMs, ObjectCropTracker.STABLE_FRAMES, ObjectCropTracker.REQUERY_MS)) {
        due.push(track)
      }
    }
    due.sort((a, b) => b.salience - a.salience)
    const batch = due.slice(0, ObjectCropTracker.MAX_QUERY_TRACKS)
    const out: DueTrackCrop[] = []
    for (let i = 0; i < batch.length; i += 1) {
      const tr = batch[i]
      tr.lastQueryMs = nowMs
      tr.cropQuality = 0
      out.push({
        trackId: tr.id,
        queryCutoutUrl: tr.queryCutoutUrl as string,
        rawPocketUrl: tr.rawPocketUrl as string,
        box: tr.box,
      })
    }
    return out
  }

  public applyMatchResult(
    trackId: string,
    matched: boolean,
    targetId: string | null,
    title: string | null,
    nowMs = Date.now(),
  ): void {
    const track = this.tracks.get(trackId)
    if (!track) return
    if (matched && targetId !== null && title !== null) {
      track.matchedTargetId = targetId
      track.matchedTitle = title
      track.matchedAtMs = nowMs
    } else {
      track.matchedTargetId = null
      track.matchedTitle = null
    }
  }

  public getRecognizedDetections(liveKept: readonly BoundingBox[]): RecognizedDetection[] {
    if (liveKept.length === 0) return []
    const out: RecognizedDetection[] = []
    for (const track of this.tracks.values()) {
      if (track.frames > 0 && track.matchedTargetId !== null && track.matchedTitle !== null) {
        out.push({
          targetId: track.matchedTargetId,
          title: track.matchedTitle,
          x1: track.box.x1,
          y1: track.box.y1,
          x2: track.box.x2,
          y2: track.box.y2,
          colorIndex: track.box.colorIndex,
          recognizedAt: track.matchedAtMs,
        })
      }
    }
    return out
  }

  public getTrackCount(): number {
    return this.tracks.size
  }

  public reset(): void {
    this.tracks.clear()
    this.nextTrackSeq = 1
  }
}
