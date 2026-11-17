import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { VectorTableRow } from '../../invariant'
import type { LocaleService } from '../core/LocaleService'
import { type TimestampSortOrder, VectorTableFormatter } from '../core/VectorTableFormatter'

export interface VectorDbModalProps {
  readonly open: boolean
  readonly loading: boolean
  readonly errorText: string | null
  readonly rows: readonly VectorTableRow[]
  readonly totalTargets: number
  readonly totalVectors: number
  readonly locale: LocaleService
  readonly onRefresh: () => void
  readonly onClose: () => void
}

interface ActiveColDrag {
  readonly column: 'title' | 'description'
  readonly startX: number
  readonly startWidth: number
}

export function VectorDbModal(props: VectorDbModalProps): React.JSX.Element | null {
  const [titleWidth, setTitleWidth] = useState<number>(VectorTableFormatter.DEFAULT_TITLE_WIDTH)
  const [descWidth, setDescWidth] = useState<number>(VectorTableFormatter.DEFAULT_DESC_WIDTH)
  const [dragState, setDragState] = useState<ActiveColDrag | null>(null)
  const [sortOrder, setSortOrder] = useState<TimestampSortOrder>('desc')

  useEffect(() => {
    if (!props.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose])

  const startResize = useCallback(
    (column: 'title' | 'description', event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragState({
        column,
        startX: event.clientX,
        startWidth: column === 'title' ? titleWidth : descWidth,
      })
    },
    [descWidth, titleWidth],
  )

  const moveResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragState === null) return
      const delta = event.clientX - dragState.startX
      const nextWidth = VectorTableFormatter.clampColumnWidth(dragState.startWidth + delta)
      if (dragState.column === 'title') setTitleWidth(nextWidth)
      else setDescWidth(nextWidth)
    },
    [dragState],
  )

  const endResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragState === null) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setDragState(null)
    },
    [dragState],
  )

  const sortedRows = useMemo(
    () => VectorTableFormatter.sortRowsByTimestamp(props.rows, sortOrder),
    [props.rows, sortOrder],
  )

  if (!props.open) return null

  return (
    <div
      className="nt-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={props.locale.translate('db.modalTitle')}
    >
      <div className="nt-modal-dialog nt-db-modal-dialog">
        <header className="nt-modal-header">
          <div className="nt-md-card-header-main">
            <div className="nt-md-card-title">{props.locale.translate('db.modalTitle')}</div>
            <div className="nt-md-card-sub">
              {props.locale.translate('db.modalSubtitle', {
                targets: props.totalTargets,
                vectors: props.totalVectors,
              })}
            </div>
          </div>
          <button
            type="button"
            className="nt-icon-btn"
            aria-label={props.locale.translate('common.close')}
            title={props.locale.translate('common.close')}
            onClick={props.onClose}
          >
            ✕
          </button>
        </header>

        <div className="nt-modal-body">
          {props.errorText ? (
            <div className="nt-banner is-error" role="alert" style={{ marginBottom: '12px' }}>
              {props.errorText}
            </div>
          ) : null}

          {props.loading ? (
            <div className="nt-banner">{props.locale.translate('db.loading')}</div>
          ) : props.rows.length === 0 ? (
            <div className="nt-banner">{props.locale.translate('db.empty')}</div>
          ) : (
            <div className="nt-db-table-wrap">
              <table className="nt-db-table">
                <colgroup>
                  <col style={{ width: '250px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: titleWidth + 'px' }} />
                  <col style={{ width: descWidth + 'px' }} />
                  <col style={{ width: '165px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="nt-db-th">{props.locale.translate('db.col.index')}</th>
                    <th className="nt-db-th">{props.locale.translate('db.col.augmentation')}</th>
                    <th className="nt-db-th is-resizable">
                      <span>{props.locale.translate('db.col.title')}</span>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        title={props.locale.translate('db.resizeHandleTitle')}
                        className={
                          dragState?.column === 'title'
                            ? 'nt-db-col-resizer is-dragging'
                            : 'nt-db-col-resizer'
                        }
                        onPointerDown={(e) => startResize('title', e)}
                        onPointerMove={moveResize}
                        onPointerUp={endResize}
                        onPointerCancel={endResize}
                      />
                    </th>
                    <th className="nt-db-th is-resizable">
                      <span>{props.locale.translate('db.col.description')}</span>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        title={props.locale.translate('db.resizeHandleTitle')}
                        className={
                          dragState?.column === 'description'
                            ? 'nt-db-col-resizer is-dragging'
                            : 'nt-db-col-resizer'
                        }
                        onPointerDown={(e) => startResize('description', e)}
                        onPointerMove={moveResize}
                        onPointerUp={endResize}
                        onPointerCancel={endResize}
                      />
                    </th>
                    <th
                      className="nt-db-th is-sortable"
                      aria-sort={sortOrder === 'desc' ? 'descending' : 'ascending'}
                    >
                      <button
                        type="button"
                        className="nt-db-th-sort-btn"
                        title={props.locale.translate('db.sortTimestampTitle', {
                          order: props.locale.translate('db.sort.' + sortOrder),
                        })}
                        onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                      >
                        <span>{props.locale.translate('db.col.timestamp')}</span>
                        <span aria-hidden="true" style={{ fontSize: '11px', opacity: 0.85 }}>
                          {sortOrder === 'desc' ? '↓' : '↑'}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.id} className="nt-db-tr">
                      <td className="nt-db-td is-mono">
                        {VectorTableFormatter.formatVectorPreview(row.vectorHead, row.vectorTail)}
                      </td>
                      <td className="nt-db-td">{row.augmentation}</td>
                      <td className="nt-db-td">{row.title}</td>
                      <td className="nt-db-td">{row.description}</td>
                      <td className="nt-db-td is-mono">{VectorTableFormatter.formatTimestamp(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="nt-modal-footer">
          <button
            type="button"
            className="nt-btn nt-btn-tonal"
            disabled={props.loading}
            onClick={props.onRefresh}
          >
            {props.locale.translate('db.refresh')}
          </button>
          <button
            type="button"
            className="nt-btn nt-btn-filled"
            onClick={props.onClose}
          >
            {props.locale.translate('common.close')}
          </button>
        </footer>
      </div>
    </div>
  )
}
