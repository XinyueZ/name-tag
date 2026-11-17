# Progress & Roadmap

## Current Milestone: Phase 1 — Camera + FastSAM-s + Granularity Panel
- **Status**: Complete (Built, Unit-Tested & Registered to DSH Web Profile)
- **Deliverables**:
  - [x] Standalone `name-tag/.wiki/` knowledge base initialized (Karpathy LLM Wiki pattern)
  - [x] Dual-face plugin scaffold (`package.json`, `cordis.patch.yml`, `tsdown.config.ts`, `tsconfig.json`)
  - [x] Node host routes (`src/index.ts`, `NameTagHostServer`) for `onnxruntime-web` assets & lazy-load `FastSAM-s.onnx` disk caching
  - [x] `src/client/T.js` (`TranslationCatalog` EN/ZH) & `src/client/S.js` (`NameTagStyles` pure Material Design 3 tokens & CSS)
  - [x] OOP Core (`GranularityFilter`, `FastSamInferenceEngine`, `ModelCacheStore`, `CameraController`, `ColorPalette`, `LocaleService`, `ThemeService`)
  - [x] Atomic UI Components (`NameTagWorkspace`, `CameraViewport`, `SplitPaneDivider`, `CameraControlStrip`, `GranularityCard`, `MdSliderField`)
  - [x] Build (`pnpm run build`), 9 unit tests passing (`pnpm test`), and permanent registration in `~/.dsh/profiles/web/package.json`

## Planned Future Phases (Backlog)
- **Phase 2 (Done)**: Interactive segmentation click hit-testing + **「目标标记」** modal dialog with transparent RGBA cutout + 5 augmentations (Horizontal Flip, Scale, Color Jitter, Slight Rotation, Slight Gaussian Blur) in a 2×3 grid.
- **Phase 4 (Done)**: Client-side **EmbeddingGemma 2** (`onnx-community/embeddinggemma-2-ONNX`) lazy-loaded alongside FastSAM-s on camera start; Target Tagging Save validates required `title` & `description`, encodes 6 images (flattened onto neutral `#808080` gray), and indexes via **LangChain JS `FaissStore`** into `~/.dsh/cache/name-tag/faiss-index`.
