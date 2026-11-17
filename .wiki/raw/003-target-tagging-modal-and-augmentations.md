# Source 003: Target Tagging Modal & 6-Image Transparent Augmentations

- **Date**: 2026-11-16
- **Source**: Direct user specification
- **Status**: Immutable Increment

## Requirements
1. Clicking a segmentation block on the camera viewport opens a modal dialog titled **「目标标记」** (`Target Tagging`).
2. Display **6 images** in a **2×3 grid** (2 rows × 3 columns):
   - Original transparent cutout
   - Horizontal Flip
   - Scale / Multi-Crop
   - Color / Exposure Jitter
   - Slight Rotation (±8°)
   - Slight Gaussian Blur
3. All 6 images remove the background as cleanly as possible using RGBA transparency (`alpha = 0`) derived from the segmentation mask.
4. Bottom-right corner has a **「保存」** (`Save`) button which currently closes the modal dialog.
