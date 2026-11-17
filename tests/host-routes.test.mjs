import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as nameTagPlugin from '../lib/index.js'
import { API_MODEL_PATH, API_MODEL_STATUS_PATH, API_ORT_PREFIX, API_PREFERENCES_PATH, API_VECTORS_PATH, API_VECTOR_SEARCH_PATH, EMBEDDING_DIM } from '../lib/invariant.js'
import { PrecomputedLangChainEmbeddings, TargetVectorRepository } from '../src/vector-store.ts'

test('NameTagHostServer serves ORT assets and local FastSAM-s cache without remote download', async () => {
  const prevHome = process.env.DSH_HOME
  const tempHome = await mkdtemp(join(tmpdir(), 'dsh-name-tag-test-'))
  process.env.DSH_HOME = tempHome

  const routes = new Map()
  const ctx = new Context()
  ctx.provide('connection', {
    fetch: {
      register(route) {
        routes.set(route.path, route)
        return () => { routes.delete(route.path) }
      },
    },
  })

  const fiber = ctx.plugin(nameTagPlugin)
  await fiber.await()

  try {
    const statusRoute = routes.get(API_MODEL_STATUS_PATH)
    const modelRoute = routes.get(API_MODEL_PATH)
    const ortWasmRoute = routes.get(API_ORT_PREFIX + 'ort-wasm-simd-threaded.jsep.wasm')
    const ortMjsRoute = routes.get(API_ORT_PREFIX + 'ort-wasm-simd-threaded.jsep.mjs')

    assert.ok(statusRoute, 'model status route should be registered')
    assert.ok(modelRoute, 'model lazy-load route should be registered')
    assert.ok(ortWasmRoute, 'ort jsep wasm route should be registered')
    assert.ok(ortMjsRoute, 'ort jsep mjs route should be registered')

    // 1. Status initially reports exists: false when cache is empty
    const st1 = await (await statusRoute.fetch(new Request('http://localhost' + API_MODEL_STATUS_PATH))).json()
    assert.equal(st1.exists, false)
    assert.equal(st1.cacheDir, join(tempHome, 'cache', 'name-tag'))
    assert.equal(st1.cachePath, join(tempHome, 'cache', 'name-tag', 'FastSAM-s.onnx'))
    assert.equal(st1.preferencesPath, join(tempHome, 'cache', 'name-tag', 'preferences.json'))

    // 2. HEAD /api/name-tag/model returns 404 when missing (no download triggered)
    const headMissing = await modelRoute.fetch(new Request('http://localhost' + API_MODEL_PATH, { method: 'HEAD' }))
    assert.equal(headMissing.status, 404)

    // 3. Populate local cache file and verify status + GET hit local-disk
    const cacheDir = join(tempHome, 'cache', 'name-tag')
    await mkdir(cacheDir, { recursive: true })
    await writeFile(join(cacheDir, 'FastSAM-s.onnx'), Buffer.from('fake-onnx-bytes'))

    const st2 = await (await statusRoute.fetch(new Request('http://localhost' + API_MODEL_STATUS_PATH))).json()
    assert.equal(st2.exists, true)
    assert.equal(st2.sizeBytes, 15)

    const getHit = await modelRoute.fetch(new Request('http://localhost' + API_MODEL_PATH, { method: 'GET' }))
    assert.equal(getHit.status, 200)
    assert.equal(getHit.headers.get('x-nametag-model-source'), 'local-disk')
    assert.equal(await getHit.text(), 'fake-onnx-bytes')

    // 4. Verify preferences route GET/PUT persistence on disk
    const prefRoute = routes.get(API_PREFERENCES_PATH)
    assert.ok(prefRoute, 'preferences route should be registered')
    const prefEmpty = await (await prefRoute.fetch(new Request('http://localhost' + API_PREFERENCES_PATH))).json()
    assert.equal(prefEmpty, null)
    const samplePref = { granularity: { preset: 'fine', comprehensive: 88, containmentThreshold: 0.92, minAreaPercent: 0.4, confThreshold: 0.22, showSuppressed: true }, granularityCardCollapsed: true, savedPresets: [{ id: 's1', text: 'Desk Preset', selected: true, settings: { preset: 'fine', comprehensive: 88, containmentThreshold: 0.92, minAreaPercent: 0.4, confThreshold: 0.22, showSuppressed: true }, savedAt: 1000 }] }
    const putRes = await prefRoute.fetch(new Request('http://localhost' + API_PREFERENCES_PATH, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(samplePref),
    }))
    assert.equal(putRes.status, 200)
    const prefSaved = await (await prefRoute.fetch(new Request('http://localhost' + API_PREFERENCES_PATH))).json()
    assert.deepEqual(prefSaved, samplePref)
    const delRes = await prefRoute.fetch(new Request('http://localhost' + API_PREFERENCES_PATH, { method: 'DELETE' }))
    assert.equal(delRes.status, 200)
    const prefAfterDelete = await (await prefRoute.fetch(new Request('http://localhost' + API_PREFERENCES_PATH))).json()
    assert.equal(prefAfterDelete, null)

    // 5. Verify LangChain + FAISS vector store POST/GET/persistence/DELETE
    const vectorsRoute = routes.get(API_VECTORS_PATH)
    assert.ok(vectorsRoute, 'vectors route should be registered')

    const badSave = await vectorsRoute.fetch(new Request('http://localhost' + API_VECTORS_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '  ', description: 'desc', items: [] }),
    }))
    assert.equal(badSave.status, 400)

    const kinds = ['original', 'flip', 'scale', 'color', 'rotate', 'blur']
    const items = kinds.map((kind, idx) => {
      const vec = new Array(EMBEDDING_DIM).fill(0)
      vec[idx] = 1
      return { imageKind: kind, vector: vec }
    })
    const saveRes = await vectorsRoute.fetch(new Request('http://localhost' + API_VECTORS_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ceramic Mug', description: 'White coffee mug on desk', items }),
    }))
    assert.equal(saveRes.status, 200)
    const saveJson = await saveRes.json()
    assert.equal(saveJson.insertedCount, 6)
    assert.equal(saveJson.totalVectors, 6)
    assert.equal(saveJson.totalTargets, 1)

    // Reload from disk in fresh repository instance and verify LangChain metadata + similarity search
    const reopened = new TargetVectorRepository(saveJson.indexDir, EMBEDDING_DIM)
    const reopenedStats = await reopened.getStats()
    assert.equal(reopenedStats.totalVectors, 6)
    assert.equal(reopenedStats.totalTargets, 1)
    const { FaissStore } = await import('@langchain/community/vectorstores/faiss')
    const store = await FaissStore.load(saveJson.indexDir, new PrecomputedLangChainEmbeddings(EMBEDDING_DIM))
    const queryVec = new Array(EMBEDDING_DIM).fill(0)
    queryVec[3] = 1
    const hits = await store.similaritySearchVectorWithScore(queryVec, 1)
    assert.equal(hits.length, 1)
    assert.equal(hits[0][0].metadata.title, 'Ceramic Mug')
    assert.equal(hits[0][0].metadata.description, 'White coffee mug on desk')
    assert.equal(hits[0][0].metadata.imageKind, 'color')
    assert.equal(hits[0][0].metadata.isOriginal, false)
    assert.equal(hits[0][0].metadata.augmentation, 'color')

    // Verify GET ?include=entries returns full table rows with 5-head/5-tail vector slices
    const listRes = await vectorsRoute.fetch(new Request('http://localhost' + API_VECTORS_PATH + '?include=entries'))
    assert.equal(listRes.status, 200)
    const listJson = await listRes.json()
    assert.equal(listJson.entries.length, 6)
    assert.equal(listJson.entries[0].vectorHead.length, 5)
    assert.equal(listJson.entries[0].vectorTail.length, 5)
    assert.equal(listJson.entries[0].augmentation, 'original')
    assert.equal(listJson.entries[3].augmentation, 'color')
    assert.equal(listJson.entries[3].title, 'Ceramic Mug')
    assert.equal(listJson.entries[3].description, 'White coffee mug on desk')

    // Verify fallback recovery from FAISS binary buffer when docstore metadata lacks vectorHead/vectorTail
    const loadedStore = await FaissStore.load(saveJson.indexDir, new PrecomputedLangChainEmbeddings(EMBEDDING_DIM))
    for (const doc of loadedStore.getDocstore()._docs.values()) {
      delete doc.metadata.vectorHead
      delete doc.metadata.vectorTail
    }
    await loadedStore.save(saveJson.indexDir)
    const recoveredRepo = new TargetVectorRepository(saveJson.indexDir, EMBEDDING_DIM)
    const recovered = await recoveredRepo.listAllEntries()
    assert.equal(recovered.entries.length, 6)
    assert.equal(recovered.entries[0].vectorHead.length, 5)
    assert.equal(recovered.entries[0].vectorTail.length, 5)
    assert.equal(recovered.entries[0].vectorHead[0], 1)

    // Verify LangChain FAISS vector search endpoint with cosine similarity threshold
    const searchRoute = routes.get(API_VECTOR_SEARCH_PATH)
    assert.ok(searchRoute, 'vector search route should be registered')
    const matchQuery = new Array(EMBEDDING_DIM).fill(0)
    matchQuery[0] = 1
    const missQuery = new Array(EMBEDDING_DIM).fill(0)
    missQuery[200] = 1
    const searchRes = await searchRoute.fetch(new Request('http://localhost' + API_VECTOR_SEARCH_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vectors: [matchQuery, missQuery], threshold: 0.78 }),
    }))
    assert.equal(searchRes.status, 200)
    const searchJson = await searchRes.json()
    assert.equal(searchJson.results.length, 2)
    assert.equal(searchJson.results[0].matched, true)
    assert.equal(searchJson.results[0].targetId, saveJson.targetId)
    assert.equal(searchJson.results[0].title, 'Ceramic Mug')
    assert.equal(searchJson.results[0].similarity, 1)
    assert.equal(searchJson.results[1].matched, false)
    assert.equal(searchJson.results[1].targetId, null)

    // Delete all FAISS vectors and confirm stats return 0
    const delVecRes = await vectorsRoute.fetch(new Request('http://localhost' + API_VECTORS_PATH, { method: 'DELETE' }))
    assert.equal(delVecRes.status, 200)
    const statsAfterClear = await (await vectorsRoute.fetch(new Request('http://localhost' + API_VECTORS_PATH))).json()
    assert.equal(statsAfterClear.totalVectors, 0)
    assert.equal(statsAfterClear.totalTargets, 0)

    // 6. Verify ORT WASM asset serves with application/wasm MIME type
    const wasmRes = await ortWasmRoute.fetch(new Request('http://localhost' + API_ORT_PREFIX + 'ort-wasm-simd-threaded.jsep.wasm'))
    assert.equal(wasmRes.status, 200)
    assert.equal(wasmRes.headers.get('content-type'), 'application/wasm')
  } finally {
    await fiber.dispose()
    if (prevHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevHome
    await rm(tempHome, { recursive: true, force: true })
  }
})
