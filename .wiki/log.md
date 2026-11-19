# Name Tag Project Wiki Log

Chronological append-only log of project milestones, ingests, builds, and lint checks.

## [2026-11-16] init | Initialize standalone Name Tag LLM Wiki
- Created `DSH-Plugins/name-tag/.wiki/` strictly following Karpathy's `llm-wiki.md` 3-layer architecture (`AGENTS.md`, `raw/`, `wiki/`, `index.md`, `log.md`).
- Ingested initial requirements baseline and inherited `session-3e15545d-7233-45ab-9ebc-42a3f8d582e1` granularity control logic into `raw/001-project-inception-and-requirements.md`.
- Synthesized initial architecture, lazy-load FastSAM-s contract, granularity engine, UI/MD3 design system, and roadmap pages.

## [2026-11-16] build | Phase 1 built, tested (9/9), and registered in DSH Web profile
- Completed Node host (`NameTagHostServer`), browser OOP services, atomic UI components, `T.js`, and `S.js`.
- Fixed `import.meta.url` CJS browser bundling in `tsdown.config.ts` and ORT dist path resolution via exported `.wasm` entry.
- Verified `pnpm run build` and 9/9 unit tests passing (including `lib/client.js` ModuleLoader execution check).
- Permanently added `@deepseek-ai/dsh-client-name-tag` to `~/.dsh/profiles/web/package.json` via `pnpm dsh plugin --profile web add`.

## [2026-11-16] ingest | Switch to FastSAM-s segmentation masks & Preload Model ❗️ alert
- Added `ModelCacheStore.checkLocalAvailability()` (checks IndexedDB + Host status without downloading) and `❗️` top-right badge on Preload Model button when absent.
- Upgraded `FastSamInferenceEngine` to synthesize prototype masks from `outputs[1]`, `GranularityFilter` to use exact mask pixel containment when masks exist, and `CanvasOverlayRenderer` to render colored segmentation fills & contours instead of bboxes.
- Verified `pnpm run build` and 10/10 unit tests passing.

## [2026-11-16] ingest | Add top-right collapse button to GranularityCard
- Added bilingual `granularity.collapse` / `granularity.expand` keys in `T.js`.
- Added MD3 circular icon button styles (`.nt-icon-btn`) in `S.js` and collapse toggle state in `GranularityCard.tsx`.

## [2026-11-16] ingest | Persist Granularity panel state across restarts
- Added `PreferencesStore` (`src/client/core/PreferencesStore.ts`) saving Granularity parameters & card collapse state synchronously to `localStorage` and asynchronously to DSH Host `~/.dsh/cache/name-tag/preferences.json` via `/api/name-tag/preferences`.
- Added unit tests for `PreferencesStore` sanitization and Host `/api/name-tag/preferences` GET/PUT persistence.

## [2026-11-16] milestone | Implement Target Tagging modal & transparent 6-image augmentations
- Added `CutoutAugmenter` (`src/client/core/CutoutAugmenter.ts`) extracting soft-feathered RGBA transparent cutouts and generating 5 augmentations (H-Flip, Scale, Color Jitter, Slight Rotate, Gaussian Blur).
- Added pixel-accurate mask `hitTest` and hover highlight to `CameraViewport.tsx`.
- Added `TargetTagModal.tsx` titled 「目标标记」 with 2×3 checkerboard preview grid and bottom-right 「保存」 button closing the modal.

## [2026-11-16] ingest | Expand granularity slider upper bounds
- Updated `GranularityCard.tsx` and `PreferencesStore.ts` upper bounds: `containmentThreshold` max `1`, `minAreaPercent` max `100%`, and `confThreshold` max `100%` (`1.0`).

## [2026-11-16] ingest | Add Save Preset button & conditional saved-presets dropdown
- Added `SavedGranularityPreset` persistence to `invariant.ts` and `PreferencesStore.ts` (persists across browser refreshes & app restarts).
- Added a compact MD3 「保存 / Save」 button on `GranularityCard.tsx` header and a conditional dropdown next to the 「偏细」 preset button (hidden when `savedPresets.length === 0`).

## [2026-11-16] ingest | Add non-persisted probability label switch left of Save button
- Added `showProbLabels` state (default `false`, explicitly excluded from `PreferencesStore` persistence).
- Placed a compact MD3 switch to the left of the 「保存 / Save」 button on `GranularityCard.tsx` controlling whether `#idx · score` pills render in `CameraViewport.tsx`.

## [2026-11-16] ingest | Add two-column Title & Description inputs to TargetTagModal
- Split `TargetTagModal.tsx` body into two columns: left 2×3 transparent cutout + augmentations grid, right column with single-line 「标题」 input and multi-line 「介绍」 textarea.
- Added MD3 input styles in `S.js` and bilingual field labels/placeholders in `T.js`. Save button closes modal.

