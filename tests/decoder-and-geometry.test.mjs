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
  assert.equal(PocketCaptureManager.trackRecognizedBoxes(tracked, []).length, 0)
})

test('BrowserTargetVectorRepository stores 6 vectors via LangChain VectorStore, searches by cosine similarity, and clears cleanly', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { BrowserTargetVectorRepository, IndexedDbLangChainVectorStore, Gemma2EmbeddingEngine, Gemma2LangChainEmbeddings } = clientExports
  const embeddings = new Gemma2LangChainEmbeddings(new Gemma2EmbeddingEngine())
  const repo = new BrowserTargetVectorRepository(embeddings)
  assert.ok(repo.getVectorStore() instanceof IndexedDbLangChainVectorStore)

  await assert.rejects(
    () => repo.saveTaggedTarget({ title: '  ', description: 'desc', items: [] }),
    /Title and description are both required/,
  )

  const kinds = ['original', 'flip', 'scale', 'color', 'rotate', 'blur']
  const items = kinds.map((kind, idx) => {
    const vec = new Array(768).fill(0)
    vec[idx] = 1
    return { imageKind: kind, vector: vec }
  })
  const saved = await repo.saveTaggedTarget({ title: 'Ceramic Mug', description: 'White coffee mug', items })
  assert.equal(saved.insertedCount, 6)
  assert.equal(saved.totalTargets, 1)
  assert.equal(saved.totalVectors, 6)

  const qMatch = new Array(768).fill(0)
  qMatch[0] = 1
  const qMiss = new Array(768).fill(0)
  qMiss[200] = 1
  const search = await repo.searchMatches([qMatch, qMiss], 0.78)
  assert.equal(search.results[0].matched, true)
  assert.equal(search.results[0].title, 'Ceramic Mug')
  assert.equal(search.results[0].similarity, 1)
  assert.equal(search.results[1].matched, false)
  assert.equal(search.results[1].title, null)

  const listed = await repo.listEntries()
  assert.equal(listed.entries.length, 6)
  assert.equal(listed.entries[0].augmentation, 'original')
  assert.equal(listed.entries[3].augmentation, 'color')

  await repo.clearAll()
  const afterClear = await repo.getStats()
  assert.equal(afterClear.totalTargets, 0)
  assert.equal(afterClear.totalVectors, 0)
})

test('CutoutAugmenter.dilateBinaryMask expands foreground mask by 1px and ObjectCropTracker buffers sharpest crop across stable frames', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { CutoutAugmenter, ObjectCropTracker } = clientExports
  const mask = new Uint8Array(25)
  mask[12] = 1
  const dilated = CutoutAugmenter.dilateBinaryMask(mask, 5, 5)
  let count = 0
  for (let i = 0; i < dilated.length; i += 1) count += dilated[i]
  assert.equal(count, 9)

  const tracker = new ObjectCropTracker()
  const box = { id: 'b1', x1: 100, y1: 100, x2: 300, y2: 300, score: 0.9, area: 40000, colorIndex: 0 }
  let seq = 0
  const qualities = [10, 85, 30]
  for (let f = 0; f < 3; f += 1) {
    const idx = f
    tracker.updateFrame(null, [box], 640, 480, 10_000 + f * 100, () => qualities[idx], () => {
      seq += 1
      return { queryCutoutUrl: 'q-' + idx, rawPocketUrl: 'r-' + idx }
    })
    if (f < 2) {
      assert.equal(tracker.collectDueTracks(10_000 + f * 100).length, 0)
    }
  }
  const due = tracker.collectDueTracks(10_300)
  assert.equal(due.length, 1)
  assert.equal(due[0].queryCutoutUrl, 'q-1')
  assert.equal(seq, 2)
})

