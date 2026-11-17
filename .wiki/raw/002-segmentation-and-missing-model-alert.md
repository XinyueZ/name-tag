# Source 002: Switch to Segmentation Visualization & Missing-Model Alert

- **Date**: 2026-11-16
- **Source**: Direct user instruction
- **Status**: Immutable Increment

## Updates
1. **Missing Local Model Indicator**: If no local `FastSAM-s` model is found (neither in browser IndexedDB nor Host disk cache), display a `❗️` alert badge on the **top-right corner** of the **Preload Model** button.
2. **Segmentation Instead of Bounding Boxes**: Replace rectangular bounding box overlays with colored instance **segmentation masks** synthesized from FastSAM-s prototype outputs (`outputs[1]` + mask coefficients), while preserving real-time granularity filtering.