## [2026-11-16] ingest | Clear saved granularity presets when clearing cache
- Added `DELETE /api/name-tag/preferences` in `NameTagHostServer` and `PreferencesStore.clearAll()` to wipe both `localStorage` and Host disk `preferences.json`.
- Updated `NameTagWorkspace.handleClearCache` so clicking 「清缓存 / Clear Cache」 also clears all saved granularity presets, resets the Granularity panel to default `coarse`, and hides the saved-presets dropdown.

## [2026-11-16] ingest | Improve plain-language explanations in Granularity panel
- Rewrote `granularity.containHint`, `granularity.minAreaHint`, and `granularity.confHint` in `T.js` (ZH/EN) with concrete everyday examples and clear left/right directional guidance.

## [2026-11-16] ingest | Default camera mirror toggle to ON
- Changed initial `mirror` state in `NameTagWorkspace.tsx` from `false` to `true` so the Mirror option on the first card is enabled by default.

## [2026-11-16] ingest | Set full 0-based slider ranges for Granularity parameters
- Updated `GranularityCard.tsx` and `PreferencesStore.ts` ranges to: `containmentThreshold` `[0, 1]`, `minAreaPercent` `[0%, 100%]`, `confThreshold` `[0%, 100%]`.
- Lowered `FastSamInferenceEngine.RAW_CONF_FLOOR` to `0.02` so low-confidence slider values reveal low-score candidates.

## [2026-11-16] lint | Remove granularity card subtitle and unused T.js wording
- Removed `granularity.cardSubtitle` from `GranularityCard.tsx` and `T.js` (ZH/EN).
- Audited all translation keys in `T.js` against `src/` and removed unused key `camera.noDevice` (0 unused keys remaining).

## [2026-11-16] ingest | Replace native select with custom MD3 SavedPresetDropdown with × delete buttons
- Created atomic `SavedPresetDropdown.tsx` component next to the 「偏细」 button with an instant `×` delete button on every item (no confirmation dialog).
- Wired `onDeleteSavedPreset` in `NameTagWorkspace.tsx` to immediately persist deletion via `PreferencesStore` and hide the dropdown automatically when empty.

## [2026-11-16] ingest | OOP SavedPresetItem/GranularitySettings + Check button + Inline rename
- Created `SavedPresetModels.ts` defining `GranularitySettings` and `SavedPresetItem` (`id`, `text`, `selected`, `settings`).
- Updated `SavedPresetDropdown.tsx` with inline text editing on click (preserving `selected` state) and a green/gray check button between item text and `×`.

## [2026-11-17] ingest | Display all cache & storage filesystem paths on first card
- Extended `ModelStatusResponse` in `invariant.ts` and `NameTagHostServer.getModelStatus()` to expose `cacheDir`, `cachePath`, and `preferencesPath`.
- Updated `ModelCacheStore.checkLocalAvailability()` to always fetch Host paths alongside IndexedDB checks, and displayed all host filesystem + browser storage paths in `CameraControlStrip.tsx`.

## [2026-11-17] milestone | Implement client EmbeddingGemma 2 + LangChain JS FaissStore pipeline
- Created `Gemma2EmbeddingEngine` and `Gemma2LangChainEmbeddings` (`src/client/core/Gemma2EmbeddingEngine.ts`) using `@huggingface/transformers` (`transformers.web.js` alias in `tsdown.config.ts`) with `audio_config = null`, lazy-loaded simultaneously when starting the camera.
- Created `TargetVectorRepository` (`src/vector-store.ts`) wrapping LangChain `FaissStore` and `Document`s storing 6 vector indices per target with shared `title` / `description` and `imageKind` / `isOriginal` / `augmentation` metadata.
- Updated `TargetTagModal.tsx` with required validation for `title` & `description`, async 6-vector encoding & FAISS save, and updated `handleClearCache` to wipe `transformers-cache` and `faiss-index`.

## [2026-11-17] ingest | Make cache & filesystem paths block collapsible (default collapsed)
- Updated `CameraControlStrip.tsx` and `S.js` so the 「缓存与数据文件系统路径」 section toggles open/closed and defaults to collapsed (`pathsExpanded = false`).

## [2026-11-17] query | Document 404 "not found" JSON error & dual-face route skew in .wiki
- Created `wiki/troubleshooting.md` recording the `Unexpected token 'o', "not found" is not valid JSON` root cause (browser bundle hot-loaded while old `dsh web` process lacked `/api/name-tag/vectors`), the `TargetVectorClient.parseJsonSafely` fix, and prior browser bundling lessons.
- Updated `index.md` to link `wiki/troubleshooting.md`.

