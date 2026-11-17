import React, { useState } from 'react'
import type { GranularityParams, GranularityPreset } from '../../invariant'
import type { SavedPresetItem } from '../core/SavedPresetModels'
import { GranularityFilter } from '../core/GranularityFilter'
import type { LocaleService } from '../core/LocaleService'
import { MdSliderField } from './MdSliderField'
import { SavedPresetDropdown } from './SavedPresetDropdown'

export interface GranularityCardProps {
  readonly params: GranularityParams
  readonly collapsed?: boolean
  readonly showProbLabels?: boolean
  readonly savedPresets?: readonly SavedPresetItem[]
  readonly keptCount: number
  readonly suppressedCount: number
  readonly filterMs: number
  readonly inferMs: number
  readonly fps: number
  readonly locale: LocaleService
  readonly onChange: (nextParams: GranularityParams) => void
  readonly onToggleProbLabels?: () => void
  readonly onSavePreset?: () => void
  readonly onSelectSavedPreset?: (presetId: string) => void
  readonly onRenameSavedPreset?: (presetId: string, nextText: string) => void
  readonly onDeleteSavedPreset?: (presetId: string) => void
  readonly onToggleCollapse?: () => void
}

export function GranularityCard(props: GranularityCardProps): React.JSX.Element {
  const [localCollapsed, setLocalCollapsed] = useState<boolean>(false)
  const collapsed = props.collapsed ?? localCollapsed
  const savedPresets = props.savedPresets ?? []
  const { params, locale } = props
  const band = GranularityFilter.classifyBand(params.comprehensive)
  const masterBadge = locale.translate('granularity.masterBadge.' + band, {
    val: params.comprehensive,
  })
  const toggleLabel = locale.translate(collapsed ? 'granularity.expand' : 'granularity.collapse')
  const presets: readonly Exclude<GranularityPreset, 'custom'>[] = ['coarse', 'balanced', 'fine']

  return (
    <section className="nt-md-card" aria-label={locale.translate('granularity.cardTitle')}>
      <div className="nt-md-card-header">
        <div className="nt-md-card-header-main">
          <div className="nt-md-card-title">{locale.translate('granularity.cardTitle')}</div>
        </div>
        <div className="nt-md-card-actions">
          {props.onToggleProbLabels ? (
            <div
              role="switch"
              aria-checked={Boolean(props.showProbLabels)}
              aria-label={locale.translate('granularity.showProbLabel')}
              title={locale.translate('granularity.showProbLabelTitle')}
              tabIndex={0}
              className="nt-inline-switch"
              onClick={props.onToggleProbLabels}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  props.onToggleProbLabels?.()
                }
              }}
            >
              <span>{locale.translate('granularity.showProbLabel')}</span>
              <span className={props.showProbLabels ? 'nt-switch-track is-compact is-on' : 'nt-switch-track is-compact'}>
                <span className="nt-switch-thumb" />
              </span>
            </div>
          ) : null}
          {props.onSavePreset ? (
            <button
              type="button"
              className="nt-btn nt-btn-tonal nt-btn-compact"
              title={locale.translate('granularity.savePresetTitle')}
              onClick={props.onSavePreset}
            >
              {locale.translate('granularity.savePreset')}
            </button>
          ) : null}
          <button
            type="button"
            className="nt-icon-btn"
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={() => {
              if (props.onToggleCollapse) props.onToggleCollapse()
              else setLocalCollapsed((prev) => !prev)
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={collapsed ? 'nt-icon-btn-chevron is-collapsed' : 'nt-icon-btn-chevron'}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="nt-chip-group" role="group" aria-label={locale.translate('granularity.presetsLabel')}>
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                className={params.preset === preset ? 'nt-chip is-active' : 'nt-chip'}
                onClick={() => props.onChange(GranularityFilter.fromPreset(preset, params.showSuppressed))}
              >
                {locale.translate('granularity.preset.' + preset)}
              </button>
            ))}
            <SavedPresetDropdown
              presets={savedPresets}
              locale={locale}
              onSelect={(id) => props.onSelectSavedPreset?.(id)}
              onRename={(id, nextText) => props.onRenameSavedPreset?.(id, nextText)}
              onDelete={(id) => props.onDeleteSavedPreset?.(id)}
            />
          </div>

          <MdSliderField
            label={locale.translate('granularity.masterLabel')}
            badge={masterBadge}
            value={params.comprehensive}
            min={0}
            max={100}
            step={1}
            onChange={(val) => props.onChange(GranularityFilter.fromComprehensive(val, params.showSuppressed))}
          />

          <MdSliderField
            label={locale.translate('granularity.containLabel')}
            badge={params.containmentThreshold.toFixed(2)}
            value={params.containmentThreshold}
            min={0}
            max={1}
            step={0.01}
            hint={locale.translate('granularity.containHint')}
            onChange={(val) => props.onChange({ ...params, preset: 'custom', containmentThreshold: val })}
          />

          <MdSliderField
            label={locale.translate('granularity.minAreaLabel')}
            badge={params.minAreaPercent.toFixed(1) + '%'}
            value={params.minAreaPercent}
            min={0}
            max={100}
            step={0.1}
            hint={locale.translate('granularity.minAreaHint')}
            onChange={(val) => props.onChange({ ...params, preset: 'custom', minAreaPercent: val })}
          />

          <MdSliderField
            label={locale.translate('granularity.confLabel')}
            badge={Math.round(params.confThreshold * 100) + '%'}
            value={params.confThreshold}
            min={0}
            max={1}
            step={0.01}
            hint={locale.translate('granularity.confHint')}
            onChange={(val) => props.onChange({ ...params, preset: 'custom', confThreshold: val })}
          />

          <div
            role="switch"
            aria-checked={params.showSuppressed}
            tabIndex={0}
            className="nt-switch-row"
            onClick={() => props.onChange({ ...params, showSuppressed: !params.showSuppressed })}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                props.onChange({ ...params, showSuppressed: !params.showSuppressed })
              }
            }}
          >
            <span className="nt-slider-label">{locale.translate('granularity.showSuppressed')}</span>
            <span className={params.showSuppressed ? 'nt-switch-track is-on' : 'nt-switch-track'}>
              <span className="nt-switch-thumb" />
            </span>
          </div>

          <div className="nt-stats-grid">
            <div className="nt-stat-box">
              <span className="nt-stat-val">{props.keptCount}</span>
              <span className="nt-stat-lbl">{locale.translate('stats.kept')}</span>
            </div>
            <div className="nt-stat-box">
              <span className="nt-stat-val">{props.suppressedCount}</span>
              <span className="nt-stat-lbl">{locale.translate('stats.suppressed')}</span>
            </div>
            <div className="nt-stat-box">
              <span className="nt-stat-val">{props.filterMs.toFixed(2)} ms</span>
              <span className="nt-stat-lbl">{locale.translate('stats.filterMs')}</span>
            </div>
            <div className="nt-stat-box">
              <span className="nt-stat-val">{props.inferMs > 0 ? props.inferMs.toFixed(1) + ' ms' : '--'}</span>
              <span className="nt-stat-lbl">{locale.translate('stats.inferMs')}</span>
            </div>
            <div className="nt-stat-box">
              <span className="nt-stat-val">{props.fps > 0 ? props.fps.toFixed(1) : '--'}</span>
              <span className="nt-stat-lbl">{locale.translate('stats.fps')}</span>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
