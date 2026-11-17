import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_MATCH_THRESHOLD, type BoundingBox, type GranularityFilterResult, type GranularityParams, type ModelStatusResponse, type RecognizedDetection, type VectorTableRow } from '../../invariant'
import { CameraController, type CameraDeviceOption } from '../core/CameraController'
import { CutoutAugmenter, type CutoutPreviewItem } from '../core/CutoutAugmenter'
import { FastSamInferenceEngine, type ExecutionProviderKind } from '../core/FastSamInferenceEngine'
import { Gemma2EmbeddingEngine, Gemma2LangChainEmbeddings } from '../core/Gemma2EmbeddingEngine'
import { PocketCaptureManager, type PocketItem } from '../core/PocketCaptureManager'
import { TargetVectorClient } from '../core/TargetVectorClient'
import { GranularityFilter } from '../core/GranularityFilter'
import { LocaleService, type TranslateFn } from '../core/LocaleService'
import { ModelCacheStore, type ModelLoadSource } from '../core/ModelCacheStore'
import { PreferencesStore } from '../core/PreferencesStore'
import { GranularitySettings, SavedPresetItem } from '../core/SavedPresetModels'
import { ThemeService } from '../core/ThemeService'
import { CameraControlStrip } from './CameraControlStrip'
import { CameraViewport } from './CameraViewport'
import { GranularityCard } from './GranularityCard'
import { SplitPaneDivider, SplitPaneGeometry } from './SplitPaneDivider'
import { TargetTagModal } from './TargetTagModal'
import { PocketFloatingWindow } from './PocketFloatingWindow'
import { VectorDbModal } from './VectorDbModal'

export interface NameTagWorkspaceProps {
  readonly t?: TranslateFn | undefined
}

type ModelPhase = 'idle' | 'checking' | 'downloading' | 'initializing' | 'ready' | 'error'

