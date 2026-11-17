import type { BoundingBox, GranularityFilterResult, GranularityParams, GranularityPreset } from '../../invariant'

/**
 * GranularityFilter: Pure OOP implementation of Containment NMS and granularity
 * parameter mapping inherited from session-3e15545d-7233-45ab-9ebc-42a3f8d582e1.
 * Supports pixel-level segmentation mask containment when masks are available.
 */
export class GranularityFilter {
  private static readonly NESTED_HIGH_SCORE_EXEMPTION = 0.88

  public static clamp(val: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, val))
  }

  public static fromPreset(
    preset: Exclude<GranularityPreset, 'custom'>,
    showSuppressed = false,
  ): GranularityParams {
    if (preset === 'coarse') {
      return {
        preset: 'coarse',
        comprehensive: 12,
        containmentThreshold: 0.65,
        minAreaPercent: 2.6,
        confThreshold: 0.48,
        showSuppressed,
      }
    }
    if (preset === 'balanced') {
      return {
        preset: 'balanced',
        comprehensive: 48,
        containmentThreshold: 0.78,
        minAreaPercent: 1.4,
        confThreshold: 0.38,
        showSuppressed,
      }
    }
    return {
      preset: 'fine',
      comprehensive: 88,
      containmentThreshold: 0.92,
      minAreaPercent: 0.4,
      confThreshold: 0.22,
      showSuppressed,
    }
  }

  public static fromComprehensive(comprehensive: number, showSuppressed: boolean): GranularityParams {
    const clamped = Math.round(GranularityFilter.clamp(comprehensive, 0, 100))
    const g = clamped / 100
    return {
      preset: 'custom',
      comprehensive: clamped,
      containmentThreshold: Number((0.60 + g * 0.36).toFixed(2)),
      minAreaPercent: Number((3.4 - g * 3.1).toFixed(1)),
      confThreshold: Number((0.55 - g * 0.35).toFixed(2)),
      showSuppressed,
    }
  }

  public static classifyBand(comprehensive: number): 'coarse' | 'balanced' | 'fine' {
    if (comprehensive < 33) return 'coarse'
    if (comprehensive < 67) return 'balanced'
    return 'fine'
  }

  private static effectiveArea(item: BoundingBox): number {
    return item.maskArea !== undefined && item.maskArea > 0 ? item.maskArea : item.area
  }

  private static computeContainment(child: BoundingBox, parent: BoundingBox): number {
    const ix1 = Math.max(child.x1, parent.x1)
    const iy1 = Math.max(child.y1, parent.y1)
    const ix2 = Math.min(child.x2, parent.x2)
    const iy2 = Math.min(child.y2, parent.y2)
    const boxInter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1)
    if (boxInter <= 0) return 0

    if (
      child.maskData !== undefined &&
      parent.maskData !== undefined &&
      child.maskWidth !== undefined &&
      child.maskHeight !== undefined &&
      child.maskWidth === parent.maskWidth &&
      child.maskHeight === parent.maskHeight &&
      child.maskData.length === parent.maskData.length
    ) {
      const cm = child.maskData
      const pm = parent.maskData
      let childPixels = 0
      let interPixels = 0
      for (let i = 0; i < cm.length; i += 1) {
        if (cm[i] !== 0) {
          childPixels += 1
          if (pm[i] !== 0) interPixels += 1
        }
      }
      return childPixels > 0 ? interPixels / childPixels : 0
    }

    return child.area > 0 ? boxInter / child.area : 0
  }

  public static filterBoxes(
    rawBoxes: readonly BoundingBox[],
    frameWidth: number,
    frameHeight: number,
    params: GranularityParams,
  ): GranularityFilterResult {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const imgArea = Math.max(1, frameWidth * frameHeight)
    const minAreaRatio = params.minAreaPercent / 100
    const tau = params.containmentThreshold
    const conf = params.confThreshold

    const sorted = rawBoxes
      .slice()
      .sort((a, b) => GranularityFilter.effectiveArea(b) - GranularityFilter.effectiveArea(a))
    const kept: BoundingBox[] = []
    const suppressed: BoundingBox[] = []

    for (let i = 0; i < sorted.length; i += 1) {
      const box = sorted[i]
      const effArea = GranularityFilter.effectiveArea(box)
      if (box.score < conf || (effArea / imgArea) < minAreaRatio) {
        suppressed.push(box)
        continue
      }

      let isNested = false
      for (let j = 0; j < kept.length; j += 1) {
        const parent = kept[j]
        const containment = GranularityFilter.computeContainment(box, parent)
        if (containment >= tau && box.score < GranularityFilter.NESTED_HIGH_SCORE_EXEMPTION) {
          isNested = true
          break
        }
      }

      if (isNested) {
        suppressed.push(box)
      } else {
        kept.push(box)
      }
    }

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    return {
      kept,
      suppressed,
      durationMs: Math.max(0.01, Number((t1 - t0).toFixed(2))),
    }
  }
}