## [2026-11-17] ingest | Add project-root AGENTS.md coding & execution guide
- Created `name-tag/AGENTS.md` codifying feature-agnostic engineering rules: strict OOP discipline and explicit boundaries (DSH entrypoints + thin atomic React views), `T.js`/`S.js` asset rules, dual-face bundling invariants, LangChain/cache hygiene, Karpathy LLM Wiki maintenance (with gist URL), and pre-completion build/test gates.
- Linked `../AGENTS.md` from `.wiki/index.md`.

## [2026-11-17] milestone | Add Database button & 4-column VectorDbModal with resizable title/description columns
- Extended `TargetVectorRepository.listAllEntries()` and `GET /api/name-tag/vectors?include=entries` to return stored LangChain `FaissStore` entries with `vectorHead` (5) and `vectorTail` (5).
- Created `VectorTableFormatter` and `VectorDbModal.tsx` displaying `index` (first 5 ... last 5), full `augmentation`, full `title`, and full `description`, with horizontal drag-resizing exclusively on `title` and `description` right borders.
- Added 「数据库 / Database」 button next to 「镜像 / Mirror」 in `CameraControlStrip.tsx`.

## [2026-11-17] ingest | Recover legacy vector slices from FaissStore buffer & detect stale Host route
- Updated `TargetVectorRepository.listAllEntries()` to fall back to reading 5-head/5-tail slices from `store.index.toBuffer()` when older `docstore.json` records lack `vectorHead`/`vectorTail`.
- Updated `TargetVectorClient.listEntries()` to throw a clear restart error if `totalVectors > 0` but `entries` is `undefined` (stale `dsh web` host skew).

## [2026-11-17] ingest | Add timestamp as final column in VectorDbModal
- Added `VectorTableFormatter.formatTimestamp(createdAt)` (`YYYY-MM-DD HH:mm:ss`).
- Added `db.col.timestamp` in `T.js` and appended the timestamp column as the last column in `VectorDbModal.tsx` (keeping `title` and `description` right-border resize handles intact).

## [2026-11-17] ingest | Add clickable timestamp column sorting (default DESC)
- Added `VectorTableFormatter.sortRowsByTimestamp(rows, 'desc' | 'asc')` preserving relative order within identical timestamps.
- Made the timestamp column header clickable in `VectorDbModal.tsx` with default `desc` order (`↓`) toggling to `asc` (`↑`).

## [2026-11-17] milestone | Implement auto-capture FAISS matching & draggable Pocket window
- Added `TargetVectorRepository.searchMatches()` via LangChain `FaissStore.similaritySearchVectorWithScore` and `POST /api/name-tag/vectors/search`.
- Added `matchThreshold` slider (`0..1`, default `0.78`) in `CameraControlStrip.tsx` persisted via `PreferencesStore`.
- Implemented continuous auto-capture loop in `NameTagWorkspace.tsx`, `PocketCaptureManager`, and draggable narrow `PocketFloatingWindow.tsx` stacking matched transparent cutouts top-to-bottom.

## [2026-11-17] lint | Surface auto-capture search errors in CameraControlStrip
- Replaced silent catch in `NameTagWorkspace` auto-capture loop with `matchError` banner in `CameraControlStrip` so stale-host 404 or vector search failures are immediately visible.

## [2026-11-17] ingest | Show matched target title beneath each cutout in PocketFloatingWindow
- Extended `VectorSearchMatchResult` and `TargetVectorRepository.searchMatches()` to return matched `title` from LangChain `FaissStore` document metadata.
- Added `title` to `PocketItem` and rendered `.nt-pocket-item-title` beneath each cutout image in `PocketFloatingWindow.tsx`.

## [2026-11-17] ingest | Enhance visual contrast of PocketFloatingWindow
- Updated `.nt-pocket-window` and `.nt-pocket-header` in `S.js` with a distinct MD3 primary-tinted backdrop, 2px primary border, elevated drop shadow, and high-contrast primary header bar so the floating Pocket window stands out immediately in both dark and light themes.

## [2026-11-17] lint | Resolve matched database title cleanly without falling back to targetId
- Removed `targetId` display fallback in `NameTagWorkspace.tsx`; when `hit.title` is missing (e.g. older `dsh web` host process), resolves `title` directly from `vectorClient.listEntries()` via `targetId` / `row.id` prefix.

## [2026-11-17] ingest | Keep camera background in PocketFloatingWindow images
- Added `CutoutAugmenter.extractRawBboxCrop()` so `PocketFloatingWindow` displays the raw camera bbox crop with its original background intact, while `extractTransparentCutout()` continues feeding the query embedding for accurate matching against stored background-removed vectors.
- Replaced checkerboard frame with `.nt-pocket-img-frame` in `PocketFloatingWindow.tsx` and `S.js`.

