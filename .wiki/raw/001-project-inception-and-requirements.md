# Source 001: Project Inception & Requirements Baseline

- **Date**: 2026-11-16
- **Source**: Direct user specification + inherited logic from `session-3e15545d-7233-45ab-9ebc-42a3f8d582e1` (`edge_class_agnostic_detection_tech_analysis.html`)
- **Status**: Immutable Baseline

## 1. Product Vision ("Name Tag")
A dedicated, permanent DSH Web plugin (`name-tag`) added as the **last tab** in the DSH Web `conversation.view` tab strip.

### Long-Term Pipeline Context
1. Live camera continuously captures video frames in the browser (Mac, Windows, Android).
2. Class-agnostic detector (`FastSAM-s` in Phase 1) proposes whole-object bounding boxes without requiring object class classification.
3. Real-time granularity controls filter out overly fine sub-parts (e.g., mouth/ears/glasses inside faces, door/handle inside cars) while allowing user-tunable coarseness.
4. *(Future Phases)* User interactively picks a bounding box -> crop + 4 classic augmentations = 5 images -> local embedding (CLIP / Gemma Embedding 2) -> store 5 index vectors into a vector database.

## 2. Phase 1 Scope (Initial Foundation)
1. **DSH Web Tab**: Placed last in `conversation.view`, label `Name Tag`.
2. **Split-Screen Workspace**:
   - Initially 50% / 50% left/right split.
   - Draggable center divider handle ("把手") allowing smooth left/right resizing.
3. **Left Pane (Live Camera + BBox Overlay)**:
   - Continuous camera stream (`getUserMedia`).
   - Lazy-load `FastSAM-s` ONNX model: check local cache first; if present do not re-download; if missing, download & cache (`lazyload`).
   - Run real-time inference and draw detected bounding boxes in distinct colors over the camera viewport.
   - Granularity parameters in the right panel apply immediately to the displayed boxes.
4. **Right Pane (Material Design 3 Functional Panel)**:
   - Pure Material Design 3 styling (zero heavy external UI library).
   - First card titled **“颗粒度”实时调控面板** (ZH) / **“Granularity” Real-Time Control Panel** (EN).
   - Inherits logic from `session-3e15545d-7233-45ab-9ebc-42a3f8d582e1`:
     - Presets: `偏粗 (Coarse)` / `均衡 (Balanced)` / `偏细 (Fine)`
     - Master Granularity slider (`0..100`) mapping to linked parameters:
       - Containment ratio threshold $\tau_{\text{nest}} \in [0.60, 0.96]$
       - Minimum relative area percentage $\text{minArea} \in [0.3\%, 3.4\%]$
       - Confidence threshold $\text{conf} \in [0.20, 0.55]$
     - Independent fine-tuning sliders for $\tau_{\text{nest}}$, `minArea`, and `conf`.
     - Toggle to display/hide suppressed nested sub-boxes (dashed overlay).
     - Live counters: kept boxes, suppressed boxes, post-processing latency (ms), inference FPS/latency.
5. **Bilingual i18n**: English & Chinese following DSH global language setting, stored in `T.js`.
6. **Styling & Code Discipline**:
   - `S.js` stores styles.
   - Strict OOP: reusable logic extracted into classes; static class methods instead of global functions (except DSH-required plugin entrypoints).
   - Atomic UI components.
7. **Project Wiki**: Standalone `.wiki/` at `DSH-Plugins/name-tag/.wiki/` following Karpathy's `llm-wiki.md`.
