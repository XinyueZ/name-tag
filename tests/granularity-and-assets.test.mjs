import assert from 'node:assert/strict'
import test from 'node:test'
import { GranularityFilter } from '../src/client/core/GranularityFilter.ts'
import { ColorPalette } from '../src/client/core/ColorPalette.ts'
import { TranslationCatalog } from '../src/client/T.js'
import { NameTagStyles } from '../src/client/S.js'

const SAMPLE_RAW_BOXES = [
  { id: 'car', x1: 52, y1: 72, x2: 298, y2: 172, score: 0.94, area: 246 * 100, colorIndex: 0 },
  { id: 'door', x1: 132, y1: 104, x2: 192, y2: 145, score: 0.56, area: 60 * 41, colorIndex: 1 },
  { id: 'handle', x1: 164, y1: 118, x2: 188, y2: 130, score: 0.34, area: 24 * 12, colorIndex: 2 },
  { id: 'person', x1: 410, y1: 66, x2: 562, y2: 274, score: 0.96, area: 152 * 208, colorIndex: 3 },
  { id: 'face', x1: 438, y1: 72, x2: 532, y2: 165, score: 0.78, area: 94 * 93, colorIndex: 4 },
  { id: 'glasses', x1: 450, y1: 99, x2: 520, y2: 122, score: 0.52, area: 70 * 23, colorIndex: 5 },
  { id: 'mouth', x1: 468, y1: 132, x2: 502, y2: 152, score: 0.28, area: 34 * 20, colorIndex: 6 },
  { id: 'mug', x1: 250, y1: 260, x2: 324, y2: 325, score: 0.85, area: 74 * 65, colorIndex: 7 },
]

test('GranularityFilter coarse preset suppresses nested parts and retains whole objects', () => {
  const coarse = GranularityFilter.fromPreset('coarse', true)
  const result = GranularityFilter.filterBoxes(SAMPLE_RAW_BOXES, 680, 420, coarse)
  const keptIds = result.kept.map((b) => b.id)
  assert.deepEqual(keptIds, ['person', 'car'])
  assert.ok(result.suppressed.some((b) => b.id === 'mouth'))
  assert.ok(result.suppressed.some((b) => b.id === 'handle'))
  assert.ok(result.suppressed.some((b) => b.id === 'face'))
})

test('GranularityFilter fine preset retains smaller objects and nested parts', () => {
  const fine = GranularityFilter.fromPreset('fine', false)
  const result = GranularityFilter.filterBoxes(SAMPLE_RAW_BOXES, 680, 420, fine)
  const keptIds = result.kept.map((b) => b.id)
  assert.ok(keptIds.includes('person'))
  assert.ok(keptIds.includes('car'))
  assert.ok(keptIds.includes('mug'))
})

test('GranularityFilter comprehensive slider maps deterministically', () => {
  const p0 = GranularityFilter.fromComprehensive(0, false)
  const p100 = GranularityFilter.fromComprehensive(100, true)
  assert.equal(p0.containmentThreshold, 0.6)
  assert.equal(p0.minAreaPercent, 3.4)
  assert.equal(p0.confThreshold, 0.55)
  assert.equal(p100.containmentThreshold, 0.96)
  assert.equal(p100.minAreaPercent, 0.3)
  assert.equal(p100.confThreshold, 0.2)
})

test('GranularityFilter uses mask overlap rather than box overlap when masks are present', () => {
  // Two non-overlapping pixel masks whose bounding boxes overlap completely
  const mParent = new Uint8Array(100)
  const mChild = new Uint8Array(100)
  for (let i = 0; i < 40; i += 1) mParent[i] = 1
  for (let i = 60; i < 80; i += 1) mChild[i] = 1
  const instances = [
    { id: 'p', x1: 0, y1: 0, x2: 100, y2: 100, score: 0.9, area: 10000, colorIndex: 0, maskWidth: 10, maskHeight: 10, maskData: mParent, maskArea: 4000 },
    { id: 'c', x1: 10, y1: 10, x2: 90, y2: 90, score: 0.6, area: 6400, colorIndex: 1, maskWidth: 10, maskHeight: 10, maskData: mChild, maskArea: 2000 },
  ]
  const res = GranularityFilter.filterBoxes(instances, 100, 100, GranularityFilter.fromPreset('coarse', false))
  assert.deepEqual(res.kept.map((x) => x.id), ['p', 'c'])
})

test('TranslationCatalog ZH and EN dictionaries have identical key sets', () => {
  const { zh, en } = TranslationCatalog.getDictionaries()
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(zhKeys, enKeys)
  assert.equal(zh['tab.label'], 'Name Tag')
  assert.equal(zh['granularity.cardTitle'], '“颗粒度”实时调控面板')
})

test('NameTagStyles and ColorPalette produce valid MD3 CSS and distinct colors', () => {
  const darkCss = NameTagStyles.buildStyleSheet(true)
  const lightCss = NameTagStyles.buildStyleSheet(false)
  assert.match(darkCss, /\.nt-divider-pill/)
  assert.match(darkCss, /\.nt-icon-btn/)
  assert.match(darkCss, /\.nt-aug-grid/)
  assert.match(darkCss, /\.nt-modal-dialog/)
  assert.match(darkCss, /\.nt-preset-select/)
  assert.match(darkCss, /\.nt-dropdown-del-btn/)
  assert.match(darkCss, /\.nt-dropdown-check-btn\.is-checked/)
  assert.match(darkCss, /\.nt-dropdown-edit-input/)
  assert.match(darkCss, /\.nt-inline-switch/)
  assert.match(darkCss, /\.nt-modal-columns/)
  assert.match(darkCss, /\.nt-md-textarea/)
  assert.match(darkCss, /\.nt-storage-paths/)
  assert.match(darkCss, /\.nt-storage-toggle/)
  assert.match(darkCss, /\.nt-db-table/)
  assert.match(darkCss, /\.nt-db-col-resizer/)
  assert.match(darkCss, /\.nt-db-th-sort-btn/)
  assert.match(darkCss, /\.nt-pocket-window/)
  assert.match(darkCss, /\.nt-pocket-header/)
  assert.match(darkCss, /\.nt-pocket-item-title/)
  assert.match(darkCss, /\.nt-btn-danger-outlined/)
  assert.match(lightCss, /\.nt-md-card/)
  assert.notEqual(ColorPalette.strokeFor(0), ColorPalette.strokeFor(1))
})