## [2026-11-17] ingest | Add Open Pocket button, threshold Default reset, and session-scoped threshold
- Added 「打开口袋 / Open Pocket」 button on `CameraControlStrip` (allows opening `PocketFloatingWindow` even when empty).
- Added 「默认 / Default」 reset button next to the similarity threshold slider via `MdSliderField.headerAction`.
- Removed `matchThreshold` persistence from `PreferencesStore` and `NameTagPreferences` so the similarity threshold always starts at `0.78` per session.

## [2026-11-17] lint | Reorganize and deduplicate T.js bilingual catalog
- Audited all 119 keys in `T.js` against `src/` (0 unused keys, 0 hardcoded Chinese strings).
- Deduplicated `modal.close` & `db.close` into `common.close`, aligned `modal.aug.rotate` (`+8°`), and grouped `T.js` into clean domain sections (118 active keys with 100% EN/ZH parity).

## [2026-11-17] ingest | Add bilingual README.md and workflow-architecture.png diagram
- Rendered crisp 2x PNG workflow diagram at `assets/workflow-architecture.png` showing the dual-stage segmentation, augmentation, EmbeddingGemma 2, LangChain FAISS, and Pocket recognition pipeline.
- Created `name-tag/README.md` with a side-by-side EN/ZH Table of Contents, global DSH Web installation guide, model/framework rationale, embedded PNG workflow diagram, and full UI element reference.
- Linked `../README.md` in `.wiki/index.md`.

## [2026-11-17] ingest | Add explicit HTML anchors to README TOC & document .wiki knowledge usage
- Replaced auto-slug TOC links in `README.md` with explicit `<a id="..."></a>` anchors (`#en-*`, `#zh-*`) so every link jumps reliably across GitHub, VS Code, and DSH Markdown viewers.
- Added Section 5 (both EN & ZH) in `README.md` explaining how to use `.wiki/` to retrieve the latest project knowledge, architecture, logs, and troubleshooting lessons.

## [2026-11-17] ingest | Prioritize .wiki section first in README with icon
- Reordered `README.md` so `1. 📚 Latest Project Knowledge (.wiki/)` / `1. 📚 使用 .wiki/ 目录获取项目最新知识` appears before installation in both the side-by-side TOC and body sections.

## [2026-11-17] ingest | Add project-level .gitignore
- Created `name-tag/.gitignore` excluding `node_modules/`, `lib/`, lockfiles, ML weights (`*.onnx`, `*.pt`, `*.safetensors`, `*.wasm`), runtime FAISS/preference stores (`faiss-index/`, `docstore.json`, `preferences.json`), secrets (`.env*`, `*.key`, `*.pem`), logs, and OS/IDE artifacts.

## [2026-11-17] ingest | Add standalone Clear Vector DB button (vector store only)
- Added 「清空向量库 / Clear Vector DB」 button next to 「清缓存 / Clear Cache」 in `CameraControlStrip.tsx`.
- Wired `NameTagWorkspace.handleClearVectorDb` to call `DELETE /api/name-tag/vectors` and reset vector stats/rows without touching cached models or granularity presets.
- Updated `T.js`, `S.js`, `README.md` (EN & ZH), and style tests.

## [2026-11-17] ingest | Center PocketFloatingWindow inside Name Tag workspace
- Added `PocketCaptureManager.computeCenteredPosition()` anchored to `workspaceRootRef` (`.nt-root`) so the Pocket opens horizontally & vertically centered inside the Name Tag app area (until manually dragged).

## [2026-11-17] ingest | Swap Clear Vector DB and Clear Cache button order
- Swapped button order in `CameraControlStrip.tsx` (and `README.md`) so 「清空向量库 / Clear Vector DB」 appears before 「清缓存 / Clear Cache」.

## [2026-11-17] ingest | Draw classic CV bounding box + title label for recognized objects
- Added `RecognizedDetection` in `invariant.ts` and `PocketCaptureManager.trackRecognizedBoxes()` to smoothly snap recognized bounding boxes to live `FastSAM-s` segments via IoU.
- Updated `CanvasOverlayRenderer.render()` in `CameraViewport.tsx` to draw a classic CV rectangle and top-left `title` tag around every recognized object independently of `showProbLabels`.
- Updated `README.md` (EN & ZH) and added unit test coverage in `decoder-and-geometry.test.mjs`.

## [2026-11-17] ingest | Convert screen recording to demo GIF and embed in README header
- Converted `Screen Recording 2026-11-17 at 19.48.28.mov` (199.6 MB) to an optimized 8.73 MB loopable GIF at `assets/name-tag-demo.gif` (920px wide, 6 fps, 96-color diff palette).
- Updated `README.md` header order to: Big Title -> English tagline -> Chinese translation -> Demo GIF -> Table of Contents.

