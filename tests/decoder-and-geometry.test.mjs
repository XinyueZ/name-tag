import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'

async function loadBuiltClientBundle() {
  const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let registered = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(entry) {
          registered = entry
        },
      },
    },
    globalThis: undefined,
    self: undefined,
    performance,
    URL,
    TextEncoder,
    TextDecoder,
    AbortController,
    AbortSignal,
    fetch: async () => new Response(),
    ReadableStream,
    Request,
    Response,
    Headers,
    console,
    setTimeout,
    clearTimeout,
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox
  vm.runInNewContext(code, sandbox)
  assert.ok(registered, 'ModuleLoader entry should register')
  return registered.factory((id) => {
    if (id === 'react') return React
    if (id === 'react/jsx-runtime') return jsxRuntime
    throw new Error('Unexpected require in browser bundle: ' + id)
  })
}

test('Built lib/client.js loads cleanly in ModuleLoader and registers conversation.view slot', async () => {
  const clientExports = await loadBuiltClientBundle()
  assert.equal(clientExports.name, '@deepseek-ai/dsh-client-name-tag/client')
  assert.equal(typeof clientExports.apply, 'function')

  const registeredSlots = []
  const registeredLocales = []
  const fakeCtx = {
    effect(fn) { fn() },
    locale: {
      register(ns, dicts) { registeredLocales.push({ ns, dicts }); return () => {} },
      bind() { return (k) => k },
    },
    slots: {
      inject(name, factory) { factory() },
      register(opts, comp) { registeredSlots.push({ opts, comp }); return () => {} },
    },
  }
  clientExports.apply(fakeCtx)
  assert.equal(registeredLocales.length, 1)
  assert.equal(registeredLocales[0].ns, 'name.tag')
  assert.equal(registeredSlots.length, 1)
  assert.equal(registeredSlots[0].opts.name, 'conversation.view')
  assert.equal(registeredSlots[0].opts.id, 'name-tag')
  assert.equal(registeredSlots[0].opts.order, 999)
})

test('FastSamInferenceEngine.decodePredictions synthesizes prototype segmentation masks and applies NMS', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { FastSamInferenceEngine } = clientExports
  const numChannels = 37
  const numAnchors = 8400
  const raw = new Float32Array(numChannels * numAnchors)

  raw[0 * numAnchors + 10] = 320
  raw[1 * numAnchors + 10] = 320
  raw[2 * numAnchors + 10] = 200
  raw[3 * numAnchors + 10] = 100
  raw[4 * numAnchors + 10] = 0.91
  raw[5 * numAnchors + 10] = 1.0

  raw[0 * numAnchors + 11] = 322
  raw[1 * numAnchors + 11] = 321
  raw[2 * numAnchors + 11] = 198
  raw[3 * numAnchors + 11] = 98
  raw[4 * numAnchors + 11] = 0.60
  raw[5 * numAnchors + 11] = 1.0

  raw[0 * numAnchors + 25] = 120
  raw[1 * numAnchors + 25] = 180
  raw[2 * numAnchors + 25] = 80
  raw[3 * numAnchors + 25] = 60
  raw[4 * numAnchors + 25] = 0.77
  raw[5 * numAnchors + 25] = 1.0

  const protoH = 160
  const protoW = 160
  const protoData = new Float32Array(32 * protoH * protoW)
  for (let i = 0; i < protoH * protoW; i += 1) protoData[i] = 1.0

  const letterbox = { scale: 0.5, padLeft: 0, padTop: 140, newW: 640, newH: 360, targetSize: 640 }
  const decoded = FastSamInferenceEngine.decodePredictions(
    raw,
    [1, 37, 8400],
    letterbox,
    1280,
    720,
    0.15,
    0.70,
    80,
    { data: protoData, dims: [1, 32, protoH, protoW] },
  )

  assert.equal(decoded.length, 2)
  assert.equal(Math.round(decoded[0].x1), 440)
  assert.equal(Math.round(decoded[0].y1), 260)
  assert.equal(Math.round(decoded[0].x2), 840)
  assert.equal(Math.round(decoded[0].y2), 460)
  assert.ok(Math.abs(decoded[0].score - 0.91) < 1e-4)
  assert.equal(decoded[0].maskWidth, 160)
  assert.equal(decoded[0].maskHeight, 90)
  assert.ok(ArrayBuffer.isView(decoded[0].maskData) && decoded[0].maskData.constructor.name === 'Uint8Array')
  assert.ok(decoded[0].maskArea > 0)
})

