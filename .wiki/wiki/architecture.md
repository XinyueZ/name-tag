# Architecture Overview

`name-tag` is a **Dual-Face DSH Web Plugin** (`@deepseek-ai/dsh-client-name-tag`) combining a lightweight Node.js host asset/cache server with an in-browser WebGPU/WASM computer vision workspace.

## 1. Dual-Face Topology

| Side | Entry | Responsibility |
| :--- | :--- | :--- |
| **Node Host** | `src/index.ts` (`NameTagHostServer`) | Registers authenticated exact HTTP routes via `ctx.connection.fetch.register` to serve `onnxruntime-web` WASM/MJS binaries locally and manage disk caching / lazy downloading of `FastSAM-s.onnx`. |
| **Shared Invariant** | `src/invariant.ts` | Shared constants, route paths, and TypeScript interfaces between Node host and Browser client. |
| **Browser Client** | `src/client/index.tsx` | Registers the `name-tag` tab into DSH `conversation.view` slot (`order: 999`) and registers `T.js` EN/ZH dictionaries into `ctx.locale`. |

## 2. Strict OOP Module Breakdown

All runtime logic is encapsulated in single-responsibility classes under `src/client/core/`:

- `TranslationCatalog` (`src/client/T.js`): Bilingual dictionary store & static interpolation helpers.
- `NameTagStyles` (`src/client/S.js`): Pure Material Design 3 token generator & scoped CSS builder for dark/light themes.
- `LocaleService` (`src/client/core/LocaleService.ts`): Reactive binding to DSH global `ctx.locale` and `<html lang>`.
- `ThemeService` (`src/client/core/ThemeService.ts`): Reactive observer for DSH `body[data-ds-dark-theme]`.
- `ColorPalette` (`src/client/core/ColorPalette.ts`): Deterministic vivid color assignment per bounding box.
- `GranularityFilter` (`src/client/core/GranularityFilter.ts`): Containment NMS & granularity preset math inherited from [Source 001](../raw/001-project-inception-and-requirements.md).
- `ModelCacheStore` (`src/client/core/ModelCacheStore.ts`): Two-tier local cache check (IndexedDB -> Host `/api/name-tag/model`) with streaming lazy-load progress.
- `FastSamInferenceEngine` (`src/client/core/FastSamInferenceEngine.ts`): `onnxruntime-web` WebGPU/WASM session, RGB letterbox preprocessor, and YOLOv8-seg tensor decoder.
- `CameraController` (`src/client/core/CameraController.ts`): `navigator.mediaDevices.getUserMedia` lifecycle, device enumeration, and stream switching.
- `SavedPresetModels` (`src/client/core/SavedPresetModels.ts`): OOP domain classes `SavedPresetItem` (`id`, `text`, `selected`, `settings`) and `GranularitySettings`.
- `CameraScopeModels` (`src/client/core/CameraScopeModels.ts`): Immutable OOP domain classes `CameraScopeItem` (with protected built-in `ALL_ID = 'all'` and `HUMAN_FACE_ID = 'human-face'`) and `CameraScopeCollection` managing unbounded user-added camera dropdown entries, selection, inline renames, and safe deletion.
- `CameraTipsScheduler` (`src/client/core/CameraTipsScheduler.ts`): OOP timer coordinator driving the non-dismissible floating Tips bubble (5s visible burst on every camera start, repeating every 60s until camera stop).
- `PreferencesStore` (`src/client/core/PreferencesStore.ts`): 100% browser-local persistence (`localStorage`) for Granularity panel state, card collapse, `SavedPresetItem` list, and `CameraScopeCollection` state.
- `Gemma2EmbeddingEngine` & `Gemma2LangChainEmbeddings` (`src/client/core/Gemma2EmbeddingEngine.ts`): Client-side EmbeddingGemma 2 (`onnx-community/embeddinggemma-2-ONNX`) encoder & LangChain `Embeddings` subclass.
- `IndexedDbLangChainVectorStore` & `BrowserTargetVectorRepository` (`src/client/core/BrowserVectorStore.ts`): 100% browser-local LangChain `VectorStore` persisted in Browser IndexedDB (`dsh-name-tag-vectors`), storing 6-vector target indices + metadata with zero server state.
- `VectorTableFormatter` (`src/client/core/VectorTableFormatter.ts`) & `VectorDbModal` (`src/client/components/VectorDbModal.tsx`): 5-column database inspector (`index`, `augmentation`, `title`, `description`, `timestamp`) with 5-head/5-tail vector formatting and resizable `title`/`description` columns.
- `ObjectCropTracker` (`src/client/core/ObjectCropTracker.ts`): Multi-frame IoU stability tracker (`STABLE_FRAMES = 3`, `REQUERY_MS = 2000`) buffering the sharpest 12%-padded dilated cutout per object.
- `PocketCaptureManager` (`src/client/core/PocketCaptureManager.ts`) & `PocketFloatingWindow` (`src/client/components/PocketFloatingWindow.tsx`): Deduplicated match accumulator (`targetId`) and draggable narrow vertical Pocket window.

## 3. Atomic UI Component Hierarchy

- `NameTagWorkspace`: Top-level split-screen shell with `data-conversation-composer-overlay=""`.
- `CameraViewport`: Video stream + synchronized `<canvas>` segmentation overlay + top-left HUD hosting `CameraScopeDropdown` + lazy-load status overlay.
- `CameraScopeDropdown`: Atomic editable dropdown at the top-left of the camera viewport with immutable built-in “所有” (All) & “人脸” (Human Face), continuous Enter-to-add input (IME-safe), inline rename for custom entries, per-item `×` deletion, and a non-dismissible floating Tips bubble driven by `CameraTipsScheduler`.
- `SplitPaneDivider`: Interactive draggable split handle ("把手") with pointer capture & double-click 50/50 reset.
- `CameraControlStrip`: Camera start/stop, device selector, model cache/lazy-load status strip.
- `GranularityCard`: Material Design 3 card implementing **“颗粒度”实时调控面板**.
- `MdSliderField`: Reusable MD3 slider field atom.

## Related Pages
- [Model Lazy-Load & FastSAM-s Contract](./model-lazyload-and-fastsam.md)
- [Granularity Engine](./granularity-engine.md)
- [UI & Design System](./ui-and-design-system.md)
- [Progress & Roadmap](./progress-and-roadmap.md)
