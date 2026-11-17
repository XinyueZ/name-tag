import React, { useCallback, useState } from 'react'

export interface SplitPaneDividerProps {
  readonly containerRef: React.RefObject<HTMLDivElement>
  readonly leftRatio: number
  readonly onRatioChange: (nextRatio: number) => void
  readonly title: string
}

export class SplitPaneGeometry {
  public static readonly DEFAULT_RATIO = 50
  public static readonly MIN_RATIO = 26
  public static readonly MAX_RATIO = 74

  public static clampRatio(ratio: number): number {
    return Math.min(SplitPaneGeometry.MAX_RATIO, Math.max(SplitPaneGeometry.MIN_RATIO, ratio))
  }

  public static computeRatioFromClientX(container: HTMLElement | null, clientX: number): number {
    if (container === null) return SplitPaneGeometry.DEFAULT_RATIO
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0) return SplitPaneGeometry.DEFAULT_RATIO
    const raw = ((clientX - rect.left) / rect.width) * 100
    return Number(SplitPaneGeometry.clampRatio(raw).toFixed(1))
  }
}

export function SplitPaneDivider(props: SplitPaneDividerProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setDragging(true)
    props.onRatioChange(
      SplitPaneGeometry.computeRatioFromClientX(props.containerRef.current, event.clientX),
    )
  }, [props])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    props.onRatioChange(
      SplitPaneGeometry.computeRatioFromClientX(props.containerRef.current, event.clientX),
    )
  }, [dragging, props])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [dragging])

  const handleDoubleClick = useCallback(() => {
    props.onRatioChange(SplitPaneGeometry.DEFAULT_RATIO)
  }, [props])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(props.leftRatio)}
      aria-valuemin={SplitPaneGeometry.MIN_RATIO}
      aria-valuemax={SplitPaneGeometry.MAX_RATIO}
      title={props.title}
      className={dragging ? 'nt-divider is-dragging' : 'nt-divider'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <div className="nt-divider-pill" />
    </div>
  )
}
