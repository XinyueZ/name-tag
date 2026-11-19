# 012 — Client-Side Valen-Decision-1.5 Bbox Semantic Filter Layer & Persisted Thresholds

- **Date**: 2026-11-19
- **Requirement Summary**:
  1. Preserve the bottom-layer `FastSAM-s` + `GranularityFilter` pipeline intact.
  2. Add a top-layer client-side semantic filter powered by `@valen-team/sdk` (`Valen.local('Valen-Team/Valen-Decision-1.5-0.8B-ONNX', { variant: 'web-portable' })`) using `bbox` questions.
  3. When the top-left dropdown selects **“所有” (All)**, bypass Valen filtering 100% (identical to prior behavior). When a specific target (e.g., “人脸” or custom “labubu”) is selected, match Valen `bbox`/`point` outputs against `GranularityFilter` masks + smooth frame-to-frame IoU tracking; only filtered segments pass downstream (canvas overlay, click-to-tag, `ObjectCropTracker`, and Pocket auto-capture).
  4. Load Valen alongside FastSAM-s and EmbeddingGemma 2 on camera start and Preload Model; surface `Cache (valen-sdk-v2)` in browser cache paths and clear it on Clear Cache.
  5. Place a Valen filter confidence slider (`scopeConfidenceThreshold`, default `0.50`) directly beneath the `<input>` inside `CameraScopeDropdown`, persisted in `PreferencesStore` (`localStorage`). Also persist the distinct Pocket cosine similarity `matchThreshold` (default `0.78`) in `PreferencesStore`.