## [2026-11-17] milestone | Migrate Vector DB and Preferences 100% to Client Browser
- Replaced server-side `faiss-node` / `FaissStore` with `IndexedDbLangChainVectorStore` (`@langchain/core/vectorstores` + IndexedDB `dsh-name-tag-vectors`) and `BrowserTargetVectorRepository` in `src/client/core/BrowserVectorStore.ts`.
- Added `LangSmithBrowserStub.ts` aliases in `tsdown.config.ts` so `@langchain/core/vectorstores` compiles cleanly into `lib/client.js` with zero Node built-ins (`uniqueReqs: ['react', 'react/jsx-runtime']`).
- Simplified `PreferencesStore` to browser-only `localStorage`, stripped user routes from `NameTagHostServer` (`src/index.ts`), removed `faiss-node` & `@langchain/community`, updated `README.md` & `workflow-architecture.png`.

## [2026-11-17] ingest | Codify 100% Client-Side AI invariant in .wiki, AGENTS.md, and README intro
- Added **100% Client-Side AI & Zero Server User State** as a mandatory project invariant in `.wiki/AGENTS.md` and `name-tag/AGENTS.md`.
- Updated the bilingual (EN/ZH) intro directly beneath the `README.md` title to explain the 100% browser-side AI & multi-user isolation guarantee.

## [2026-11-17] ingest | Replace split-ratio badge with Expand/Collapse Fullscreen button & Esc toast
- Removed `split.ratio` from `T.js` and replaced the top-right percentage badge in `NameTagWorkspace.tsx` with an MD3 Expand/Collapse icon button toggling `.nt-root.is-fullscreen`.
- Added persistent semi-transparent top-center toast (`.nt-fullscreen-toast`) displaying 「按 ESC 退出全屏」 / 「Press ESC to exit fullscreen」 while fullscreen is active, plus `Esc` listener (respecting open modals first).
- Updated `README.md` (EN & ZH) and style assertions in `granularity-and-assets.test.mjs`.

## [2026-11-17] lint | Fix stale recognized bboxes when camera sees no segments
- Updated `PocketCaptureManager.trackRecognizedBoxes()` to return `[]` when `liveKept.length === 0` and drop unmatched ghost boxes (`bestIoU < 0.25`).
- Updated `NameTagWorkspace.tsx` to clear `recognizedDetections` immediately when `filterResult.kept.length === 0` (both in reactive effect and auto-capture loop).

## [2026-11-17] milestone | Optimize continuous segmentation crops via detect.py tracking & sharpness scoring
- Upgraded `CutoutAugmenter` with `PAD = 0.12`, 3×3 prototype mask dilation (`dilateBinaryMask`), and 96×96 Laplacian variance `computeCropQuality()`.
- Added `ObjectCropTracker` (`src/client/core/ObjectCropTracker.ts`) implementing IoU tracking, `STABLE_FRAMES = 3` stability gating, salience ordering, sharpest-crop buffering across `REQUERY_MS = 2000`, and clean disappearance decay.
- Wired `ObjectCropTracker` into `NameTagWorkspace.tsx` and added unit tests in `decoder-and-geometry.test.mjs`.

## [2026-11-19] ingest | Add editable camera scope dropdown at top-left of camera viewport
- Added immutable OOP domain classes `CameraScopeItem` and `CameraScopeCollection` (`src/client/core/CameraScopeModels.ts`) and shared preference types in `src/invariant.ts`.
- Added atomic `CameraScopeDropdown` component (`src/client/components/CameraScopeDropdown.tsx`) mounted at top-left of `CameraViewport` (`.nt-camera-hud-left`, `z-index: 20` above `.nt-camera-empty`), supporting immutable default 「所有 / All」, continuous IME-safe `Enter`-to-add input, inline `✎` rename for custom items, and per-item `×` deletion.
- Persisted `cameraScopes` browser-locally in `PreferencesStore` (`localStorage`) with automatic reset on Clear Cache, added bilingual `scope.*` keys to `T.js` and pure MD3 styles to `S.js`, and added unit tests in `tests/decoder-and-geometry.test.mjs` and `tests/granularity-and-assets.test.mjs` (19/19 passing).

## [2026-11-19] ingest | Add immutable Human Face option and 5s/60s non-dismissible Tips bubble
- Extended `CameraScopeItem` / `CameraScopeCollection` (`src/client/core/CameraScopeModels.ts`) with built-in locked `HUMAN_FACE_ID = 'human-face'` (「人脸」 / 「Human Face」) that cannot be edited, deleted, or duplicated.
- Added OOP `CameraTipsScheduler` (`src/client/core/CameraTipsScheduler.ts`) and rendered `.nt-scope-tips-bubble` at the top-left of `CameraScopeDropdown.tsx` (with `.nt-camera-media` clipping wrapper in `CameraViewport.tsx` so the bubble never clips): pops up for 5s on every camera start, repeats every 60s while active, and cannot be dismissed by the user (`pointer-events: none`, no close button).
- Updated `T.js` (135 EN/ZH keys in parity, 0 unused), `S.js`, and unit tests (`20/20` passing).

