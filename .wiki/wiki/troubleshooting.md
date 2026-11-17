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
