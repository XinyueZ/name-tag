import type { BoundingBox, RecognizedDetection } from '../../invariant'
import { CameraScopeItem } from './CameraScopeModels'
import { CutoutAugmenter } from './CutoutAugmenter'
import { FastSamInferenceEngine } from './FastSamInferenceEngine'

export interface SemanticScopePrototype {
  readonly scopeKey: string
  readonly positiveTextCentroid: readonly number[]
  readonly negativeTextVectors: readonly (readonly number[])[]
  readonly visualCentroid: readonly number[] | null
}

export interface DueScopeTrack {
  readonly trackId: number
  readonly queryCutoutUrl: string
  readonly rawPocketUrl: string
  readonly box: BoundingBox
}

interface ScopeTrackState {
  readonly trackId: number
  lastBox: BoundingBox
  lastSeenMs: number
  seenFrames: number
  bestQuality: number
  bestQueryCutoutUrl: string | null
  bestRawPocketUrl: string | null
  lastScoredMs: number
  lastScopeScore: number | null
  lastVector: readonly number[] | null
  recognizedTargetId: string | null
  recognizedTitle: string | null
  recognizedAt: number
}

/**
 * SemanticScopeFilter: Real-time embedding-based semantic filtering layer positioned
 * directly above GranularityFilter. Reuses EmbeddingGemma 2's shared 768-d Vision+Text
 * space with contrastive positive/negative prompt scoring + optional few-shot visual
 * prototype fusion from the browser vector DB. Supports multi-instance tracking at full
 * FastSAM-s FPS and reuses the exact same 768-d image vector for downstream Pocket search.
 */
export class SemanticScopeFilter {
  public static readonly NEGATIVE_PROMPTS = [
    'background wall floor ceiling',
    'an empty desk table or room surface',
    'an unrelated everyday object',
    'blurry edge shadow or noise',
  ] as const
  public static readonly SOFTMAX_TEMPERATURE = 0.05
  public static readonly STABLE_FRAMES = 2
  public static readonly REQUERY_MS = 2000
  public static readonly TRACK_EXPIRE_MS = 1800
  public static readonly MATCH_IOU_THRESHOLD = 0.25
  public static readonly MAX_QUERIES_PER_TICK = 4

  private activeScopeKey: string | null = null
  private prototype: SemanticScopePrototype | null = null
  private nextTrackId = 1
  private readonly tracks = new Map<number, ScopeTrackState>()
  private lastBoxToTrack = new Map<string, number>()

  public static buildPositivePrompts(scopeId: string, scopeText: string): readonly string[] {
    if (scopeId === CameraScopeItem.HUMAN_FACE_ID) {
      return [
        'a photo of a human face',
        'a close-up portrait of a person face',
        'human face',
      ]
    }
    const trimmed = scopeText.trim()
    if (trimmed.length === 0) return ['a photo of an object']
    return [
      'a photo of ' + trimmed,
      'a close-up of ' + trimmed,
      trimmed,
    ]
  }

  public static dotProduct(a: readonly number[], b: readonly number[]): number {
    const len = Math.min(a.length, b.length)
    let sum = 0
    for (let i = 0; i < len; i += 1) {
      sum += a[i] * b[i]
    }
    return sum
  }

  public static computeCentroid(vectors: readonly (readonly number[])[]): number[] | null {
    if (vectors.length === 0) return null
    const dim = vectors[0].length
    if (dim === 0) return null
    const sum = new Float64Array(dim)
    let count = 0
    for (let i = 0; i < vectors.length; i += 1) {
      const v = vectors[i]
      if (v.length !== dim) continue
      for (let d = 0; d < dim; d += 1) sum[d] += v[d]
      count += 1
    }
    if (count === 0) return null
    let normSq = 0
    for (let d = 0; d < dim; d += 1) normSq += sum[d] * sum[d]
    const norm = Math.sqrt(normSq)
    const out = new Array<number>(dim)
    if (norm > 1e-12) {
      for (let d = 0; d < dim; d += 1) out[d] = sum[d] / norm
    } else {
      for (let d = 0; d < dim; d += 1) out[d] = 0
    }
    return out
  }

  public static scoreEmbedding(
    imgVec: readonly number[],
    prototype: SemanticScopePrototype,
  ): number {
    if (imgVec.length === 0 || prototype.positiveTextCentroid.length === 0) return 0
    const posSim = SemanticScopeFilter.dotProduct(imgVec, prototype.positiveTextCentroid)
    let maxNegSim = -1
    for (let i = 0; i < prototype.negativeTextVectors.length; i += 1) {
      const s = SemanticScopeFilter.dotProduct(imgVec, prototype.negativeTextVectors[i])
      if (s > maxNegSim) maxNegSim = s
    }
    const textProb =
      prototype.negativeTextVectors.length > 0
        ? 1 / (1 + Math.exp((maxNegSim - posSim) / SemanticScopeFilter.SOFTMAX_TEMPERATURE))
        : Math.max(0, Math.min(1, posSim))

    if (prototype.visualCentroid !== null && prototype.visualCentroid.length > 0) {
      const visSim = Math.max(0, Math.min(1, SemanticScopeFilter.dotProduct(imgVec, prototype.visualCentroid)))
      return Math.max(textProb, visSim)
    }
    return textProb
  }