## [2026-11-19] ingest | Upgrade floating Tips bubble to vibrant warm golden-amber gradient
- Restyled `.nt-scope-tips-bubble`, `::after`, and `.nt-scope-tips-badge` in `src/client/S.js` with a warm sunrise gradient (`#ffe066` -> `#ffb732` -> `#ff9248`), high-contrast `#241400` typography, dark-gold `Tips` badge, spring pop-in animation, and subtle amber glow so it stands out clearly on both dark and light themes.

## [2026-11-19] milestone | Add client-side Valen-Decision-1.5 bbox semantic filter layer & persisted thresholds
- Installed `@valen-team/sdk@0.4.0`, `@huggingface/jinja@0.5.10`, and `@huggingface/tokenizers@0.2.0`; added `ValenBrowserStub.ts`, inlined 32KB `pillow_resize.wasm` as a base64 data URL, and set `codeSplitting: false` in `tsdown.config.ts` so `lib/client.js` stays a single browser closure with zero Node `require(...)` (`['react', 'react/jsx-runtime']`).
- Added `ValenGroundingEngine` (`src/client/core/ValenGroundingEngine.ts`) and `ValenScopeFilter` (`src/client/core/ValenScopeFilter.ts`), wiring a strict two-layer pipeline in `NameTagWorkspace.tsx`: `FastSAM-s + GranularityFilter` -> `ValenScopeFilter` (bypassed 100% for 'All'; strict `bbox` matching + IoU tracking for non-'All' scopes feeding downstream overlay, click-to-tag, `ObjectCropTracker`, and Pocket).
- Loaded Valen together with FastSAM-s and EmbeddingGemma 2 on camera start / Preload Model, added Valen status banner & `Cache (valen-sdk-v2)` visibility + clearing in `CameraControlStrip.tsx` / `handleClearCache`.
- Added the Valen filter confidence slider directly beneath the `<input>` in `CameraScopeDropdown.tsx` (`scopeConfidenceThreshold`, default `0.50`) and persisted both `scopeConfidenceThreshold` and Pocket's `matchThreshold` (default `0.78`) independently in `PreferencesStore` (`localStorage`).
- Verified `pnpm run build`, 147 EN/ZH `T.js` keys (0 unused), and `pnpm test` (`21/21` passing).

## [2026-11-19] lint | Add actionable Valen fetch diagnostics and hf-mirror fallback
- Diagnosed `Valen 加载失败：Failed to fetch` as TLS ClientHello reset (`ENOTCONN`) when reaching `https://huggingface.co` on the current network.
- Updated `ValenGroundingEngine.initialize()` with automatic `hf-mirror.com` fallback and `formatLoadError()` exposing the exact failing stage, asset, and URL; documented in `wiki/troubleshooting.md`.

## [2026-11-19] lint | Fix Valen WebGPU setPipeline crash on 970 MiB embedding graph
- Added `ValenCpuEmbeddingSession` in `src/client/core/ValenGroundingEngine.ts` to execute Valen's `Gather(axis=0)` embedding lookup bit-exactly in JS (<1 ms, 0 GPU VRAM, 0 WASM heap) while keeping `vision`, `decision`, and `grounding` on WebGPU.
- Added automatic WebGPU -> WASM fallback in `ValenGroundingEngine.initialize()` and sequenced `ensureValenReady()` after `ensureModelReady()` in `NameTagWorkspace.tsx` to avoid concurrent ORT WebGPU init races.
- Added `ValenCpuEmbeddingSession` unit test (`21/21` passing) and documented root cause in `wiki/troubleshooting.md`.

## [2026-11-19] lint | Deduplicate onnxruntime-web to 1.31.1 in tsdown.config.ts to fix Valen WASM/WebGPU ABI mismatch
- Diagnosed both `setPipeline` and `memory access out of bounds [error: vision]` as an Emscripten JS/WASM ABI mismatch caused by `@valen-team/sdk` bundling `onnxruntime-web@1.31.0-dev` against `/api/name-tag/ort/` serving `1.31.1` `.wasm` binaries.
- Aliased `onnxruntime-web`, `onnxruntime-web/webgpu`, and `onnxruntime-web/wasm` in `tsdown.config.ts` to the single canonical `1.31.1` build (`ortHeaders: ['ONNX Runtime Web v1.31.1']`, bundle shrunk from 2.63 MB to 2.47 MB), and surfaced both WebGPU + WASM error details in `ValenGroundingEngine.initialize()`.

