import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { LocaleService } from '../core/LocaleService'
import { PocketCaptureManager, type PocketItem } from '../core/PocketCaptureManager'

export interface PocketFloatingWindowProps {
  readonly open: boolean
  readonly anchorRef?: React.RefObject<HTMLDivElement>
  readonly items: readonly PocketItem[]
  readonly locale: LocaleService
  readonly onClose: () => void
}

interface DragOffset {
  readonly dx: number
  readonly dy: number
}

export function PocketFloatingWindow(props: PocketFloatingWindowProps): React.JSX.Element | null {
  const [pos, setPos] = useState<{ readonly x: number; readonly y: number }>(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720
    return PocketCaptureManager.computeCenteredPosition(null, vw, vh)
  })
  const [dragOffset, setDragOffset] = useState<DragOffset | null>(null)
  const hasUserDraggedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!props.open || hasUserDraggedRef.current || typeof window === 'undefined') return
    const rect = props.anchorRef?.current?.getBoundingClientRect() ?? null
    setPos(PocketCaptureManager.computeCenteredPosition(rect, window.innerWidth, window.innerHeight))
  }, [props.anchorRef, props.open])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      setPos((prev) => PocketCaptureManager.clampPosition(prev.x, prev.y, window.innerWidth, window.innerHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragOffset({ dx: event.clientX - pos.x, dy: event.clientY - pos.y })
    },
    [pos.x, pos.y],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragOffset === null) return
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
      const vh = typeof window !== 'undefined' ? window.innerHeight : 720
      hasUserDraggedRef.current = true
      setPos(PocketCaptureManager.clampPosition(event.clientX - dragOffset.dx, event.clientY - dragOffset.dy, vw, vh))
    },
    [dragOffset],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragOffset === null) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setDragOffset(null)
    },
    [dragOffset],
  )

  if (!props.open) return null

  return (
    <aside
      className="nt-pocket-window"
      aria-label={props.locale.translate('pocket.title')}
      style={{ left: pos.x + 'px', top: pos.y + 'px' }}
    >
      <div
        className={dragOffset !== null ? 'nt-pocket-header is-dragging' : 'nt-pocket-header'}
        title={props.locale.translate('pocket.dragTitle')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="nt-pocket-title">{props.locale.translate('pocket.title')}</span>
        <button
          type="button"
          className="nt-pocket-close"
          aria-label={props.locale.translate('pocket.close')}
          title={props.locale.translate('pocket.close')}
          onClick={props.onClose}
        >
          ✕
        </button>
      </div>

      <div className="nt-pocket-list">
        {props.items.length === 0 ? (
          <div className="nt-pocket-empty">{props.locale.translate('pocket.empty')}</div>
        ) : props.items.map((item) => (
          <div key={item.targetId} className="nt-pocket-slot">
            <div className="nt-pocket-img-frame">
              <img src={item.dataUrl} alt={item.title} className="nt-aug-img" />
            </div>
            <div className="nt-pocket-item-title" title={item.title}>
              {item.title}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