  private static computeSalience(box: BoundingBox, frameW: number, frameH: number): number {
    const cx = (box.x1 + box.x2) * 0.5
    const cy = (box.y1 + box.y2) * 0.5
    const dx = (cx - frameW * 0.5) / Math.max(1, frameW * 0.5)
    const dy = (cy - frameH * 0.5) / Math.max(1, frameH * 0.5)
    const centerWeight = Math.max(0.15, 1 - Math.sqrt(dx * dx + dy * dy) * 0.65)
    const areaRatio = Math.min(1, box.area / Math.max(1, frameW * frameH))
    return Math.sqrt(areaRatio) * centerWeight * Math.max(0.1, box.score)
  }

  public reset(nextScopeKey: string | null = null): void {
    this.activeScopeKey = nextScopeKey
    this.prototype = null
    this.tracks.clear()
    this.lastBoxToTrack.clear()
  }

  public getActiveScopeKey(): string | null {
    return this.activeScopeKey
  }

  public setPrototype(proto: SemanticScopePrototype | null): void {
    if (proto !== null && proto.scopeKey !== this.activeScopeKey) return
    this.prototype = proto
    if (proto !== null) {
      // Immediately re-score any already-embedded tracks with the updated prototype
      for (const track of this.tracks.values()) {
        if (track.lastVector !== null) {
          track.lastScopeScore = SemanticScopeFilter.scoreEmbedding(track.lastVector, proto)
        }
      }
    }
  }

  public getPrototype(): SemanticScopePrototype | null {
    return this.prototype
  }

  public updateFrame(
    frameCanvas: HTMLCanvasElement | null,
    liveBoxes: readonly BoundingBox[],
    frameW: number,
    frameH: number,
    nowMs: number,
    qualityFn?: (box: BoundingBox) => number,
    cropFn?: (box: BoundingBox) => { readonly queryCutoutUrl: string; readonly rawPocketUrl: string },
  ): void {
    const nextMap = new Map<string, number>()
    const claimedTracks = new Set<number>()

    const ordered = liveBoxes
      .slice()
      .sort((a, b) => SemanticScopeFilter.computeSalience(b, frameW, frameH) - SemanticScopeFilter.computeSalience(a, frameW, frameH))

    for (let i = 0; i < ordered.length; i += 1) {
      const box = ordered[i]
      let bestTrack: ScopeTrackState | null = null
      let bestIoU = 0
      for (const track of this.tracks.values()) {
        if (claimedTracks.has(track.trackId)) continue
        const iou = FastSamInferenceEngine.computeIoU(track.lastBox, box)
        if (iou > bestIoU) {
          bestIoU = iou
          bestTrack = track
        }
      }

      let targetTrack: ScopeTrackState
      if (bestTrack !== null && bestIoU >= SemanticScopeFilter.MATCH_IOU_THRESHOLD) {
        bestTrack.lastBox = box
        bestTrack.lastSeenMs = nowMs
        bestTrack.seenFrames += 1
        targetTrack = bestTrack
      } else {
        const trackId = this.nextTrackId++
        targetTrack = {
          trackId,
          lastBox: box,
          lastSeenMs: nowMs,
          seenFrames: 1,
          bestQuality: -1,
          bestQueryCutoutUrl: null,
          bestRawPocketUrl: null,
          lastScoredMs: 0,
          lastScopeScore: null,
          lastVector: null,
          recognizedTargetId: null,
          recognizedTitle: null,
          recognizedAt: 0,
        }
        this.tracks.set(trackId, targetTrack)
      }

      claimedTracks.add(targetTrack.trackId)
      nextMap.set(box.id, targetTrack.trackId)

      if (qualityFn && cropFn) {
        const q = qualityFn(box)
        if (q > targetTrack.bestQuality || targetTrack.bestQueryCutoutUrl === null) {
          const crops = cropFn(box)
          targetTrack.bestQuality = q
          targetTrack.bestQueryCutoutUrl = crops.queryCutoutUrl
          targetTrack.bestRawPocketUrl = crops.rawPocketUrl
        }
      } else if (frameCanvas !== null) {
        const q = CutoutAugmenter.computeCropQuality(frameCanvas, box)
        if (q > targetTrack.bestQuality || targetTrack.bestQueryCutoutUrl === null) {
          const cutout = CutoutAugmenter.extractTransparentCutout(frameCanvas, box)
          const rawPocket = CutoutAugmenter.extractRawBboxCrop(frameCanvas, box)
          targetTrack.bestQuality = q
          targetTrack.bestQueryCutoutUrl = cutout.toDataURL('image/png')
          targetTrack.bestRawPocketUrl = rawPocket.toDataURL('image/png')
        }
      }
    }

    this.lastBoxToTrack = nextMap

    for (const [id, track] of this.tracks.entries()) {
      if (nowMs - track.lastSeenMs > SemanticScopeFilter.TRACK_EXPIRE_MS) {
        this.tracks.delete(id)
      }
    }
  }

