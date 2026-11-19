# 015 — Post-Recognition Semantic Gate & Negative-Prompt Conflict Guard

- **Date**: 2026-11-19
- **Insight & Requirement**:
  1. Keep Layer 1 (`SemanticScopeFilter` mask filter) open and forgiving—do NOT add aggressive DB hard negatives that would block humans from clicking/tagging small items, clutter, or walls, and drop any default background negative prompt that conflicts with the user's chosen scope (`wall`, `墙壁`, `desk`, `杂物`).
  2. Add a **Post-Recognition Semantic Gate** right after vector DB recognition determines `{ targetId, title, description }`: verify via fast literal match + cached cross-lingual `EmbeddingGemma 2` text comparison (with a person/family text distractor strictly inside post-recognition verification when scope ≠ `human-face`) so e.g. a glasses-wearing `papa` never draws a `papa` BBox or enters the Pocket when filtering for `glass` / `眼镜`.