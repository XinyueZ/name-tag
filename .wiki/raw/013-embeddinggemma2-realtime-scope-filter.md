# 013 — Real-Time EmbeddingGemma 2 Contrastive Semantic Scope Filter (Supersedes Valen 0.8B)

- **Date**: 2026-11-19
- **Decision**: Replace the heavy 2.46 GB Valen-Decision-1.5-0.8B VLM filter (which could not keep up with real-time camera FPS) with a zero-extra-model real-time semantic filter reusing the already-loaded `EmbeddingGemma 2` (768-d shared Vision+Text space).
- **Design**:
  1. Bottom layer (`FastSAM-s` + `GranularityFilter`) stays intact; `'All'` bypasses semantic filtering 100%.
  2. For non-`'All'` dropdown items (e.g., `'Human Face'` or `'labubu'`), encode positive prompts (`a photo of ...`, `a close-up of ...`, raw text) and cached negative background prompts once per scope change, optionally fusing a few-shot visual centroid from matching titles in `BrowserTargetVectorRepository`.
  3. Track all live `FastSAM-s` segments via IoU (`SemanticScopeFilter`), score each stable track's sharpest cutout once with `EmbeddingGemma 2` (re-verifying every 2s), and compute a temperature-scaled contrastive probability in `[0, 1]`.
  4. Reuse the exact same 768-d image vector for downstream Pocket vector DB search (one vector, two uses) — strictly gating canvas overlay, click-to-tag, and Pocket auto-capture to passed tracks only (supporting multiple instances simultaneously).