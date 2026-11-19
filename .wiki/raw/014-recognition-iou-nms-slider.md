# 014 — Recognition Dedup IoU Slider & Tighter-Inner-Box NMS

- **Date**: 2026-11-19
- **Problem**: When FastSAM-s segments both the surrounding wall/background and the foreground subject (e.g., `papa`), the outer background bbox encloses the inner subject bbox (`IoU ≈ 0.35–0.51`), causing both an outer giant `papa` box and an inner tight `papa` box to render simultaneously.
- **Solution**:
  1. Add a persisted **`Recognition Dedup IoU` (`recognitionIouThreshold`, default `0.30`)** slider directly below `Capture Match Similarity` in `CameraControlStrip` (Card 1).
  2. Add `PocketCaptureManager.suppressOverlappingDetections(detections, iouThreshold)` sorting detections ascending by area (tighter inner box first) and suppressing overlapping outer boxes when `IoU ≥ threshold`.
  3. Harden `ObjectCropTracker.updateFrame` and `PocketCaptureManager.trackRecognizedBoxes` with a scale-ratio guard (`scaleRatio > 2.5 && iou < 0.55`) so foreground tracks cannot jump onto enclosing background walls.