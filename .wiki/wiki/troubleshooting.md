# Troubleshooting & Operational Lessons

Durable debugging lessons filed from real development and runtime incidents on `name-tag`.

## 1. `Unexpected token 'o', "not found" is not valid JSON` on Save (Dual-Face Route Skew)

- **Symptom**:
  Clicking **「保存 / Save」** in the `TargetTagModal` runs browser-side `EmbeddingGemma 2` encoding cleanly, then fails with:
  `保存失败：Unexpected token 'o', "not found" is not valid JSON`
- **Root Cause**:
  DSH Web's dual-face architecture hot-serves updated browser bundles (`lib/client.js`) immediately upon browser refresh after `pnpm run build`, **but Node.js host routes registered in `lib/index.js` (`ctx.connection.fetch.register`) are only bound when `dsh web` boots**.
  When a new API route (such as `POST /api/name-tag/vectors`) is added to `src/index.ts` while an older `dsh web` process is still running, the new frontend hits an old host process, which responds with HTTP `404` plain text `"not found"` instead of JSON.
- **Resolution & Safeguard**:
  1. **Operational rule**: Whenever `src/index.ts`, `src/invariant.ts`, or `src/vector-store.ts` adds or modifies a `connection.fetch.register` route, restart `pnpm dsh web` before testing in the browser.
  2. **Code hardening**: Updated `TargetVectorClient.parseJsonSafely()` (`src/client/core/TargetVectorClient.ts`) to read `res.text()` first and surface an explicit actionable error on `404` instructing the user to restart `pnpm dsh web`.

## 2. Browser Bundle (`lib/client.js`) Must Not Leak Node Built-ins

- **Issue A (`onnxruntime-web`)**: Rolldown converts ESM `import.meta.url` into `require("url").pathToFileURL(__filename).href`, which crashes DSH's browser `ModuleLoader`.
  - **Fix**: `define: { 'import.meta.url': '(typeof location !== "undefined" ? location.href : "")' }` in `tsdown.config.ts`.
- **Issue B (`@huggingface/transformers`)**: Without an explicit alias, `tsdown` resolved `transformers.node.mjs` instead of `transformers.web.js`, pulling in `sharp`, `fs`, `child_process`, etc.
  - **Fix**: Alias `'@huggingface/transformers'` to `node_modules/@huggingface/transformers/dist/transformers.web.js` in `tsdown.config.ts`.

## 3. Resolving `onnxruntime-web/dist` Under `exports` Restrictions

- **Issue**: `onnxruntime-web@1.31.1` omits `./package.json` from its `package.json` `"exports"` map, causing `require.resolve('onnxruntime-web/package.json')` to throw `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Fix**: Resolve an explicitly exported asset instead (`dirname(require.resolve('onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm'))`) in `NameTagHostServer.resolveOrtDistDir()`.

## Valen-Decision-1.5 `Failed to fetch` on First Load
- **Symptom**: `Valen-Decision-1.5 模型: Valen 加载失败：Failed to fetch` while `FastSAM-s` and `EmbeddingGemma 2` still work.
- **Root Cause**: `FastSAM-s` and `EmbeddingGemma 2` are already cached locally (Host disk / Browser IndexedDB / `transformers-cache`), whereas `Valen-Decision-1.5-0.8B-ONNX` (`valen_onnx.json` + `web-portable` graphs) must be fetched from `https://huggingface.co` on first load. On networks where TLS connections to `huggingface.co` are reset (`ENOTCONN` / firewall / missing proxy), `fetch()` rejects with `TypeError: Failed to fetch`.
- **Mitigation**: `ValenGroundingEngine.initialize()` tries `huggingface.co` first, falls back to `hf-mirror.com` automatically on network errors, and wraps errors via `ValenGroundingEngine.formatLoadError()` so the UI displays the exact stage, asset name, and URL instead of an opaque `Failed to fetch`.

## Valen `setPipeline` WebGPU Error on `embedding` Graph
- **Symptom**: `Failed to execute 'setPipeline' on 'GPUComputePassEncoder': parameter 1 is not of type 'GPUComputePipeline'. [error: embedding]`.
- **Root Cause**: Valen's `onnx/embedding.onnx` is a single `Gather(axis=0)` lookup over a **970 MiB (`1,017,118,720` bytes)** FP32 table (`248320 × 1024`), which exceeds Chrome/Metal WebGPU storage buffer/pipeline limits or collides with concurrent ORT WebGPU session startup.
- **Fix**: `ValenCpuEmbeddingSession` (`src/client/core/ValenGroundingEngine.ts`) performs bit-exact FP32 `Gather` in JS directly on `onnx/embedding.data` (<1 ms, 0 WebGPU VRAM, 0 WASM heap), while `vision`, `decision`, and `grounding` remain on WebGPU with automatic fallback to `wasm` if WebGPU fails, and `NameTagWorkspace.tsx` sequences `ensureValenReady()` right after `ensureModelReady()`.

## Duplicate `onnxruntime-web` ABI Mismatch (`setPipeline` & `memory access out of bounds`)
- **Symptom**: `Failed to execute 'setPipeline' on 'GPUComputePassEncoder'` (WebGPU) and `memory access out of bounds` (WASM) during Valen graph loading (`embedding` / `vision`), while `FastSAM-s` worked.
- **Root Cause**: `@valen-team/sdk@0.4.0` had an optional peer pinned to `onnxruntime-web@1.31.0-dev.20260914-8d85527a0`, so pnpm installed **two** versions (`1.31.0-dev` and `1.31.1`). `tsdown` bundled `1.31.0-dev`'s JS/Emscripten glue for Valen while `NameTagHostServer` served `1.31.1`'s `.wasm` binaries from `/api/name-tag/ort/`, causing Emscripten JS-to-WASM ABI & WebGPU handle-table corruption.
- **Fix**: Aliased `onnxruntime-web`, `onnxruntime-web/webgpu`, and `onnxruntime-web/wasm` in `tsdown.config.ts` directly to the canonical `node_modules/onnxruntime-web/dist/*.bundle.min.mjs` (`1.31.1`), guaranteeing a single ORT runtime matching `/api/name-tag/ort/*.wasm`.

## Shared ORT Asyncify Stack Corruption (`memory access out of bounds [error: vision]`)
- **Symptom**: `WebGPU: memory access out of bounds [error: vision] | WASM: memory access out of bounds [error: vision]` while `FastSAM-s` runs concurrently on camera frames.
- **Root Cause**: `onnxruntime-web@1.31.1`'s `ort.webgpu.bundle.min.mjs` uses a single global Emscripten Asyncify stack (`ort-wasm-simd-threaded.asyncify.wasm`). When `FastSAM-s` calls `_OrtRun` on WebGPU every 40ms concurrently with `Valen` calling `_OrtCreateSession` / `_OrtRun` for `vision`, concurrent Asyncify unwinds corrupt the WASM stack.
- **Fix**: Added `OrtExecutionMutex.runExclusive()` (`src/client/core/OrtExecutionMutex.ts`) to serialize all ORT session creation and execution calls across `FastSamInferenceEngine` and `ValenGroundingEngine`.