test('PreferencesStore sanitizes out-of-range values and persists to localStorage', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { PreferencesStore } = clientExports
  const cleaned = PreferencesStore.sanitizePreferences({
    granularity: {
      preset: 'unknown',
      comprehensive: 999,
      containmentThreshold: 1.5,
      minAreaPercent: 150,
      confThreshold: 1.25,
      showSuppressed: 1,
    },
    granularityCardCollapsed: 'yes',
    savedPresets: [
      { id: 'p1', name: 'My Custom', params: { preset: 'custom', comprehensive: 50, containmentThreshold: 0.8, minAreaPercent: 2.0, confThreshold: 0.4, showSuppressed: false }, savedAt: 12345 },
      { id: 'bad', name: 'Broken', params: null },
    ],
  })
  assert.equal(cleaned.granularity.preset, 'custom')
  assert.equal(cleaned.granularity.comprehensive, 100)
  assert.equal(cleaned.granularity.containmentThreshold, 1.0)
  assert.equal(cleaned.granularity.minAreaPercent, 100.0)
  assert.equal(cleaned.granularity.confThreshold, 1.0)
  assert.equal(cleaned.granularity.showSuppressed, true)
  assert.equal(cleaned.granularityCardCollapsed, true)
  assert.equal(cleaned.savedPresets.length, 1)
  assert.equal(cleaned.savedPresets[0].text, 'My Custom')
  assert.equal(cleaned.savedPresets[0].selected, false)
  const zeroed = PreferencesStore.sanitizeGranularity({
    preset: 'custom',
    comprehensive: -5,
    containmentThreshold: -0.2,
    minAreaPercent: -1,
    confThreshold: -0.1,
    showSuppressed: false,
  })
  assert.equal(zeroed.containmentThreshold, 0)
  assert.equal(zeroed.minAreaPercent, 0)
  assert.equal(zeroed.confThreshold, 0)
})

test('CutoutAugmenter.computeCropBounds clamps padding safely within video bounds', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { CutoutAugmenter } = clientExports
  const crop = CutoutAugmenter.computeCropBounds({ x1: 5, y1: 10, x2: 105, y2: 110 }, 200, 150, 0.1)
  assert.equal(crop.x, 0)
  assert.equal(crop.y, 0)
  assert.equal(crop.w, 115)
  assert.equal(crop.h, 120)
})

test('SavedPresetItem holds GranularitySettings instance and preserves selected when renaming text', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { SavedPresetItem, GranularitySettings } = clientExports
  const settings = new GranularitySettings({
    preset: 'custom',
    comprehensive: 40,
    containmentThreshold: 0.75,
    minAreaPercent: 1.5,
    confThreshold: 0.42,
    showSuppressed: false,
  })
  const itemUnselected = new SavedPresetItem({
    id: 'item-1',
    text: 'Initial',
    selected: false,
    settings,
    savedAt: 1000,
  })
  assert.ok(itemUnselected.settings instanceof GranularitySettings)
  const renamedUnselected = itemUnselected.withText('Edited Name')
  assert.equal(renamedUnselected.text, 'Edited Name')
  assert.equal(renamedUnselected.selected, false)
  const selectedItem = renamedUnselected.withSelected(true).withText('Selected & Renamed')
  assert.equal(selectedItem.text, 'Selected & Renamed')
  assert.equal(selectedItem.selected, true)
})

