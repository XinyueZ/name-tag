# Name Tag Knowledge Index

Content catalog for the **`name-tag`** DSH Web plugin project. Read this index first to locate relevant architecture, algorithm, and status pages.

## Schema & Governance
- [../README.md](../README.md) — Bilingual (EN/ZH) project README with side-by-side TOC, global DSH Web installation, model/framework rationale, workflow PNG, and UI reference.
- [../AGENTS.md](../AGENTS.md) — Project-wide engineering, OOP boundary, bundling, and post-task verification rules.
- [AGENTS.md](./AGENTS.md) — Wiki architecture, conventions, ingest/query/lint workflows, and project invariants.
- [log.md](./log.md) — Chronological append-only ledger of wiki updates, builds, and milestones.

## Raw Sources (Immutable)
- [001-project-inception-and-requirements.md](./raw/001-project-inception-and-requirements.md) — Initial requirements, inherited `session-3e15545d` granularity specs, OOP/T.js/S.js rules.
- [002-segmentation-and-missing-model-alert.md](./raw/002-segmentation-and-missing-model-alert.md) — Switch to instance segmentation overlay and `❗️` alert badge on missing local model.
- [003-target-tagging-modal-and-augmentations.md](./raw/003-target-tagging-modal-and-augmentations.md) — Target Tagging modal with 2×3 transparent cutout + 5 augmentations and Save close action.
- [004-embeddinggemma2-and-langchain-faiss.md](./raw/004-embeddinggemma2-and-langchain-faiss.md) — Client-side EmbeddingGemma 2 encoding and LangChain JS FaissStore vector indexing.
- [005-vector-db-table-viewer.md](./raw/005-vector-db-table-viewer.md) — Database button next to Mirror and 4-column table modal with resizable title/description columns.
- [006-auto-capture-pocket-window.md](./raw/006-auto-capture-pocket-window.md) — Continuous auto-capture matching against FAISS with 0..1 similarity slider (default 0.78) and draggable floating Pocket window.
- [008-full-client-side-browser-migration.md](./raw/008-full-client-side-browser-migration.md) — Migration of vector DB and preferences 100% to Browser IndexedDB/localStorage for multi-user isolation.
- [009-crop-quality-and-track-stability.md](./raw/009-crop-quality-and-track-stability.md) — 12% padded dilated crop, Laplacian sharpness scoring, and multi-frame ObjectCropTracker.
- [010-camera-scope-editable-dropdown.md](./raw/010-camera-scope-editable-dropdown.md) — Top-left editable camera dropdown with immutable default “所有” (All), continuous Enter-to-add input, and per-item `×` deletion.
- [011-human-face-scope-and-tips-bubble.md](./raw/011-human-face-scope-and-tips-bubble.md) — Built-in immutable “人脸” (Human Face) option and non-dismissible 5s/60s floating Tips bubble on camera start.

## Wiki Pages (Maintained)
- [architecture.md](./wiki/architecture.md) — Dual-face DSH plugin structure, OOP classes, and atomic component hierarchy.
- [model-lazyload-and-fastsam.md](./wiki/model-lazyload-and-fastsam.md) — 3-tier lazy-load cache pipeline (IndexedDB -> Host disk -> HF) and FastSAM-s tensor contracts.
- [granularity-engine.md](./wiki/granularity-engine.md) — Containment NMS algorithm, presets, and comprehensive granularity slider formulas.
- [ui-and-design-system.md](./wiki/ui-and-design-system.md) — Split-pane handle layout, pure MD3 tokens in `S.js`, `T.js` bilingual i18n, and bbox styling.
- [progress-and-roadmap.md](./wiki/progress-and-roadmap.md) — Current Phase 1 implementation checklist and future embedding/vector-DB phases.
- [troubleshooting.md](./wiki/troubleshooting.md) — Dual-face host route skew (`404 not found` JSON error), browser bundling fixes, and ORT path resolution lessons.
