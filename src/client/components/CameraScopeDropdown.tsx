import React, { useEffect, useRef, useState } from 'react'
import { DEFAULT_SCOPE_CONFIDENCE_THRESHOLD } from '../../invariant'
import { CameraScopeCollection, type CameraScopeAddStatus, type CameraScopeItem } from '../core/CameraScopeModels'
import { CameraTipsScheduler } from '../core/CameraTipsScheduler'
import type { LocaleService } from '../core/LocaleService'

export interface CameraScopeDropdownProps {
  readonly collection: CameraScopeCollection
  readonly cameraActive: boolean
  readonly scopeConfidenceThreshold: number
  readonly onScopeConfidenceThresholdChange: (value: number) => void
  readonly locale: LocaleService
  readonly onAdd: (text: string) => CameraScopeAddStatus
  readonly onSelect: (id: string) => void
  readonly onRename: (id: string, nextText: string) => void
  readonly onDelete: (id: string) => void
}

export function CameraScopeDropdown(props: CameraScopeDropdownProps): React.JSX.Element {
  const [open, setOpen] = useState<boolean>(false)
  const [inputText, setInputText] = useState<string>('')
  const [feedbackKey, setFeedbackKey] = useState<'scope.duplicateHint' | 'scope.reservedBuiltInHint' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<string>('')
  const [tipsVisible, setTipsVisible] = useState<boolean>(false)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const composingRef = useRef<boolean>(false)
  const tipsSchedulerRef = useRef<CameraTipsScheduler | null>(null)

  const builtInLabels = {
    all: props.locale.translate('scope.all'),
    humanFace: props.locale.translate('scope.humanFace'),
  }
  const allItems = props.collection.getAllItems(builtInLabels)
  const selectedItem = props.collection.getSelectedItem(builtInLabels)

  useEffect(() => {
    const scheduler = new CameraTipsScheduler(setTipsVisible)
    tipsSchedulerRef.current = scheduler
    return () => {
      scheduler.dispose()
      tipsSchedulerRef.current = null
    }
  }, [])

  useEffect(() => {
    const scheduler = tipsSchedulerRef.current
    if (!scheduler) return
    if (props.cameraActive) {
      scheduler.start()
    } else {
      scheduler.stop()
    }
  }, [props.cameraActive])

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setFeedbackKey(null)
      return
    }
    const focusTimer = window.setTimeout(() => {
      if (editingId === null) {
        inputRef.current?.focus()
      }
    }, 0)
    const onDocMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (editingId !== null) {
          setEditingId(null)
          window.setTimeout(() => inputRef.current?.focus(), 0)
        } else {
          setOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, editingId])

  const submitNewItem = (): void => {
    const status = props.onAdd(inputText)
    if (status === 'added') {
      setInputText('')
      setFeedbackKey(null)
      window.setTimeout(() => {
        inputRef.current?.focus()
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      }, 0)
    } else if (status === 'duplicate') {
      setFeedbackKey('scope.duplicateHint')
      inputRef.current?.focus()
    } else if (status === 'reserved-builtin') {
      setFeedbackKey('scope.reservedBuiltInHint')
      inputRef.current?.focus()
    }
  }

  const commitEdit = (item: CameraScopeItem): void => {
    if (!item.editable || item.isBuiltIn) {
      setEditingId(null)
      return
    }
    const trimmed = draftText.trim()
    if (trimmed.length > 0 && trimmed !== item.text) {
      props.onRename(item.id, trimmed)
    }
    setEditingId(null)
  }

  return (
    <div
      ref={rootRef}
      className="nt-scope-dropdown"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {tipsVisible ? (
        <div className="nt-scope-tips-bubble" role="status" aria-live="polite">
          <span className="nt-scope-tips-badge">{props.locale.translate('scope.tipsBadge')}</span>
          <span className="nt-scope-tips-text">{props.locale.translate('scope.tipsText')}</span>
        </div>
      ) : null}

      <button
        type="button"
        className={open ? 'nt-scope-trigger is-open' : 'nt-scope-trigger'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={props.locale.translate('scope.dropdownAria')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="nt-scope-trigger-icon"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="nt-scope-trigger-text">{selectedItem.text}</span>
        <span className={open ? 'nt-scope-chevron is-open' : 'nt-scope-chevron'} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div
          className="nt-scope-menu"
          role="dialog"
          aria-label={props.locale.translate('scope.dropdownAria')}
        >
          <div className="nt-scope-input-row">
            <input
              ref={inputRef}
              type="text"
              className="nt-scope-input"
              value={inputText}
              placeholder={props.locale.translate('scope.inputPlaceholder')}
              aria-label={props.locale.translate('scope.inputPlaceholder')}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={() => { composingRef.current = false }}
              onChange={(e) => {
                setInputText(e.target.value)
                if (feedbackKey !== null) setFeedbackKey(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !composingRef.current && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submitNewItem()
                }
              }}
            />
            <button
              type="button"
              className="nt-scope-add-btn"
              disabled={inputText.trim().length === 0}
              aria-label={props.locale.translate('scope.addBtnTitle')}
              title={props.locale.translate('scope.addBtnTitle')}
              onClick={() => submitNewItem()}
            >
              ↵
            </button>
          </div>

          {feedbackKey !== null ? (
            <div className="nt-scope-feedback" role="status">
              {props.locale.translate(feedbackKey)}
            </div>
          ) : null}

          <div className="nt-scope-threshold-box">
            <div className="nt-scope-threshold-head">
              <span className="nt-scope-threshold-label">
                {props.locale.translate('scope.thresholdLabel')}
              </span>
              <span className="nt-scope-threshold-right">
                <span className="nt-scope-threshold-badge">
                  {props.scopeConfidenceThreshold.toFixed(2)}
                </span>
                <button
                  type="button"
                  className="nt-mini-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onScopeConfidenceThresholdChange(DEFAULT_SCOPE_CONFIDENCE_THRESHOLD)
                  }}
                >
                  {props.locale.translate('scope.thresholdReset')}
                </button>
              </span>
            </div>
            <input
              type="range"
              className="nt-scope-threshold-slider"
              min={0}
              max={1}
              step={0.01}
              value={props.scopeConfidenceThreshold}
              aria-label={props.locale.translate('scope.thresholdLabel')}
              onChange={(e) => props.onScopeConfidenceThresholdChange(Number(e.target.value))}
            />
          </div>

          <div ref={listRef} className="nt-scope-list" role="listbox" aria-label={props.locale.translate('scope.dropdownAria')}>
            {allItems.map((item) => {
              const isSelected = item.id === selectedItem.id
              const isEditing = item.editable && !item.isBuiltIn && editingId === item.id
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  title={item.isBuiltIn ? props.locale.translate('scope.lockedHint') : undefined}
                  className={
                    'nt-scope-item' +
                    (isSelected ? ' is-selected' : '') +
                    (item.isBuiltIn ? ' is-locked' : '')
                  }
                  onClick={() => {
                    if (isEditing) return
                    props.onSelect(item.id)
                    setOpen(false)
                  }}
                >
                  <span className={isSelected ? 'nt-scope-item-check is-visible' : 'nt-scope-item-check'} aria-hidden="true">
                    ✓
                  </span>

                  {isEditing ? (
                    <input
                      type="text"
                      className="nt-dropdown-edit-input"
                      value={draftText}
                      autoFocus
                      onCompositionStart={() => { composingRef.current = true }}
                      onCompositionEnd={() => { composingRef.current = false }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraftText(e.target.value)}
                      onBlur={() => commitEdit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !composingRef.current && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          commitEdit(item)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditingId(null)
                        }
                      }}
                    />
                  ) : (
                    <span className="nt-dropdown-item-label">
                      {item.text}
                    </span>
                  )}

                  {item.editable && !item.isBuiltIn ? (
                    <span className="nt-dropdown-item-actions">
                      <button
                        type="button"
                        className="nt-scope-edit-btn"
                        aria-label={props.locale.translate('scope.editItemTitle')}
                        title={props.locale.translate('scope.editItemTitle')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(item.id)
                          setDraftText(item.text)
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="nt-dropdown-del-btn"
                        aria-label={props.locale.translate('scope.deleteItemTitle')}
                        title={props.locale.translate('scope.deleteItemTitle')}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (editingId === item.id) setEditingId(null)
                          props.onDelete(item.id)
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}