/**
 * ColorPalette: Deterministic vivid color palette for class-agnostic bounding boxes.
 */
export class ColorPalette {
  private static readonly COLORS: readonly string[] = [
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#8b5cf6',
    '#f97316',
    '#84cc16',
    '#14b8a6',
    '#a855f7',
    '#ef4444',
    '#eab308',
  ]

  public static strokeFor(index: number): string {
    const safeIdx = Math.abs(Math.trunc(index)) % ColorPalette.COLORS.length
    return ColorPalette.COLORS[safeIdx]
  }

  public static rgbFor(index: number): { readonly r: number; readonly g: number; readonly b: number } {
    const hex = ColorPalette.strokeFor(index).replace('#', '')
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    }
  }

  public static fillFor(index: number, alpha = 0.10): string {
    const hex = ColorPalette.strokeFor(index).replace('#', '')
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
  }

  public static suppressedStroke(): string {
    return '#f43f5e'
  }

  public static suppressedFill(): string {
    return 'rgba(244, 63, 94, 0.06)'
  }
}