export function NameTagWorkspace(props: NameTagWorkspaceProps): React.JSX.Element {
  const workspaceRootRef = useRef<HTMLDivElement | null>(null)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const cameraRef = useRef<CameraController | null>(null)
  const cacheStoreRef = useRef<ModelCacheStore | null>(null)
  const engineRef = useRef<FastSamInferenceEngine | null>(null)
  const prefStoreRef = useRef<PreferencesStore | null>(null)
  const embedEngineRef = useRef<Gemma2EmbeddingEngine | null>(null)
  const embedLangChainRef = useRef<Gemma2LangChainEmbeddings | null>(null)
  const embedLoadPromiseRef = useRef<Promise<boolean> | null>(null)
  const vectorClientRef = useRef<TargetVectorClient | null>(null)
  const modelLoadPromiseRef = useRef<Promise<boolean> | null>(null)

  if (cameraRef.current === null) cameraRef.current = new CameraController()
  if (cacheStoreRef.current === null) cacheStoreRef.current = new ModelCacheStore()
  if (engineRef.current === null) engineRef.current = new FastSamInferenceEngine()
  if (prefStoreRef.current === null) prefStoreRef.current = new PreferencesStore()
  if (embedEngineRef.current === null) {
    embedEngineRef.current = new Gemma2EmbeddingEngine()
    embedLangChainRef.current = new Gemma2LangChainEmbeddings(embedEngineRef.current)
  }
  if (vectorClientRef.current === null) vectorClientRef.current = new TargetVectorClient()

  const [isDark, setIsDark] = useState<boolean>(() => ThemeService.isDarkTheme())
  const [, setLangTick] = useState<number>(0)
  const [leftRatio, setLeftRatio] = useState<number>(SplitPaneGeometry.DEFAULT_RATIO)

  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [mirror, setMirror] = useState<boolean>(true)
  const [devices, setDevices] = useState<readonly CameraDeviceOption[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [resolution, setResolution] = useState<{ readonly w: number; readonly h: number }>({ w: 0, h: 0 })

  const [hasLocalModel, setHasLocalModel] = useState<boolean>(true)
  const [hostStorageStatus, setHostStorageStatus] = useState<ModelStatusResponse | null>(null)
  const [modelPhase, setModelPhase] = useState<ModelPhase>('idle')
  const [downloadPct, setDownloadPct] = useState<number>(0)
  const [downloadBytes, setDownloadBytes] = useState<{ readonly loaded: number; readonly total: number }>({ loaded: 0, total: 0 })
  const [modelSource, setModelSource] = useState<ModelLoadSource>('indexeddb')
  const [activeEp, setActiveEp] = useState<ExecutionProviderKind>('wasm')
  const [modelError, setModelError] = useState<string>('')
  const [embedPhase, setEmbedPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [embedPct, setEmbedPct] = useState<number>(0)
  const [embedEp, setEmbedEp] = useState<'webgpu' | 'wasm'>('wasm')
  const [embedError, setEmbedError] = useState<string>('')
  const [vectorStats, setVectorStats] = useState<{ readonly totalTargets: number; readonly totalVectors: number }>({
    totalTargets: 0,
    totalVectors: 0,
  })

  const [granularity, setGranularity] = useState<GranularityParams>(() => {
    return prefStoreRef.current?.loadLocal()?.granularity ?? GranularityFilter.fromPreset('coarse', false)
  })
  const [granularityCollapsed, setGranularityCollapsed] = useState<boolean>(() => {
    return prefStoreRef.current?.loadLocal()?.granularityCardCollapsed ?? false
  })
  const [savedPresets, setSavedPresets] = useState<readonly SavedPresetItem[]>(() => {
    return prefStoreRef.current?.loadLocal()?.savedPresets ?? []
  })
  const [showProbLabels, setShowProbLabels] = useState<boolean>(false)
  const [rawBoxes, setRawBoxes] = useState<readonly BoundingBox[]>([])
  const [inferMs, setInferMs] = useState<number>(0)
  const [fps, setFps] = useState<number>(0)
  const [tagModalItems, setTagModalItems] = useState<readonly CutoutPreviewItem[] | null>(null)
  const [dbModalOpen, setDbModalOpen] = useState<boolean>(false)
  const [dbLoading, setDbLoading] = useState<boolean>(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [dbRows, setDbRows] = useState<readonly VectorTableRow[]>([])
  const [matchThreshold, setMatchThreshold] = useState<number>(DEFAULT_MATCH_THRESHOLD)
  const [pocketItems, setPocketItems] = useState<readonly PocketItem[]>([])
  const [pocketOpen, setPocketOpen] = useState<boolean>(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [recognizedDetections, setRecognizedDetections] = useState<readonly RecognizedDetection[]>([])
  const keptRef = useRef<readonly BoundingBox[]>([])
  const matchThresholdRef = useRef<number>(matchThreshold)

  const locale = useMemo(() => new LocaleService(props.t), [props.t])

  useEffect(() => {
    ThemeService.applyStyles(isDark)
    return ThemeService.observeThemeChange(setIsDark)
  }, [isDark])

  useEffect(() => {
    return LocaleService.observeLanguageChange(() => setLangTick((v) => v + 1))
  }, [])

  useEffect(() => {
    let active = true
    void cacheStoreRef.current?.checkLocalAvailability().then((res) => {
      if (!active) return
      setHasLocalModel(res.hasLocalModel)
      if (res.hostStatus !== null) {
        setHostStorageStatus(res.hostStatus)
        setVectorStats({
          totalTargets: res.hostStatus.totalTargets,
          totalVectors: res.hostStatus.totalVectors,
        })
      }
    })
    if (prefStoreRef.current?.loadLocal() === null) {
      void prefStoreRef.current.loadFromHost().then((hostPrefs) => {
        if (active && hostPrefs !== null) {
          setGranularity(hostPrefs.granularity)
          setGranularityCollapsed(Boolean(hostPrefs.granularityCardCollapsed))
          setSavedPresets(hostPrefs.savedPresets ?? [])
        }
      })
    }
    return () => { active = false }
  }, [])

  const ensureModelReady = useCallback(async (): Promise<boolean> => {
    const engine = engineRef.current
    const cacheStore = cacheStoreRef.current
    if (!engine || !cacheStore) return false
    if (engine.isReady()) return true
    if (modelLoadPromiseRef.current !== null) return modelLoadPromiseRef.current

    const task = (async (): Promise<boolean> => {
      try {
        setModelError('')
        setModelPhase('checking')
        const cached = await cacheStore.getFromIndexedDb()
        let artifact: { buffer: ArrayBuffer; source: ModelLoadSource }
        if (cached !== null) {
          artifact = { buffer: cached, source: 'indexeddb' }
        } else {
          setModelPhase('downloading')
          setDownloadPct(0)
          artifact = await cacheStore.loadLazy((loaded, total) => {
            const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
            setDownloadPct(pct)
            setDownloadBytes({ loaded, total })
          })
        }
        setHasLocalModel(true)
        setModelSource(artifact.source)
        setModelPhase('initializing')
        const ep = await engine.initialize(artifact.buffer)
        setActiveEp(ep)
        setModelPhase('ready')
        return true
      } catch (err: unknown) {
        setModelError(err instanceof Error ? err.message : String(err))
        setModelPhase('error')
        return false
      } finally {
        modelLoadPromiseRef.current = null
      }
    })()

    modelLoadPromiseRef.current = task
    return task
  }, [])

  const ensureEmbeddingReady = useCallback(async (): Promise<boolean> => {
    const embedEngine = embedEngineRef.current
    if (!embedEngine) return false
    if (embedEngine.isReady()) return true
    if (embedLoadPromiseRef.current !== null) return embedLoadPromiseRef.current

    const task = (async (): Promise<boolean> => {
      try {
        setEmbedError('')
        setEmbedPhase('loading')
        setEmbedPct(0)
        const ep = await embedEngine.initialize((info) => {
          setEmbedPct(info.progress)
        })
        setEmbedEp(ep)
        setEmbedPhase('ready')
        return true
      } catch (err: unknown) {
        setEmbedError(err instanceof Error ? err.message : String(err))
        setEmbedPhase('error')
        return false
      } finally {
        embedLoadPromiseRef.current = null
      }
    })()

    embedLoadPromiseRef.current = task
    return task
  }, [])

  const handleUploadLocalOnnx = useCallback(async (file: File) => {
    const engine = engineRef.current
    const cacheStore = cacheStoreRef.current
    if (!engine || !cacheStore) return
    try {
      setModelError('')
      setModelPhase('initializing')
      const artifact = await cacheStore.loadFromLocalFile(file)
      setHasLocalModel(true)
      setModelSource(artifact.source)
      const ep = await engine.initialize(artifact.buffer)
      setActiveEp(ep)
      setModelPhase('ready')
    } catch (err: unknown) {
      setModelError(err instanceof Error ? err.message : String(err))
      setModelPhase('error')
    }
  }, [])

  const handleClearCache = useCallback(async () => {
    setRecognizedDetections([])
    await cacheStoreRef.current?.clearIndexedDb()
    await engineRef.current?.dispose()
    await Gemma2EmbeddingEngine.clearBrowserCache()
    await embedEngineRef.current?.dispose()
    await prefStoreRef.current?.clearAll()
    await vectorClientRef.current?.clearAll()
    setModelPhase('idle')
    setEmbedPhase('idle')
    setEmbedPct(0)
    setEmbedError('')
    setRawBoxes([])
    setInferMs(0)
    setFps(0)
    setVectorStats({ totalTargets: 0, totalVectors: 0 })
    setSavedPresets([])
    setGranularity(GranularityFilter.fromPreset('coarse', false))
    setGranularityCollapsed(false)
    setMatchThreshold(DEFAULT_MATCH_THRESHOLD)
    setPocketItems([])
    setPocketOpen(false)
    setMatchError(null)
    const avail = await cacheStoreRef.current?.checkLocalAvailability()
    if (avail) {
      setHasLocalModel(avail.hasLocalModel)
      if (avail.hostStatus !== null) {
        setHostStorageStatus(avail.hostStatus)
        setVectorStats({
          totalTargets: avail.hostStatus.totalTargets,
          totalVectors: avail.hostStatus.totalVectors,
        })
      }
    }
  }, [])

  const startCameraWithDevice = useCallback(async (deviceId?: string) => {
    const camera = cameraRef.current
    const video = videoRef.current
    if (!camera || !video) return
    try {
      setCameraError(null)
      await camera.start(video, deviceId || undefined)
      const available = await CameraController.listVideoDevices()
      setDevices(available)
      if (!deviceId && available.length > 0) {
        setSelectedDeviceId(available[0].deviceId)
      }
      setResolution({ w: video.videoWidth, h: video.videoHeight })
      setCameraActive(true)
      void ensureModelReady()
      void ensureEmbeddingReady()
    } catch (err: unknown) {
      setCameraActive(false)
      setCameraError(
        locale.translate('camera.permissionDenied', {
          message: err instanceof Error ? err.message : String(err),
        }),
      )
    }
  }, [ensureEmbeddingReady, ensureModelReady, locale])

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop(videoRef.current)
    setCameraActive(false)
    setRawBoxes([])
    setRecognizedDetections([])
    setFps(0)
    setInferMs(0)
  }, [])

  const handleToggleCamera = useCallback(() => {
    if (cameraActive) {
      stopCamera()
    } else {
      void startCameraWithDevice(selectedDeviceId || undefined)
    }
  }, [cameraActive, selectedDeviceId, startCameraWithDevice, stopCamera])

  const handleSelectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (cameraActive) {
      void startCameraWithDevice(deviceId)
    }
  }, [cameraActive, startCameraWithDevice])

  useEffect(() => {
    if (!cameraActive || modelPhase !== 'ready' || tagModalItems !== null) return
    let cancelled = false
    let timerId: number | null = null
    let lastTick = performance.now()

    const step = async (): Promise<void> => {
      if (cancelled) return
      const video = videoRef.current
      const engine = engineRef.current
      if (video && engine && engine.isReady() && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const out = await engine.detectFrame(video)
          if (!cancelled) {
            const now = performance.now()
            const dt = Math.max(1, now - lastTick)
            lastTick = now
            setResolution({ w: out.frameWidth, h: out.frameHeight })
            setRawBoxes(out.boxes)
            setInferMs(out.inferMs)
            setFps((prev) => (prev === 0 ? 1000 / dt : prev * 0.7 + (1000 / dt) * 0.3))
          }
        } catch {
          // Keep stream alive across transient frame errors
        }
      }
      if (!cancelled) {
        timerId = window.setTimeout(() => {
          void step()
        }, 40)
      }
    }

    void step()
    return () => {
      cancelled = true
      if (timerId !== null) window.clearTimeout(timerId)
    }
  }, [cameraActive, modelPhase, tagModalItems])

  const handleSelectInstance = useCallback((instance: BoundingBox) => {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return
    const frameCanvas = CutoutAugmenter.captureVideoFrame(video)
    const cutout = CutoutAugmenter.extractTransparentCutout(frameCanvas, instance)
    const previews = CutoutAugmenter.generateAugmentations(cutout)
    setTagModalItems(previews)
  }, [])

  useEffect(() => {
    const camera = cameraRef.current
    const video = videoRef.current
    const engine = engineRef.current
    const prefStore = prefStoreRef.current
    const embedEngine = embedEngineRef.current
    return () => {
      camera?.stop(video)
      void engine?.dispose()
      void embedEngine?.dispose()
      prefStore?.dispose()
    }
  }, [])

  const filterResult: GranularityFilterResult = useMemo(() => {
    const fw = resolution.w > 0 ? resolution.w : 1280
    const fh = resolution.h > 0 ? resolution.h : 720
    return GranularityFilter.filterBoxes(rawBoxes, fw, fh, granularity)
  }, [rawBoxes, resolution.w, resolution.h, granularity])

  keptRef.current = filterResult.kept
  matchThresholdRef.current = matchThreshold

  const trackedRecognizedDetections = useMemo(
    () => PocketCaptureManager.trackRecognizedBoxes(recognizedDetections, filterResult.kept),
    [recognizedDetections, filterResult.kept],
  )

  // Automatic continuous capture & vector matching while camera + both models + non-empty DB are active
  useEffect(() => {
    if (
      !cameraActive ||
      modelPhase !== 'ready' ||
      embedPhase !== 'ready' ||
      vectorStats.totalVectors <= 0 ||
      tagModalItems !== null ||
      dbModalOpen
    ) {
      return
    }
    let cancelled = false
    let timerId: number | null = null

    const captureAndMatch = async (): Promise<void> => {
      if (cancelled) return
      const video = videoRef.current
      const langChainEmbeddings = embedLangChainRef.current
      const vectorClient = vectorClientRef.current
      const kept = keptRef.current

      if (video && langChainEmbeddings && vectorClient && video.readyState >= 2 && video.videoWidth > 0 && kept.length > 0) {
        try {
          const frameCanvas = CutoutAugmenter.captureVideoFrame(video)
          const candidates = kept.slice(0, 8)
          const queryCutoutUrls: string[] = []
          const rawPocketUrls: string[] = []
          for (let i = 0; i < candidates.length; i += 1) {
            const cutoutCanvas = CutoutAugmenter.extractTransparentCutout(frameCanvas, candidates[i])
            queryCutoutUrls.push(cutoutCanvas.toDataURL('image/png'))
            const rawCropCanvas = CutoutAugmenter.extractRawBboxCrop(frameCanvas, candidates[i])
            rawPocketUrls.push(rawCropCanvas.toDataURL('image/png'))
          }
          const vectors = await langChainEmbeddings.embedImages(queryCutoutUrls)
          if (!cancelled && vectors.length > 0) {
            const searchRes = await vectorClient.searchMatches(vectors, matchThresholdRef.current)
            if (!cancelled) {
              setMatchError(null)
              const rawHits = searchRes.results.filter(
                (hit) => hit.matched && hit.targetId !== null && Boolean(rawPocketUrls[hit.index]),
              )
              let fallbackRows: readonly VectorTableRow[] | null = null
              if (rawHits.some((hit) => !hit.title || hit.title.trim().length === 0)) {
                try {
                  const listed = await vectorClient.listEntries()
                  fallbackRows = listed.entries ?? []
                } catch {
                  fallbackRows = []
                }
              }
              const matchedItems: PocketItem[] = []
              const liveRecognized: RecognizedDetection[] = []
              const nowTs = Date.now()
              for (let i = 0; i < rawHits.length; i += 1) {
                const hit = rawHits[i]
                const tid = hit.targetId as string
                let resolvedTitle = typeof hit.title === 'string' ? hit.title.trim() : ''
                if (resolvedTitle.length === 0 && fallbackRows !== null) {
                  const foundRow = fallbackRows.find(
                    (r) => r.targetId === tid || r.id.startsWith(tid + ':'),
                  )
                  if (foundRow && foundRow.title.trim().length > 0) {
                    resolvedTitle = foundRow.title.trim()
                  }
                }
                if (resolvedTitle.length === 0) continue
                const cand = candidates[hit.index]
                matchedItems.push({
                  targetId: tid,
                  title: resolvedTitle,
                  dataUrl: rawPocketUrls[hit.index],
                  capturedAt: nowTs,
                })
                if (cand) {
                  liveRecognized.push({
                    targetId: tid,
                    title: resolvedTitle,
                    x1: cand.x1,
                    y1: cand.y1,
                    x2: cand.x2,
                    y2: cand.y2,
                    colorIndex: cand.colorIndex,
                    recognizedAt: nowTs,
                  })
                }
              }
              setRecognizedDetections(liveRecognized)
              if (matchedItems.length > 0) {
                setPocketItems((prev) => PocketCaptureManager.mergeMatches(prev, matchedItems))
                setPocketOpen(true)
              }
            }
          }
        } catch (err: unknown) {
          if (!cancelled) {
            setMatchError(err instanceof Error ? err.message : String(err))
          }
        }
      }

      if (!cancelled) {
        timerId = window.setTimeout(() => {
          void captureAndMatch()
        }, 900)
      }
    }

    timerId = window.setTimeout(() => {
      void captureAndMatch()
    }, 450)

    return () => {
      cancelled = true
      if (timerId !== null) window.clearTimeout(timerId)
    }
  }, [cameraActive, dbModalOpen, embedPhase, modelPhase, tagModalItems, vectorStats.totalVectors])

  const modelMessage = useMemo(() => {
    if (modelPhase === 'idle') return locale.translate('model.idle')
    if (modelPhase === 'checking') return locale.translate('model.checking')
    if (modelPhase === 'downloading') {
      const loadedMb = (downloadBytes.loaded / (1024 * 1024)).toFixed(1)
      const totalMb = (downloadBytes.total / (1024 * 1024)).toFixed(1)
      return locale.translate('model.downloading', {
        pct: downloadPct,
        loaded: loadedMb,
        total: totalMb,
      })
    }
    if (modelPhase === 'initializing') {
      return locale.translate('model.initializing', { ep: activeEp.toUpperCase() })
    }
    if (modelPhase === 'ready') {
      return locale.translate('model.ready', {
        ep: activeEp.toUpperCase(),
        source: locale.translate('model.source.' + modelSource),
      })
    }
    return locale.translate('model.error', { message: modelError })
  }, [activeEp, downloadBytes.loaded, downloadBytes.total, downloadPct, locale, modelError, modelPhase, modelSource])

  const embedMessage = useMemo(() => {
    if (embedPhase === 'idle') return locale.translate('embed.idle')
    if (embedPhase === 'loading') return locale.translate('embed.loading', { pct: embedPct })
    if (embedPhase === 'ready') return locale.translate('embed.ready', { ep: embedEp.toUpperCase() })
    return locale.translate('embed.error', { message: embedError })
  }, [embedEp, embedError, embedPct, embedPhase, locale])

  const loadDatabaseEntries = useCallback(async (): Promise<void> => {
    const vectorClient = vectorClientRef.current
    if (!vectorClient) return
    setDbLoading(true)
    setDbError(null)
    try {
      const res = await vectorClient.listEntries()
      setDbRows(res.entries ?? [])
      setVectorStats({
        totalTargets: res.totalTargets,
        totalVectors: res.totalVectors,
      })
    } catch (err: unknown) {
      setDbError(err instanceof Error ? err.message : String(err))
    } finally {
      setDbLoading(false)
    }
  }, [])

  const handleClearVectorDb = useCallback(async (): Promise<void> => {
    await vectorClientRef.current?.clearAll()
    setVectorStats({ totalTargets: 0, totalVectors: 0 })
    setDbRows([])
    setMatchError(null)
    setRecognizedDetections([])
  }, [])

  const handleOpenDatabase = useCallback(() => {
    setDbModalOpen(true)
    void loadDatabaseEntries()
  }, [loadDatabaseEntries])

  const handleSaveTaggedTarget = useCallback(async (title: string, description: string): Promise<void> => {
    if (!tagModalItems || tagModalItems.length === 0) return
    const ok = await ensureEmbeddingReady()
    const langChainEmbeddings = embedLangChainRef.current
    const vectorClient = vectorClientRef.current
    if (!ok || !langChainEmbeddings || !vectorClient) {
      throw new Error(embedError || 'EmbeddingGemma 2 failed to initialize')
    }
    const vectors = await langChainEmbeddings.embedImages(tagModalItems.map((item) => item.dataUrl))
    const saved = await vectorClient.saveTaggedTarget({
      title,
      description,
      items: tagModalItems.map((item, idx) => ({
        imageKind: item.kind,
        vector: vectors[idx],
      })),
    })
    setVectorStats({
      totalTargets: saved.totalTargets,
      totalVectors: saved.totalVectors,
    })
    setTagModalItems(null)
  }, [embedError, ensureEmbeddingReady, tagModalItems])

  const rightRatio = Number((100 - leftRatio).toFixed(1))

  return (
    <div ref={workspaceRootRef} className="nt-root" data-conversation-composer-overlay="">
      <header className="nt-topbar">
        <div className="nt-brand">
          <span className="nt-brand-title">{locale.translate('workspace.title')}</span>
          <span className="nt-brand-sub">{locale.translate('workspace.subtitle')}</span>
        </div>
        <span className="nt-slider-badge">
          {locale.translate('split.ratio', { left: Math.round(leftRatio), right: Math.round(rightRatio) })}
        </span>
      </header>

      <div ref={splitContainerRef} className="nt-split-container">
        <div className="nt-pane-left" style={{ flex: '0 0 calc(' + leftRatio + '% - 7px)' }}>
          <CameraViewport
            videoRef={videoRef}
            canvasRef={canvasRef}
            cameraActive={cameraActive}
            cameraError={cameraError}
            mirror={mirror}
            resolution={resolution}
            filterResult={filterResult}
            showSuppressed={granularity.showSuppressed}
            showProbLabels={showProbLabels}
            recognizedDetections={trackedRecognizedDetections}
            modelStatusBadge={modelMessage}
            fps={fps}
            locale={locale}
            onSelectInstance={handleSelectInstance}
          />
        </div>

        <SplitPaneDivider
          containerRef={splitContainerRef}
          leftRatio={leftRatio}
          onRatioChange={setLeftRatio}
          title={locale.translate('split.handleTitle')}
        />

        <aside
          className="nt-pane-right"
          aria-label={locale.translate('panel.header')}
          style={{ flex: '1 1 0' }}
        >
          <CameraControlStrip
            cameraActive={cameraActive}
            mirror={mirror}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            hasLocalModel={hasLocalModel}
            modelPhase={modelPhase}
            downloadPct={downloadPct}
            modelMessage={modelMessage}
            embedPhase={embedPhase}
            embedPct={embedPct}
            embedMessage={embedMessage}
            hostStorageStatus={hostStorageStatus}
            vectorStats={vectorStats}
            matchThreshold={matchThreshold}
            matchError={matchError}
            onOpenPocket={() => setPocketOpen(true)}
            onMatchThresholdChange={(val) => setMatchThreshold(val)}
            locale={locale}
            onToggleCamera={handleToggleCamera}
            onToggleMirror={() => setMirror((m) => !m)}
            onOpenDatabase={handleOpenDatabase}
            onSelectDevice={handleSelectDevice}
            onPreloadModel={() => { void ensureModelReady(); void ensureEmbeddingReady() }}
            onUploadLocalOnnx={(file) => { void handleUploadLocalOnnx(file) }}
            onClearCache={() => { void handleClearCache() }}
            onClearVectorDb={() => { void handleClearVectorDb() }}
          />

          <GranularityCard
            params={granularity}
            collapsed={granularityCollapsed}
            showProbLabels={showProbLabels}
            savedPresets={savedPresets}
            keptCount={filterResult.kept.length}
            suppressedCount={filterResult.suppressed.length}
            filterMs={filterResult.durationMs}
            inferMs={inferMs}
            fps={fps}
            locale={locale}
            onChange={(nextParams) => {
              const unselected = savedPresets.map((item) => item.withSelected(false))
              setGranularity(nextParams)
              setSavedPresets(unselected)
              prefStoreRef.current?.saveWorkspace({
                granularity: nextParams,
                granularityCardCollapsed: granularityCollapsed,
                savedPresets: unselected
              })
            }}
            onToggleProbLabels={() => setShowProbLabels((prev) => !prev)}
            onSavePreset={() => {
              const nextIndex = savedPresets.length + 1
              const prefix = locale.translate('granularity.savedItemPrefix', { index: nextIndex })
              const summary = 'τ' + granularity.containmentThreshold.toFixed(2) + ' · ' + granularity.minAreaPercent.toFixed(1) + '% · ' + Math.round(granularity.confThreshold * 100) + '%'
              const entry = new SavedPresetItem({
                id: 'saved-' + Date.now() + '-' + nextIndex,
                text: prefix + ' (' + summary + ')',
                selected: true,
                settings: GranularitySettings.fromParams(granularity),
                savedAt: Date.now(),
              })
              const nextSaved = [...savedPresets.map((item) => item.withSelected(false)), entry]
              setSavedPresets(nextSaved)
              prefStoreRef.current?.saveWorkspace({
                granularity,
                granularityCardCollapsed: granularityCollapsed,
                savedPresets: nextSaved
              })
            }}
            onSelectSavedPreset={(presetId) => {
              const found = savedPresets.find((item) => item.id === presetId)
              if (!found) return
              const nextSaved = savedPresets.map((item) => item.withSelected(item.id === presetId))
              const nextParams = found.settings.toParams()
              setSavedPresets(nextSaved)
              setGranularity(nextParams)
              prefStoreRef.current?.saveWorkspace({
                granularity: nextParams,
                granularityCardCollapsed: granularityCollapsed,
                savedPresets: nextSaved
              })
            }}
            onRenameSavedPreset={(presetId, nextText) => {
              // Editing text keeps item.selected completely unchanged
              const nextSaved = savedPresets.map((item) => (item.id === presetId ? item.withText(nextText) : item))
              setSavedPresets(nextSaved)
              prefStoreRef.current?.saveWorkspace({
                granularity,
                granularityCardCollapsed: granularityCollapsed,
                savedPresets: nextSaved
              })
            }}
            onDeleteSavedPreset={(presetId) => {
              const nextSaved = savedPresets.filter((item) => item.id !== presetId)
              setSavedPresets(nextSaved)
              prefStoreRef.current?.saveWorkspace({
                granularity,
                granularityCardCollapsed: granularityCollapsed,
                savedPresets: nextSaved
              })
            }}
            onToggleCollapse={() => {
              setGranularityCollapsed((prev) => {
                const nextCollapsed = !prev
                prefStoreRef.current?.saveWorkspace({
                  granularity,
                  granularityCardCollapsed: nextCollapsed,
                  savedPresets
                })
                return nextCollapsed
              })
            }}
          />
        </aside>
      </div>

      <TargetTagModal
        open={tagModalItems !== null}
        items={tagModalItems ?? []}
        locale={locale}
        onSave={handleSaveTaggedTarget}
        onClose={() => setTagModalItems(null)}
      />

      <VectorDbModal
        open={dbModalOpen}
        loading={dbLoading}
        errorText={dbError}
        rows={dbRows}
        totalTargets={vectorStats.totalTargets}
        totalVectors={vectorStats.totalVectors}
        locale={locale}
        onRefresh={() => { void loadDatabaseEntries() }}
        onClose={() => setDbModalOpen(false)}
      />

      <PocketFloatingWindow
        open={pocketOpen}
        anchorRef={workspaceRootRef}
        items={pocketItems}
        locale={locale}
        onClose={() => setPocketOpen(false)}
      />
    </div>
  )
}