test('Gemma2EmbeddingEngine normalizes vectors and wraps LangChain Embeddings interface', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { Gemma2EmbeddingEngine, Gemma2LangChainEmbeddings } = clientExports
  const normed = Gemma2EmbeddingEngine.l2Normalize([3, 4, 0])
  assert.ok(Math.abs(normed[0] - 0.6) < 1e-6)
  assert.ok(Math.abs(normed[1] - 0.8) < 1e-6)
  const engine = new Gemma2EmbeddingEngine()
  const lc = new Gemma2LangChainEmbeddings(engine)
  assert.equal(typeof lc.embedDocuments, 'function')
  assert.equal(typeof lc.embedQuery, 'function')
  assert.equal(typeof lc.embedImages, 'function')
})

test('VectorTableFormatter formats 5-head ... 5-tail preview and clamps column widths', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { VectorTableFormatter } = clientExports
  const formatted = VectorTableFormatter.formatVectorPreview(
    [0.1, 0.2, 0.3, 0.4, 0.5],
    [0.6, 0.7, 0.8, 0.9, 1.0],
  )
  assert.equal(formatted, '[0.1000, 0.2000, 0.3000, 0.4000, 0.5000, ..., 0.6000, 0.7000, 0.8000, 0.9000, 1.0000]')
  assert.equal(VectorTableFormatter.clampColumnWidth(20), 100)
  assert.equal(VectorTableFormatter.clampColumnWidth(999), 760)
  assert.equal(VectorTableFormatter.formatTimestamp(0), '—')
  assert.match(VectorTableFormatter.formatTimestamp(1794930150779), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  const sampleRows = [
    { id: '1', vectorHead: [], vectorTail: [], vectorDim: 768, imageKind: 'original', augmentation: 'original', title: 'A', description: 'a', createdAt: 100 },
    { id: '2', vectorHead: [], vectorTail: [], vectorDim: 768, imageKind: 'flip', augmentation: 'flip', title: 'B', description: 'b', createdAt: 300 },
    { id: '3', vectorHead: [], vectorTail: [], vectorDim: 768, imageKind: 'blur', augmentation: 'blur', title: 'B', description: 'b', createdAt: 300 },
  ]
  assert.deepEqual(VectorTableFormatter.sortRowsByTimestamp(sampleRows, 'desc').map((r) => r.id), ['2', '3', '1'])
  assert.deepEqual(VectorTableFormatter.sortRowsByTimestamp(sampleRows, 'asc').map((r) => r.id), ['1', '2', '3'])
})

test('PocketCaptureManager deduplicates by targetId and clamps floating window position', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { PocketCaptureManager } = clientExports
  const initial = [{ targetId: 't1', title: 'Mug', dataUrl: 'data:image/png;base64,a', capturedAt: 1 }]
  const merged = PocketCaptureManager.mergeMatches(initial, [
    { targetId: 't1', title: 'Mug', dataUrl: 'data:image/png;base64,dup', capturedAt: 2 },
    { targetId: 't2', title: 'Bottle', dataUrl: 'data:image/png;base64,b', capturedAt: 3 },
  ])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].dataUrl, 'data:image/png;base64,a')
  assert.equal(merged[1].targetId, 't2')
  const pos = PocketCaptureManager.clampPosition(-50, 9999, 1000, 700)
  assert.equal(pos.x, 8)
  assert.equal(pos.y, 580)
  const centered = PocketCaptureManager.computeCenteredPosition(
    { left: 260, top: 48, width: 1000, height: 700 },
    1400,
    800,
  )
  assert.equal(centered.x, 684)
  assert.equal(centered.y, 233)
  const tracked = PocketCaptureManager.trackRecognizedBoxes(
    [{ targetId: 't1', title: 'Xinyue', x1: 100, y1: 100, x2: 200, y2: 200, colorIndex: 0, recognizedAt: 1 }],
    [{ id: 'seg-1', x1: 105, y1: 102, x2: 205, y2: 202, score: 0.9, area: 10000, colorIndex: 2 }],
  )
  assert.equal(tracked[0].title, 'Xinyue')
  assert.equal(tracked[0].x1, 105)
})

test('SplitPaneGeometry clamps split ratio within [26, 74]', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { SplitPaneGeometry } = clientExports
  assert.equal(SplitPaneGeometry.clampRatio(5), 26)
  assert.equal(SplitPaneGeometry.clampRatio(95), 74)
  assert.equal(SplitPaneGeometry.clampRatio(50), 50)
})
