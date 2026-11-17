import React, { useEffect, useRef, useState } from 'react'
import type { LocaleService } from '../core/LocaleService'
import type { SavedPresetItem } from '../core/SavedPresetModels'

export interface SavedPresetDropdownProps {
  readonly presets: readonly SavedPresetItem[]
  readonly locale: LocaleService
  readonly onSelect: (presetId: string) => void
  readonly onRename: (presetId: string, nextText: string) => void
  readonly onDelete: (presetId: string) => void
}

export function SavedPresetDropdown(props: SavedPresetDropdownProps): React.JSX.Element | null {
  const [open, setOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState<string>('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      return
    }
    const onDocMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingId !== null) {
          setEditingId(null)
        } else {
          setOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, editingId])

  if (props.presets.length === 0) return null

  const activePreset = props.presets.find((p) => p.selected)
  const triggerText = activePreset
    ? activePreset.text
    : props.locale.translate('granularity.savedDropdownPlaceholder', { count: props.presets.length })

  const commitEdit = (item: SavedPresetItem): void => {
    const trimmed = draftText.trim()
    if (trimmed.length > 0 && trimmed !== item.text) {
      props.onRename(item.id, trimmed)
    }
    setEditingId(null)
  }

  return (
    <div ref={rootRef} className="nt-preset-dropdown">
      <button
        type="button"
        className="nt-preset-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={props.locale.translate('granularity.savedDropdownAria')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="nt-preset-select-text">{triggerText}</span>
        <span aria-hidden="true" style={{ fontSize: '10px', opacity: 0.8 }}>▾</span>
      </button>

      {open ? (
        <div className="nt-dropdown-menu" role="listbox" aria-label={props.locale.translate('granularity.savedDropdownAria')}>
          {props.presets.map((item) => {
            const isEditing = editingId === item.id
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={item.selected}
                className={item.selected ? 'nt-dropdown-item is-selected' : 'nt-dropdown-item'}
              >
                {isEditing ? (
                  <input
                    type="text"
                    className="nt-dropdown-edit-input"
                    value={draftText}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftText(e.target.value)}
                    onBlur={() => commitEdit(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitEdit(item)
                      } else if (e.key === 'Escape') {
                        e.stopPropagation()
                        setEditingId(null)
                      }
                    }}
                  />
                ) : (
                  <span
                    className="nt-dropdown-item-label"
                    title={props.locale.translate('granularity.editPresetTitle') + ' · ' + item.text}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(item.id)
                      setDraftText(item.text)
                    }}
                  >
                    {item.text}
                  </span>
                )}

                <span className="nt-dropdown-item-actions">
                  <button
                    type="button"
                    className={item.selected ? 'nt-dropdown-check-btn is-checked' : 'nt-dropdown-check-btn'}
                    aria-pressed={item.selected}
                    aria-label={props.locale.translate('granularity.selectPresetTitle')}
                    title={props.locale.translate('granularity.selectPresetTitle')}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onSelect(item.id)
                    }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="nt-dropdown-del-btn"
                    aria-label={props.locale.translate('granularity.deletePresetTitle')}
                    title={props.locale.translate('granularity.deletePresetTitle')}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onDelete(item.id)
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