## [2026-11-19] lint | Serialize FastSAM-s and Valen ORT Asyncify calls via OrtExecutionMutex
- Verified `vision.onnx`, `web-portable-decision.onnx`, and `grounding.onnx` all load and run cleanly in `onnxruntime-web@1.31.1` (`ort.webgpu.bundle.min.mjs`) when not racing concurrent WebGPU Asyncify calls.
- Added `OrtExecutionMutex` (`src/client/core/OrtExecutionMutex.ts`) and guarded all ORT `InferenceSession.create` / `session.run` calls in `FastSamInferenceEngine.ts` and `ValenGroundingEngine.ts` to prevent Emscripten Asyncify stack corruption (`memory access out of bounds [error: vision]`).
- Added `OrtExecutionMutex` FIFO serialization unit test (`21/21` passing) and updated `wiki/architecture.md` & `wiki/troubleshooting.md`.

## [2026-11-19] milestone | Replace Valen 0.8B with real-time EmbeddingGemma 2 SemanticScopeFilter
- Uninstalled `@valen-team/sdk`, `@huggingface/jinja`, `@huggingface/tokenizers` and removed `ValenGroundingEngine.ts`, `ValenScopeFilter.ts`, `ValenBrowserStub.ts`, and `OrtExecutionMutex.ts`, restoring `FastSamInferenceEngine` to full unblocked FPS (`lib/client.js` shrunk to 2.18 MB).
- Added `SemanticScopeFilter` (`src/client/core/SemanticScopeFilter.ts`) and `BrowserTargetVectorRepository.getVectorsByTitle()` (`src/client/core/BrowserVectorStore.ts`): computes contrastive positive/negative text prototypes (`a photo of ...`, `a close-up of ...`, raw text vs background prompts) + optional few-shot visual centroid fusion from local IndexedDB vector store.
- Wired one-vector-two-uses pipeline in `NameTagWorkspace.tsx`: `'All'` remains 100% unchanged; non-`'All'` scopes track multiple live instances via IoU, score each track once per 2s via `EmbeddingGemma 2`, gate canvas overlay / click-to-tag / Pocket strictly to passed tracks (`score >= scopeConfidenceThreshold`), and reuse the exact same 768-d image vector for Pocket vector search.
- Cleaned up `CameraControlStrip.tsx` and `T.js` (141 EN/ZH keys in parity, 0 unused), updated unit tests (`21/21` passing), and recorded `raw/013-embeddinggemma2-realtime-scope-filter.md`.

## [2026-11-19] ingest | Document post-segmentation semantic filter & Valen trade-offs in README and wiki
- Rendered 2x Retina diagram `assets/semantic-filter-pipeline.png` illustrating the two-layer filtering architecture (`GranularityFilter` -> `SemanticScopeFilter`), contrastive margin scoring, few-shot fusion, and one-vector-two-uses Pocket pipeline.
- Added maintained wiki page `wiki/semantic-filtering-and-tradeoffs.md` (indexed in `.wiki/index.md` and cross-linked from `wiki/architecture.md`) detailing the ADR & empirical trade-offs against standalone VLMs such as `Valen-Team/valen-sdk-js`.
- Updated `README.md` (both EN and ZH sections + TOC) with the new PNG diagram, dedicated filter architecture & model trade-off section (with `https://github.com/Valen-Team/valen-sdk-js` link), and refreshed UI reference for `CameraScopeDropdown` and persisted thresholds.

## [2026-11-19] ingest | Add Recognition Dedup IoU slider and tighter-inner-box NMS
- Added `DEFAULT_RECOGNITION_IOU_THRESHOLD = 0.30` in `src/invariant.ts` and persisted `recognitionIouThreshold` independently in `PreferencesStore` (`localStorage`).
- Added `PocketCaptureManager.suppressOverlappingDetections()` (area-ascending NMS keeping tighter inner foreground targets over enclosing outer background boxes) plus a 2.5× scale-ratio guard in `ObjectCropTracker.updateFrame` and `PocketCaptureManager.trackRecognizedBoxes`.
- Mounted the new `识别框去重 IoU 阈值 / Recognition Dedup IoU` slider directly beneath `Capture Match Similarity` in `CameraControlStrip.tsx`, wired live suppression in `NameTagWorkspace.tsx`, updated `T.js` (143 EN/ZH keys, 0 unused), `README.md`, unit tests (`21/21` passing), and `.wiki/`.

## [2026-11-19] lint | Upgrade recognition dedup to same-target max(IoU, IoM) containment
- Updated `PocketCaptureManager.suppressOverlappingDetections()` to compute both `IoU` and `IoM = inter / min(areaA, areaB)`: same-target overlapping boxes use `max(IoU, IoM)` so an enclosing full-frame background wall (`IoM ≈ 1.0`) is reliably suppressed at any camera distance or threshold (`< 1.00`), while different targets (e.g., a mug held in front of a person) continue using standard `IoU` so both remain visible.

