import React, { useRef, useState } from 'react'
import { DEFAULT_MATCH_THRESHOLD, type ModelStatusResponse } from '../../invariant'
import type { CameraDeviceOption } from '../core/CameraController'
import type { LocaleService } from '../core/LocaleService'
import { MdSliderField } from './MdSliderField'

export interface CameraControlStripProps {
  readonly cameraActive: boolean
  readonly mirror: boolean
  readonly devices: readonly CameraDeviceOption[]
  readonly selectedDeviceId: string
  readonly hasLocalModel: boolean
  readonly modelPhase: 'idle' | 'checking' | 'downloading' | 'initializing' | 'ready' | 'error'
  readonly downloadPct: number
  readonly modelMessage: string
  readonly embedPhase: 'idle' | 'loading' | 'ready' | 'error'
  readonly embedPct: number
  readonly embedMessage: string
  readonly hostStorageStatus: ModelStatusResponse | null
  readonly vectorStats: { readonly totalTargets: number; readonly totalVectors: number }
  readonly matchThreshold: number
  readonly matchError?: string | null
  readonly onMatchThresholdChange: (value: number) => void
  readonly locale: LocaleService
  readonly onToggleCamera: () => void
  readonly onToggleMirror: () => void
  readonly onOpenDatabase: () => void
  readonly onOpenPocket: () => void
  readonly onSelectDevice: (deviceId: string) => void
  readonly onPreloadModel: () => void
  readonly onUploadLocalOnnx: (file: File) => void
  readonly onClearCache: () => void
  readonly onClearVectorDb: () => void
}

