import type { BoundingBox, RecognizedDetection } from '../../invariant'
import { FastSamInferenceEngine } from './FastSamInferenceEngine'

export interface PocketItem {
  readonly targetId: string
  readonly title: string
  readonly dataUrl: string
  readonly capturedAt: number
}

/**
 * PocketCaptureManager: Pure static OOP helpers managing deduplicated captured items
 * and draggable floating pocket geometry.
 */
export class PocketCaptureManager {
  public static readonly DEFAULT_X = 28
  public static readonly DEFAULT_Y = 96
  public static readonly WINDOW_WIDTH = 152

  public static mergeMatches(
    existing: readonly PocketItem[],
    incoming: readonly PocketItem[],
  ): PocketItem[] {
    if (incoming.length === 0) return existing.slice()
    const seen = new Set(existing.map((item) => item.targetId))
    const next = existing.slice()
    let changed = false
    for (let i = 0; i < incoming.length; i += 1) {
      const item = incoming[i]
      if (!item.targetId || seen.has(item.targetId)) continue
      seen.add(item.targetId)
      next.push(item)
      changed = true
    }
    return changed ? next : existing.slice()
  }

  public static computeCenteredPosition(
    anchorRect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null,
    viewportW: number,
    viewportH: number,
  ): { readonly x: number; readonly y: number } {
    if (anchorRect !== null && anchorRect.width > 0 && anchorRect.height > 0) {
      const cx = anchorRect.left + (anchorRect.width - PocketCaptureManager.WINDOW_WIDTH) * 0.5
      const cy = anchorRect.top + Math.max(28, (anchorRect.height - 260) * 0.42)
      return PocketCaptureManager.clampPosition(cx, cy, viewportW, viewportH)
    }
    const fx = (viewportW - PocketCaptureManager.WINDOW_WIDTH) * 0.5
    const fy = Math.max(48, (viewportH - 260) * 0.4)
    return PocketCaptureManager.clampPosition(fx, fy, viewportW, viewportH)
  }

