# 016 — Match Candidates Top-K Slider & Competitive Margin Selection

- **Date**: 2026-11-19
- **Problem**: Because `BrowserTargetVectorRepository.searchMatches` previously fetched only Top-1 (`k = 1`), filtering for `papa` when `papa` wore glasses could fail completely whenever `glass` ranked #1 (e.g., `0.84`) and `papa` ranked #2 (`0.82 ≥ 0.78`): the post-recognition gate rejected `glass` and never saw `papa`.
- **Solution**:
  1. Upgrade `BrowserTargetVectorRepository.searchMatches(vectors, threshold, topK)` to return up to `topK` distinct `targetId` candidates above `threshold`.
  2. Add `SemanticScopeFilter.selectScopedMatch()` with `COMPETITIVE_MARGIN = 0.08`, selecting the highest-similarity scope-verified candidate within `0.08` of Top-1 (recovering `papa` at `0.82` behind `glass` `0.84` while still rejecting a pure glasses cutout where `glass 0.94` crushes `papa 0.79`).
  3. Add a persisted **`Match Candidates Top-K` (`matchTopK`, `1 ~ 20`, default `5`)** slider in Card 1 (`CameraControlStrip`).