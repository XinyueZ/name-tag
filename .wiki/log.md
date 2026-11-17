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