  public static trackRecognizedBoxes(
    recognized: readonly RecognizedDetection[],
    liveKept: readonly BoundingBox[],
  ): RecognizedDetection[] {
    if (recognized.length === 0 || liveKept.length === 0) return []
    const sorted = recognized.slice().sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) || b.recognizedAt - a.recognizedAt)
    const claimedLiveIds = new Set<string>()
    const tracked: RecognizedDetection[] = []
    for (let i = 0; i < sorted.length; i += 1) {
      const det = sorted[i]
      const detArea = Math.max(1, (det.x2 - det.x1) * (det.y2 - det.y1))
      const detBox: BoundingBox = {
        id: det.targetId,
        x1: det.x1,
        y1: det.y1,
        x2: det.x2,
        y2: det.y2,
        score: 1,
        area: detArea,
        colorIndex: det.colorIndex,
      }
      let bestIoU = 0
      let bestLive: BoundingBox | null = null
      for (let j = 0; j < liveKept.length; j += 1) {
        const live = liveKept[j]
        if (claimedLiveIds.has(live.id)) continue
        const iou = FastSamInferenceEngine.computeIoU(detBox, live)
        if (iou <= bestIoU) continue
        const liveArea = Math.max(1, (live.x2 - live.x1) * (live.y2 - live.y1))
        const scaleRatio = Math.max(detArea / liveArea, liveArea / detArea)
        if (scaleRatio > 2.5 && iou < 0.55) continue
        bestIoU = iou
        bestLive = live
      }
      if (bestLive !== null && bestIoU >= 0.35) {
        claimedLiveIds.add(bestLive.id)
        tracked.push({
          ...det,
          x1: bestLive.x1,
          y1: bestLive.y1,
          x2: bestLive.x2,
          y2: bestLive.y2,
        })
      }
    }
    return tracked
  }

  public static computeDetectionOverlap(a: RecognizedDetection, b: RecognizedDetection): {
    readonly iou: number
    readonly iom: number
  } {
    const ix1 = Math.max(a.x1, b.x1)
    const iy1 = Math.max(a.y1, b.y1)
    const ix2 = Math.min(a.x2, b.x2)
    const iy2 = Math.min(a.y2, b.y2)
    const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1)
    if (inter <= 0) return { iou: 0, iom: 0 }
    const areaA = Math.max(1, (a.x2 - a.x1) * (a.y2 - a.y1))
    const areaB = Math.max(1, (b.x2 - b.x1) * (b.y2 - b.y1))
    const union = areaA + areaB - inter
    const minArea = Math.min(areaA, areaB)
    return {
      iou: union > 0 ? inter / union : 0,
      iom: minArea > 0 ? inter / minArea : 0,
    }
  }

  /**
   * Suppresses overlapping recognized boxes, strictly preferring the tighter inner
   * foreground box over any giant enclosing background box:
   * - For the SAME target (same targetId or title): compares max(IoU, IoM) so an
   *   enclosing background wall box (IoM ≈ 1.0 even when IoU is small) is always
   *   suppressed across all camera angles and distances.
   * - For DIFFERENT targets (e.g., a mug held in front of a person): compares
   *   standard IoU so distinct foreground objects inside a larger person stay visible.
   */
  public static suppressOverlappingDetections(
    detections: readonly RecognizedDetection[],
    iouThreshold: number,
  ): RecognizedDetection[] {
    if (detections.length <= 1) return detections.slice()
    const safeThreshold = Math.max(0, Math.min(1, Number.isFinite(iouThreshold) ? iouThreshold : 0.3))
    if (safeThreshold >= 1) return detections.slice()

    // Process highest-similarity detections first so real matches beat weak edge bleed;
    // if an already-kept box strongly encloses a tighter same-target box (iom >= 0.75),
    // replace the outer enclosing box with the tighter inner box.
    const ordered = detections.slice().sort((a, b) => {
      const simDiff = (b.similarity ?? 0) - (a.similarity ?? 0)
      if (Math.abs(simDiff) > 1e-4) return simDiff
      const areaA = Math.max(1, (a.x2 - a.x1) * (a.y2 - a.y1))
      const areaB = Math.max(1, (b.x2 - b.x1) * (b.y2 - b.y1))
      return areaA - areaB || b.recognizedAt - a.recognizedAt
    })

    const kept: RecognizedDetection[] = []
    for (let i = 0; i < ordered.length; i += 1) {
      const cand = ordered[i]
      const candArea = Math.max(1, (cand.x2 - cand.x1) * (cand.y2 - cand.y1))
      let suppressed = false
      for (let j = 0; j < kept.length; j += 1) {
        const existing = kept[j]
        const existingArea = Math.max(1, (existing.x2 - existing.x1) * (existing.y2 - existing.y1))
        const { iou, iom } = PocketCaptureManager.computeDetectionOverlap(existing, cand)
        const sameTarget =
          existing.targetId === cand.targetId ||
          existing.title.trim().toLowerCase() === cand.title.trim().toLowerCase()
        const overlapMetric = sameTarget ? Math.max(iou, iom) : iou
        if (overlapMetric >= safeThreshold) {
          // If cand is strictly enclosed inside an outer same-target box, prefer the tighter inner box
          if (sameTarget && iom >= 0.75 && candArea < existingArea * 0.85) {
            kept[j] = cand
          }
          suppressed = true
          break
        }
      }
      if (!suppressed) kept.push(cand)
    }
    return kept
  }

  public static clampPosition(
    x: number,
    y: number,
    viewportW: number,
    viewportH: number,
  ): { readonly x: number; readonly y: number } {
    const maxX = Math.max(8, viewportW - PocketCaptureManager.WINDOW_WIDTH - 8)
    const maxY = Math.max(8, viewportH - 120)
    return {
      x: Math.round(Math.min(maxX, Math.max(8, x))),
      y: Math.round(Math.min(maxY, Math.max(8, y))),
    }
  }
}
