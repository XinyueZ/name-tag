# Model Lazy-Load & FastSAM-s Contract

## 1. Lazy-Load Cache Hierarchy ("Check Local First")

To avoid blocking DSH Web startup or re-downloading ~45 MB weights on every refresh, `ModelCacheStore` and `NameTagHostServer` collaborate in three stages:

1. **Tier 1 — Browser IndexedDB (`name-tag-db` / `models` / `FastSAM-s.onnx`)**
   - Checked first when the user activates the Name Tag camera/model.
   - **Cache Hit**: Zero network requests; loads directly from browser storage into `ort.InferenceSession.create(buffer)`.
2. **Tier 2 — DSH Host Disk Cache (`~/.dsh/cache/name-tag/FastSAM-s.onnx`)**
   - Queried via `GET /api/name-tag/model` if IndexedDB has no copy.
   - **Cache Hit**: Host streams local file directly to browser; browser persists it into IndexedDB.
3. **Tier 3 — Remote Lazy Download (On-Demand)**
   - Triggered ONLY when neither IndexedDB nor host disk cache has `FastSAM-s.onnx`.
   - Host fetches `https://huggingface.co/SpatialHub/fastsam-onnx/resolve/main/FastSAM-s.onnx` (~47.25 MB) with single-flight deduplication, writes atomically (`.tmp` -> rename) to disk cache, and streams to browser with `Content-Length` progress headers.
   - Manual fallback: Users can also load a local `.onnx` file via file picker in offline environments.

## 2. ONNX Runtime Web Asset Hosting

Because `connection.fetch.register` enforces exact route matching, `NameTagHostServer` registers exact routes under `/api/name-tag/ort/<filename>` for `onnxruntime-web`'s `dist/` WASM and MJS worker artifacts, setting `ort.env.wasm.wasmPaths = '/api/name-tag/ort/'`.

Execution provider priority:
1. `webgpu` (Chrome/Edge on Mac, Windows, Android; Safari 26+)
2. `wasm` (universal SIMD CPU fallback)

## 3. FastSAM-s Tensor Specification

- **Input**: `[1, 3, 640, 640]` Float32 NCHW, RGB in `[0.0, 1.0]`, isotropic letterbox padded with `(114, 114, 114)`.
- **Output[0]**: `[1, 37, 8400]` (or transposed `[1, 8400, 37]`):
  - Channels `0..3`: `[cx, cy, w, h]` in canvas `[0, 640]` coordinates.
  - Channel `4`: objectness confidence score.
  - Channels `5..36`: 32 prototype mask coefficients, combined with `outputs[1]` (`[1, 32, 160, 160]`) to synthesize binary instance masks inside the unpadded video region (`maskWidth × maskHeight`).
- **Decoupled Thresholding**: Inference runs with a permissive raw cutoff (`conf >= 0.15`, NMS `IoU = 0.70`) so `GranularityFilter` can adjust coarseness instantaneously (< 1 ms) on the UI thread without re-running neural inference.
