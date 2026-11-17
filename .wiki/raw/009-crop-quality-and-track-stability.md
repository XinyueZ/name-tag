# Source 009: Continuous Crop Quality & Track Stability Optimization

- **Date**: 2026-11-17
- **Source**: User reference `/Users/xinyue.zhao/Desktop/dev/AI/sc-on-device-ai-memory/robot/brain/detect.py`
- **Status**: Immutable Increment

## Adopted Optimizations
1. **12% Padded Crop + Prototype Mask Dilation (`CutoutAugmenter`)**:
   - Increased crop margin from `4%` to `12%` (`PAD = 0.12`).
   - Added 3×3 morphological dilation (`dilateBinaryMask`) in prototype mask space before bilinear upsampling so tight segmentation boundaries never shave off object edges.
2. **Laplacian Crop Quality Scoring (`CutoutAugmenter.computeCropQuality`)**:
   - Evaluates `score * sqrt(areaRatio) * min(laplacianVariance, 1200)` on a 96×96 grayscale sample to rank frame sharpness and framing.
3. **Multi-Frame IoU Track Stability & Sharpest-Crop Buffering (`ObjectCropTracker`)**:
   - Tracks objects via IoU (`>= 0.35`), requires `STABLE_FRAMES = 3` before querying embeddings, prioritizes by `salience = sqrt(area) * (1 - centerDistance)`, buffers only the sharpest cutout between `REQUERY_MS = 2000` cycles, and decays/clears stale boxes cleanly when objects disappear.