test('CameraScopeCollection includes immutable All & Human Face, supports continuous add, rename, delete, and PreferencesStore persistence', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { CameraScopeCollection, CameraScopeItem, PreferencesStore } = clientExports
  const zhLabels = { all: '所有', humanFace: '人脸' }
  const enLabels = { all: 'All', humanFace: 'Human Face' }

  const initial = CameraScopeCollection.createDefault()
  assert.equal(initial.selectedId, CameraScopeItem.ALL_ID)
  const initialItems = initial.getAllItems(zhLabels)
  assert.equal(initialItems.length, 2)
  assert.equal(initialItems[0].id, 'all')
  assert.equal(initialItems[0].text, '所有')
  assert.equal(initialItems[0].editable, false)
  assert.equal(initialItems[0].isBuiltIn, true)
  assert.equal(initialItems[1].id, 'human-face')
  assert.equal(initialItems[1].text, '人脸')
  assert.equal(initialItems[1].editable, false)
  assert.equal(initialItems[1].isBuiltIn, true)

  // Built-in 'all' and 'human-face' cannot be edited or deleted
  assert.equal(initial.renameItem('all', 'Hacked', zhLabels).getSelectedItem(zhLabels).text, '所有')
  assert.equal(initial.removeItem('all').getAllItems(zhLabels).length, 2)
  assert.equal(initial.renameItem('human-face', 'OtherFace', zhLabels).getAllItems(zhLabels)[1].text, '人脸')
  assert.equal(initial.removeItem('human-face').getAllItems(zhLabels).length, 2)
  assert.equal(initialItems[0].withText('Other').text, '所有')
  assert.equal(initialItems[1].withText('Other').text, '人脸')

  // Selecting built-in Human Face works in both ZH and EN
  const selectedFace = initial.selectItem(CameraScopeItem.HUMAN_FACE_ID)
  assert.equal(selectedFace.selectedId, 'human-face')
  assert.equal(selectedFace.getSelectedItem(zhLabels).text, '人脸')
  assert.equal(selectedFace.getSelectedItem(enLabels).text, 'Human Face')

  // Continuous additions grow list unboundedly while rejecting blank/duplicate/reserved
  assert.equal(initial.addItem('   ', zhLabels).status, 'empty')
  assert.equal(initial.addItem('所有', zhLabels).status, 'reserved-builtin')
  assert.equal(initial.addItem('All', enLabels).status, 'reserved-builtin')
  assert.equal(initial.addItem('人脸', zhLabels).status, 'reserved-builtin')
  assert.equal(initial.addItem('human face', enLabels).status, 'reserved-builtin')

  const r1 = initial.addItem('水杯', zhLabels)
  assert.equal(r1.status, 'added')
  assert.ok(r1.addedItem && r1.addedItem.editable === true)
  const r2 = r1.collection.addItem('耳机', zhLabels)
  assert.equal(r2.status, 'added')
  const r3 = r2.collection.addItem('Keyboard', enLabels)
  assert.equal(r3.status, 'added')
  const dup = r3.collection.addItem('keyboard', enLabels)
  assert.equal(dup.status, 'duplicate')
  assert.equal(r3.collection.getAllItems(zhLabels).length, 5)
  assert.equal(r3.collection.selectedId, 'all')

  // Select, rename, and delete custom items (deleting active resets to 'all')
  const cupId = r1.addedItem.id
  const selected = r3.collection.selectItem(cupId)
  assert.equal(selected.selectedId, cupId)
  assert.equal(selected.getSelectedItem(zhLabels).text, '水杯')
  const renamed = selected.renameItem(cupId, '保温杯', zhLabels)
  assert.equal(renamed.getSelectedItem(zhLabels).text, '保温杯')
  const afterDelete = renamed.removeItem(cupId)
  assert.equal(afterDelete.selectedId, 'all')
  assert.equal(afterDelete.getSelectedItem(zhLabels).text, '所有')
  assert.equal(afterDelete.customItems.length, 2)

  // Persistence sanitization via PreferencesStore
  const sanitized = PreferencesStore.sanitizePreferences({
    granularity: {
      preset: 'coarse',
      comprehensive: 25,
      containmentThreshold: 0.7,
      minAreaPercent: 2.0,
      confThreshold: 0.45,
      showSuppressed: false,
    },
    cameraScopes: {
      selectedId: 'human-face',
      customItems: [
        { id: 'all', text: 'FakeAll', editable: true },
        { id: 'human-face', text: 'FakeFace', editable: true },
        { id: r2.addedItem.id, text: '耳机', editable: true },
        { id: 'blank', text: '   ', editable: true },
        { id: 'res1', text: 'all', editable: true },
        { id: 'res2', text: 'Human Face', editable: true },
      ],
    },
  })
  assert.equal(sanitized.cameraScopes.selectedId, 'human-face')
  assert.equal(sanitized.cameraScopes.customItems.length, 1)
  assert.equal(sanitized.cameraScopes.customItems[0].text, '耳机')
})

test('CameraTipsScheduler shows for 5s on camera start and repeats every 60s until stopped', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { CameraTipsScheduler } = clientExports
  assert.equal(CameraTipsScheduler.VISIBLE_DURATION_MS, 5000)
  assert.equal(CameraTipsScheduler.REPEAT_INTERVAL_MS, 60000)

  let nextHandle = 1
  const timeouts = new Map()
  const intervals = new Map()
  const events = []

  const fakeTimers = {
    setTimeout(cb, ms) {
      const id = nextHandle++
      timeouts.set(id, { cb, ms })
      return id
    },
    clearTimeout(id) {
      timeouts.delete(id)
    },
    setInterval(cb, ms) {
      const id = nextHandle++
      intervals.set(id, { cb, ms })
      return id
    },
    clearInterval(id) {
      intervals.delete(id)
    },
  }

  const scheduler = new CameraTipsScheduler((visible) => events.push(visible), fakeTimers)
  scheduler.start()
  assert.deepEqual(events, [true])
  assert.equal(timeouts.size, 1)
  assert.equal(intervals.size, 1)
  assert.equal([...timeouts.values()][0].ms, 5000)
  assert.equal([...intervals.values()][0].ms, 60000)

  // Fire 5s hide timer
  const firstHide = [...timeouts.entries()][0]
  timeouts.delete(firstHide[0])
  firstHide[1].cb()
  assert.deepEqual(events, [true, false])

  // Fire 60s repeat tick -> shows again and schedules another 5s hide timer
  const repeatEntry = [...intervals.values()][0]
  repeatEntry.cb()
  assert.deepEqual(events, [true, false, true])
  assert.equal(timeouts.size, 1)
  const secondHide = [...timeouts.entries()][0]
  timeouts.delete(secondHide[0])
  secondHide[1].cb()
  assert.deepEqual(events, [true, false, true, false])

  // Stop clears all timers and hides immediately
  scheduler.stop()
  assert.equal(timeouts.size, 0)
  assert.equal(intervals.size, 0)
  assert.equal(events[events.length - 1], false)

  // Restarting camera immediately pops tips again
  scheduler.start()
  assert.equal(events[events.length - 1], true)
  assert.equal(timeouts.size, 1)
  assert.equal(intervals.size, 1)
  scheduler.dispose()
  assert.equal(timeouts.size, 0)
  assert.equal(intervals.size, 0)
})

test('SplitPaneGeometry clamps split ratio within [26, 74]', async () => {
  const clientExports = await loadBuiltClientBundle()
  const { SplitPaneGeometry } = clientExports
  assert.equal(SplitPaneGeometry.clampRatio(5), 26)
  assert.equal(SplitPaneGeometry.clampRatio(95), 74)
  assert.equal(SplitPaneGeometry.clampRatio(50), 50)
})
