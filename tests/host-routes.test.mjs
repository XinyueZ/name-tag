import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as nameTagPlugin from '../lib/index.js'
import { API_MODEL_PATH, API_MODEL_STATUS_PATH, API_ORT_PREFIX } from '../lib/invariant.js'

test('NameTagHostServer serves only read-only ORT assets and public FastSAM-s mirror without user data routes', async () => {
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
    assert.equal(routes.has('/api/name-tag/vectors'), false, 'no user vector route on server')
    assert.equal(routes.has('/api/name-tag/preferences'), false, 'no user preferences route on server')

    const st1 = await (await statusRoute.fetch(new Request('http://localhost' + API_MODEL_STATUS_PATH))).json()
    assert.equal(st1.exists, false)
    assert.equal(st1.cachePath, join(tempHome, 'cache', 'name-tag', 'FastSAM-s.onnx'))

    const headMissing = await modelRoute.fetch(new Request('http://localhost' + API_MODEL_PATH, { method: 'HEAD' }))
    assert.equal(headMissing.status, 404)

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