  public collectDueTracks(nowMs: number): readonly DueScopeTrack[] {
    if (this.prototype === null) return []
    const due: { readonly item: DueScopeTrack; readonly priority: number }[] = []
    for (const track of this.tracks.values()) {
      if (track.seenFrames < SemanticScopeFilter.STABLE_FRAMES) continue
      if (track.bestQueryCutoutUrl === null || track.bestRawPocketUrl === null) continue
      const neverScored = track.lastScopeScore === null
      const stale = nowMs - track.lastScoredMs >= SemanticScopeFilter.REQUERY_MS
      if (!neverScored && !stale) continue
      due.push({
        item: {
          trackId: track.trackId,
          queryCutoutUrl: track.bestQueryCutoutUrl,
          rawPocketUrl: track.bestRawPocketUrl,
          box: track.lastBox,
        },
        // Prioritize never-scored tracks first so newly visible targets appear fast
        priority: neverScored ? 2 : 1,
      })
    }
    due.sort((a, b) => b.priority - a.priority || b.item.box.area - a.item.box.area)
    return due.slice(0, SemanticScopeFilter.MAX_QUERIES_PER_TICK).map((d) => d.item)
  }

  public applyEmbeddingResult(
    trackId: number,
    vector: readonly number[],
    nowMs: number,
    scopeKey: string,
  ): number | null {
    if (this.activeScopeKey !== scopeKey || this.prototype === null) return null
    const track = this.tracks.get(trackId)
    if (!track) return null
    const score = SemanticScopeFilter.scoreEmbedding(vector, this.prototype)
    track.lastVector = vector
    track.lastScopeScore = score
    track.lastScoredMs = nowMs
    // Reset buffered quality so the next 2s window captures a fresh sharpest crop
    track.bestQuality = -1
    return score
  }

  public applyPocketMatchResult(
    trackId: number,
    matched: boolean,
    targetId: string | null,
    title: string | null,
    nowMs: number,
  ): void {
    const track = this.tracks.get(trackId)
    if (!track) return
    if (matched && targetId !== null && title !== null) {
      track.recognizedTargetId = targetId
      track.recognizedTitle = title
      track.recognizedAt = nowMs
    } else {
      track.recognizedTargetId = null
      track.recognizedTitle = null
    }
  }

  public getFilteredBoxes(
    liveBoxes: readonly BoundingBox[],
    confidenceThreshold: number,
  ): readonly BoundingBox[] {
    if (liveBoxes.length === 0 || this.prototype === null) return []
    const kept: BoundingBox[] = []
    for (let i = 0; i < liveBoxes.length; i += 1) {
      const box = liveBoxes[i]
      const trackId = this.lastBoxToTrack.get(box.id)
      if (trackId === undefined) continue
      const track = this.tracks.get(trackId)
      if (!track || track.lastScopeScore === null) continue
      if (track.lastScopeScore >= confidenceThreshold) {
        kept.push(box)
      }
    }
    return kept
  }

  public getBestScore(liveBoxes: readonly BoundingBox[]): number | null {
    let best: number | null = null
    for (let i = 0; i < liveBoxes.length; i += 1) {
      const trackId = this.lastBoxToTrack.get(liveBoxes[i].id)
      if (trackId === undefined) continue
      const track = this.tracks.get(trackId)
      if (!track || track.lastScopeScore === null) continue
      if (best === null || track.lastScopeScore > best) {
        best = track.lastScopeScore
      }
    }
    return best
  }

  public getRecognizedDetections(
    liveBoxes: readonly BoundingBox[],
    confidenceThreshold: number,
  ): readonly RecognizedDetection[] {
    if (liveBoxes.length === 0 || this.prototype === null) return []
    const out: RecognizedDetection[] = []
    for (let i = 0; i < liveBoxes.length; i += 1) {
      const box = liveBoxes[i]
      const trackId = this.lastBoxToTrack.get(box.id)
      if (trackId === undefined) continue
      const track = this.tracks.get(trackId)
      if (!track || track.lastScopeScore === null || track.lastScopeScore < confidenceThreshold) continue
      if (track.recognizedTargetId !== null && track.recognizedTitle !== null) {
        out.push({
          targetId: track.recognizedTargetId,
          title: track.recognizedTitle,
          x1: box.x1,
          y1: box.y1,
          x2: box.x2,
          y2: box.y2,
          colorIndex: box.colorIndex,
          recognizedAt: track.recognizedAt,
        })
      }
    }
    return out
  }
}