export function CameraControlStrip(props: CameraControlStripProps): React.JSX.Element {
  const [pathsExpanded, setPathsExpanded] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const busyModel = props.modelPhase === 'checking' || props.modelPhase === 'downloading' || props.modelPhase === 'initializing'
  const showMissingAlert = !props.hasLocalModel && props.modelPhase !== 'ready' && !busyModel

  return (
    <div className="nt-md-card">
      <div className="nt-toolbar">
        <button
          type="button"
          className={props.cameraActive ? 'nt-btn nt-btn-tonal' : 'nt-btn nt-btn-filled'}
          onClick={props.onToggleCamera}
        >
          {props.cameraActive ? props.locale.translate('camera.stop') : props.locale.translate('camera.start')}
        </button>

        <button
          type="button"
          className={props.mirror ? 'nt-btn nt-btn-tonal' : 'nt-btn nt-btn-outlined'}
          onClick={props.onToggleMirror}
        >
          {props.locale.translate('camera.mirror')}
        </button>

        <button
          type="button"
          className="nt-btn nt-btn-outlined"
          onClick={props.onOpenDatabase}
        >
          {props.locale.translate('db.openBtn')}
        </button>

        <button
          type="button"
          className="nt-btn nt-btn-outlined"
          onClick={props.onOpenPocket}
        >
          {props.locale.translate('pocket.openBtn')}
        </button>

        {props.devices.length > 0 ? (
          <select
            className="nt-select"
            aria-label={props.locale.translate('camera.devicePlaceholder')}
            value={props.selectedDeviceId}
            onChange={(e) => props.onSelectDevice(e.target.value)}
          >
            {props.devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="nt-toolbar">
        <span className="nt-btn-badge-wrap">
          <button
            type="button"
            className="nt-btn nt-btn-tonal"
            disabled={busyModel}
            title={showMissingAlert ? props.locale.translate('model.missingAlert') : undefined}
            onClick={props.onPreloadModel}
          >
            {props.locale.translate('model.loadBtn')}
          </button>
          {showMissingAlert ? (
            <span
              className="nt-btn-alert-dot"
              role="status"
              aria-label={props.locale.translate('model.missingAlert')}
              title={props.locale.translate('model.missingAlert')}
            >
              ❗️
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="nt-btn nt-btn-outlined"
          disabled={busyModel}
          onClick={() => fileInputRef.current?.click()}
        >
          {props.locale.translate('model.uploadBtn')}
        </button>
        <button
          type="button"
          className="nt-btn nt-btn-danger-outlined"
          title={props.locale.translate('db.clearBtnTitle')}
          onClick={props.onClearVectorDb}
        >
          {props.locale.translate('db.clearBtn')}
        </button>
        <button
          type="button"
          className="nt-btn nt-btn-outlined"
          disabled={busyModel}
          onClick={props.onClearCache}
        >
          {props.locale.translate('model.clearCacheBtn')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".onnx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) props.onUploadLocalOnnx(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className={props.modelPhase === 'error' ? 'nt-banner is-error' : 'nt-banner'}>
        <div>{props.locale.translate('model.label')}: {props.modelMessage}</div>
        {props.modelPhase === 'downloading' ? (
          <div className="nt-progress-bar" style={{ marginTop: '8px' }}>
            <div className="nt-progress-fill" style={{ width: props.downloadPct + '%' }} />
          </div>
        ) : null}
      </div>

      <div className={props.embedPhase === 'error' ? 'nt-banner is-error' : 'nt-banner'}>
        <div>{props.locale.translate('embed.label')}: {props.embedMessage}</div>
        {props.embedPhase === 'loading' ? (
          <div className="nt-progress-bar" style={{ marginTop: '8px' }}>
            <div className="nt-progress-fill" style={{ width: props.embedPct + '%' }} />
          </div>
        ) : null}
      </div>

      <MdSliderField
        label={props.locale.translate('match.thresholdLabel')}
        badge={props.matchThreshold.toFixed(2)}
        value={props.matchThreshold}
        min={0}
        max={1}
        step={0.01}
        hint={props.locale.translate('match.thresholdHint')}
        headerAction={
          <button
            type="button"
            className="nt-mini-btn"
            onClick={() => props.onMatchThresholdChange(DEFAULT_MATCH_THRESHOLD)}
          >
            {props.locale.translate('match.resetDefault')}
          </button>
        }
        onChange={props.onMatchThresholdChange}
      />
      {props.matchError ? (
        <div className="nt-banner is-error" role="alert">
          {props.matchError}
        </div>
      ) : null}

      <div className="nt-storage-paths">
        <button
          type="button"
          className="nt-storage-toggle"
          aria-expanded={pathsExpanded}
          onClick={() => setPathsExpanded((prev) => !prev)}
        >
          <span className="nt-storage-title">{props.locale.translate('storage.pathsTitle')}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={pathsExpanded ? 'nt-storage-chevron' : 'nt-storage-chevron is-collapsed'}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {pathsExpanded ? (
          <>
        <div className="nt-storage-row">
          <span className="nt-storage-key">{props.locale.translate('storage.cacheDir')}</span>
          <span className="nt-storage-val">
            {props.hostStorageStatus?.cacheDir ?? props.locale.translate('storage.loading')}
          </span>
        </div>
        <div className="nt-storage-row">
          <span className="nt-storage-key">{props.locale.translate('storage.modelPath')}</span>
          <span className="nt-storage-val">
            {props.hostStorageStatus?.cachePath ?? props.locale.translate('storage.loading')}
          </span>
        </div>
        <div className="nt-storage-row">
          <span className="nt-storage-key">{props.locale.translate('storage.prefsPath')}</span>
          <span className="nt-storage-val">
            {props.hostStorageStatus?.preferencesPath ?? props.locale.translate('storage.loading')}
          </span>
        </div>
        <div className="nt-storage-row">
          <span className="nt-storage-key">{props.locale.translate('storage.faissDir')}</span>
          <span className="nt-storage-val">
            {props.hostStorageStatus?.faissIndexDir ?? props.locale.translate('storage.loading')}
          </span>
          <span className="nt-storage-key">
            {props.locale.translate('storage.faissStats', {
              targets: props.vectorStats.totalTargets,
              vectors: props.vectorStats.totalVectors,
            })}
          </span>
        </div>
        <div className="nt-storage-row">
          <span className="nt-storage-key">{props.locale.translate('storage.browserCache')}</span>
          <span className="nt-storage-val">{props.locale.translate('storage.browserValue')}</span>
        </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
