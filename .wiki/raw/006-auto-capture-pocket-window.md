# Source 006: Auto-Capture Matching & Floating Pocket Window

- **Date**: 2026-11-17
- **Source**: Direct user specification
- **Status**: Immutable Increment

## Requirements
1. Continuously and automatically capture kept segmented objects on the live camera feed, extract each object's background-removed cutout (using its corresponding bbox + segmentation mask), encode into vectors via `EmbeddingGemma 2`, and search the LangChain `FaissStore` for the closest match.
2. Add a similarity threshold slider (`0` to `1`, default `0.78`) in the first control card.
3. Once a match meets `cosineSimilarity >= threshold`, pop up a narrow, draggable floating **Pocket** window (`口袋`) displaying the matched camera cutouts (background-removed images only, NOT database indices or text) stacked top-to-bottom.
4. Deduplicate matched entries by `targetId` and retain captured items in the pocket even after the object leaves the frame (until closed or cache-cleared).
