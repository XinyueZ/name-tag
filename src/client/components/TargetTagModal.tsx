import React, { useEffect, useState } from 'react'
import type { CutoutPreviewItem } from '../core/CutoutAugmenter'
import type { LocaleService } from '../core/LocaleService'

export interface TargetTagModalProps {
  readonly open: boolean
  readonly items: readonly CutoutPreviewItem[]
  readonly locale: LocaleService
  readonly onSave: (title: string, description: string) => Promise<void>
  readonly onClose: () => void
}

export function TargetTagModal(props: TargetTagModalProps): React.JSX.Element | null {
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) {
      setTitle('')
      setDescription('')
      setValidationAttempted(false)
      setSaving(false)
      setErrorText(null)
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose, saving])

  if (!props.open) return null

  const titleMissing = validationAttempted && title.trim().length === 0
  const descMissing = validationAttempted && description.trim().length === 0

  const handleSubmit = async (): Promise<void> => {
    if (saving) return
    setValidationAttempted(true)
    const cleanTitle = title.trim()
    const cleanDesc = description.trim()
    if (cleanTitle.length === 0 || cleanDesc.length === 0) {
      setErrorText(props.locale.translate('modal.error.required'))
      return
    }
    setErrorText(null)
    setSaving(true)
    try {
      await props.onSave(cleanTitle, cleanDesc)
    } catch (err: unknown) {
      setErrorText(
        props.locale.translate('modal.error.saveFailed', {
          message: err instanceof Error ? err.message : String(err),
        }),
      )
      setSaving(false)
    }
  }

  return (
    <div
      className="nt-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={props.locale.translate('modal.title')}
    >
      <div className="nt-modal-dialog">
        <header className="nt-modal-header">
          <div className="nt-md-card-header-main">
            <div className="nt-md-card-title">{props.locale.translate('modal.title')}</div>
            <div className="nt-md-card-sub">{props.locale.translate('modal.subtitle')}</div>
          </div>
          <button
            type="button"
            className="nt-icon-btn"
            disabled={saving}
            aria-label={props.locale.translate('common.close')}
            title={props.locale.translate('common.close')}
            onClick={props.onClose}
          >
            ✕
          </button>
        </header>

        <div className="nt-modal-body">
          <div className="nt-modal-columns">
            <div className="nt-modal-col-left">
              <div className="nt-aug-grid">
                {props.items.map((item) => (
                  <div key={item.kind} className="nt-aug-card">
                    <div className="nt-aug-checkerboard">
                      <img
                        src={item.dataUrl}
                        alt={props.locale.translate('modal.aug.' + item.kind)}
                        className="nt-aug-img"
                      />
                    </div>
                    <div className="nt-aug-label">
                      {props.locale.translate('modal.aug.' + item.kind)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="nt-modal-col-right">
              <div className="nt-md-field">
                <label className="nt-md-field-label" htmlFor="nt-tag-title-input">
                  {props.locale.translate('modal.field.title')}
                  <span className="nt-required-star" aria-hidden="true">*</span>
                </label>
                <input
                  id="nt-tag-title-input"
                  type="text"
                  required
                  disabled={saving}
                  className={titleMissing ? 'nt-md-input is-invalid' : 'nt-md-input'}
                  value={title}
                  placeholder={props.locale.translate('modal.field.titlePlaceholder')}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (errorText) setErrorText(null)
                  }}
                />
              </div>

              <div className="nt-md-field is-grow">
                <label className="nt-md-field-label" htmlFor="nt-tag-desc-input">
                  {props.locale.translate('modal.field.description')}
                  <span className="nt-required-star" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="nt-tag-desc-input"
                  required
                  disabled={saving}
                  className={descMissing ? 'nt-md-textarea is-invalid' : 'nt-md-textarea'}
                  value={description}
                  placeholder={props.locale.translate('modal.field.descriptionPlaceholder')}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (errorText) setErrorText(null)
                  }}
                />
              </div>

              {errorText ? (
                <div className="nt-banner is-error" role="alert">
                  {errorText}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="nt-modal-footer">
          {saving ? (
            <span className="nt-md-card-sub">{props.locale.translate('modal.saving')}</span>
          ) : null}
          <button
            type="button"
            className="nt-btn nt-btn-filled"
            disabled={saving}
            onClick={() => { void handleSubmit() }}
          >
            {saving ? props.locale.translate('modal.saving') : props.locale.translate('modal.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}