## [2026-11-19] ingest | Add post-recognition semantic gate and Layer 1 negative-prompt conflict guard
- Added `description` to `VectorSearchMatchResult` (`src/invariant.ts` & `src/client/core/BrowserVectorStore.ts`).
- Added `SemanticScopeFilter.getEffectiveNegativeIndices()`, `matchesLiteralMetadata()`, and per-`targetId` cached `verifyRecognizedTarget()` (`src/client/core/SemanticScopeFilter.ts`), keeping Layer 1 open for tagging small items/clutter/walls while strictly gating recognized DB outputs (BBox + Pocket) in `NameTagWorkspace.tsx` so e.g. `papa` is blocked when filtering for `glass` / `眼镜`.
- Added unit tests (`21/21` passing) and updated `README.md` (EN/ZH) & `.wiki/` (`raw/015`, `wiki/semantic-filtering-and-tradeoffs.md`, `index.md`, `log.md`).

## [2026-11-19] lint | Prevent track drift to adjacent segments & rank sibling dedup by similarity
- Tightened `SemanticScopeFilter.MATCH_IOU_THRESHOLD` (`0.25 -> 0.40` + `2.5×` scale-ratio guard) and `PocketCaptureManager.trackRecognizedBoxes` (`0.25 -> 0.35` + 1-to-1 live claiming) so a recognized `glass` track no longer drifts onto an adjacent forehead/hair mask.
- Propagated actual vector `similarity` onto `RecognizedDetection` across `ObjectCropTracker`, `SemanticScopeFilter`, and `NameTagWorkspace`, and updated `PocketCaptureManager.suppressOverlappingDetections` so enclosing outer boxes still yield to tighter inner boxes (`iom >= 0.75`) while touching sibling boxes of the same target keep the highest-similarity match.

## [2026-11-19] ingest | Add persisted Match Candidates Top-K slider (default Top 5) & competitive margin selection
- Upgraded `BrowserTargetVectorRepository.searchMatches()` (`src/client/core/BrowserVectorStore.ts`) to return up to `topK` distinct `targetId` candidates (`VectorSearchCandidate[]`) above `matchThreshold`.
- Added `SemanticScopeFilter.selectScopedMatch()` (`COMPETITIVE_MARGIN = 0.08`) to pick the highest-similarity scope-verified candidate within `0.08` of Top-1, solving Top-1 shadowing (e.g., `glass 0.84` masking `papa 0.82` when filtering for `papa`).
- Added persisted `matchTopK` (`1..20`, default `5`) in `src/invariant.ts`, `PreferencesStore.ts`, `CameraControlStrip.tsx` (Card 1 slider), `NameTagWorkspace.tsx`, `T.js` (145 EN/ZH keys, 0 unused), `README.md`, unit tests (`21/21` passing), and `.wiki/`.

## [2026-11-19] lint | Fix human-face post-recognition gate rejecting person proper names like 'papa'
- Diagnosed why selecting built-in 「人脸 / Human Face」 showed `已筛选：人脸` in HUD (Layer 1 passed) yet hid the `papa` BBox: proper names (`papa`, `Xinyue`, `Alice`, `A001`) do not literally match `human face` in text-only embedding space.
- Added `BrowserTargetVectorRepository.getVectorsByTargetId()` (`src/client/core/BrowserVectorStore.ts`) and upgraded `SemanticScopeFilter.verifyRecognizedTarget()` to verify built-in `human-face` candidates using their stored visual centroid in IndexedDB (while immediately rejecting clear inanimate object/accessory labels like `glass` / `cup`), plus expanded `HUMAN_FACE_KEYWORDS` and lowered `POST_RECOG_TEXT_SIM_FLOOR` to `0.42`.

## [2026-11-19] ingest | Increase Match Candidates Top-K range to 1..500 with default 30
- Updated `DEFAULT_MATCH_TOP_K = 30` and `MAX_MATCH_TOP_K = 500` in `src/invariant.ts`, plus synchronized `T.js`, `README.md`, unit tests, and `.wiki/`.

## [2026-11-19] lint | Enforce strict per-class IoU NMS and display 3-decimal probability on recognized BBox tags
- Restricted `PocketCaptureManager.suppressOverlappingDetections()` to strict same-label-only (per-class) NMS (`if (!sameTarget) continue`) so overlapping/nested distinct labels (`papa` + `glass`) never suppress each other at any IoU threshold.
- Added `CanvasOverlayRenderer.formatRecognizedLabel()` (`src/client/components/CameraViewport.tsx`) to render `title` + 3-decimal rounded similarity (e.g., `glass 0.912`) on recognized CV bounding box tags independently of the segmentation `Prob. Tags` switch.
- Updated `T.js`, `README.md`, and unit tests (`21/21` passing).
