import type { VectorTableRow } from '../../invariant'

export type TimestampSortOrder = 'desc' | 'asc'

/**
 * VectorTableFormatter: Pure static OOP helpers for formatting vector index previews
 * and clamping resizable column widths in VectorDbModal.
 */
export class VectorTableFormatter {
  public static readonly DEFAULT_TITLE_WIDTH = 180
  public static readonly DEFAULT_DESC_WIDTH = 300
  public static readonly MIN_COL_WIDTH = 100
  public static readonly MAX_COL_WIDTH = 760

  public static formatVectorPreview(head: readonly number[], tail: readonly number[]): string {
    if (head.length === 0 && tail.length === 0) return '—'
    const fmt = (n: number): string => (Number.isFinite(n) ? n.toFixed(4) : '0.0000')
    const headStr = head.slice(0, 5).map(fmt).join(', ')
    const tailStr = tail.slice(-5).map(fmt).join(', ')
    if (headStr.length === 0) return '[..., ' + tailStr + ']'
    if (tailStr.length === 0) return '[' + headStr + ', ...]'
    return '[' + headStr + ', ..., ' + tailStr + ']'
  }

  public static clampColumnWidth(width: number): number {
    return Math.round(Math.min(VectorTableFormatter.MAX_COL_WIDTH, Math.max(VectorTableFormatter.MIN_COL_WIDTH, width)))
  }

  public static formatTimestamp(createdAt: number): string {
    if (!Number.isFinite(createdAt) || createdAt <= 0) return '—'
    const d = new Date(createdAt)
    if (Number.isNaN(d.getTime())) return '—'
    const pad = (n: number): string => String(n).padStart(2, '0')
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds())
    )
  }

  public static sortRowsByTimestamp(
    rows: readonly VectorTableRow[],
    order: TimestampSortOrder,
  ): VectorTableRow[] {
    return rows
      .map((row, idx) => ({ row, idx }))
      .sort((a, b) => {
        const diff = order === 'desc' ? b.row.createdAt - a.row.createdAt : a.row.createdAt - b.row.createdAt
        return diff !== 0 ? diff : a.idx - b.idx
      })
      .map((entry) => entry.row)
  }
}
