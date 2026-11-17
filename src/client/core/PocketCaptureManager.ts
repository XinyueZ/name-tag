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
    if (recognized.length === 0) return []
    if (liveKept.length === 0) return recognized.slice()
    const tracked: RecognizedDetection[] = []
    for (let i = 0; i < recognized.length; i += 1) {
      const det = recognized[i]
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
        const iou = FastSamInferenceEngine.computeIoU(detBox, liveKept[j])
        if (iou > bestIoU) {
          bestIoU = iou
          bestLive = liveKept[j]
        }
      }
      if (bestLive !== null && bestIoU >= 0.4) {
        tracked.push({
          ...det,
          x1: bestLive.x1,
          y1: bestLive.y1,
          x2: bestLive.x2,
          y2: bestLive.y2,
        })
      } else {
        tracked.push(det)
      }
    }
    return tracked
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
