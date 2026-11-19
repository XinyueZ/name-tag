# Post-Segmentation Semantic Filtering & Model Trade-offs

This page documents the **second filtering layer** placed directly above `FastSAM-s` + `GranularityFilter`, its current implementation (`SemanticScopeFilter`), and the architectural trade-offs behind reusing `EmbeddingGemma 2` instead of running a standalone VLM such as [`Valen-Team/valen-sdk-js`](https://github.com/Valen-Team/valen-sdk-js).

## 1. Two-Layer Post-Segmentation Architecture

1. **Layer 1 — Geometric & Structural Granularity (Always Preserved)**:
   - `FastSAM-s` runs single-pass class-agnostic segmentation at ~20 FPS, followed by `GranularityFilter` (Containment NMS `τ_nest`, min relative area %, objectness confidence) to produce clean whole-object masks.
2. **Layer 2 — Semantic Scope Gate (`SemanticScopeFilter`)**:
   - Controlled by the top-left `CameraScopeDropdown` (`src/client/components/CameraScopeDropdown.tsx`), which ships two locked built-in entries (**All / 所有** and **Human Face / 人脸**) plus unbounded user-entered items (e.g., `labubu`) and a persisted `scopeConfidenceThreshold` slider (`0.00–1.00`, default `0.50`).
   - **When `All` is selected**: Layer 2 is **100% bypassed** (identical to pre-filter behavior, zero overhead).
   - **When any non-`All` item is selected**: Only tracks passing `score ≥ scopeConfidenceThreshold` proceed downstream to Canvas overlay rendering, click-to-tag (`TargetTagModal`), and Pocket auto-capture (`BrowserTargetVectorRepository` + `PocketFloatingWindow`).

## 2. Current Implementation (`src/client/core/SemanticScopeFilter.ts`)

Rather than introducing another model, `SemanticScopeFilter` leverages the fact that `EmbeddingGemma 2` (`onnx-community/embeddinggemma-2-ONNX`) already lives in the user's browser and maps **both images and text into a shared 768-dimensional L2-normalized vector space**:

1. **One-Time Contrastive Prototype Encoding (`< 20 ms` per scope switch)**:
   - Positive prompts (`a photo of {target}`, `a close-up of {target}`, `{target}`; or dedicated human-face prompts for `human-face`) are averaged and L2-normalized into a unit centroid $v_+$.
   - Generic background/distractor prompts (`background wall floor ceiling`, `an empty desk table or room surface`, `an unrelated everyday object`, `blurry edge shadow or noise`) are encoded once and cached in memory as $\{v_-\}$.
   - **Few-Shot Visual Fusion**: `BrowserTargetVectorRepository.getVectorsByTitle()` queries the user's local IndexedDB vector store for any previously tagged entries matching the active scope name (e.g., a user-tagged `labubu`) and computes an optional visual centroid $v_{\text{vis}}$.
2. **Multi-Instance IoU Tracking & Sharpest-Crop Buffering**:
   - Each live `FastSAM-s` mask is matched to a persistent `trackId` via IoU (`MATCH_IOU_THRESHOLD = 0.25`) so moving targets follow at full 20 FPS without re-embedding every frame.
   - Laplacian variance (`CutoutAugmenter.computeCropQuality`) buffers the sharpest 12%-padded dilated cutout per track; tracks are embedded once stable (`STABLE_FRAMES = 2`) and re-verified every `REQUERY_MS = 2000` ms.
3. **Contrastive Margin Scoring (`< 0.01 ms` per track)**:
   - Raw cross-modal cosine similarity typically sits in a narrow range (`0.15–0.35`). We convert the margin against the strongest negative prompt into an intuitive `[0, 1]` probability via temperature-scaled logistic sigmoid (`T = 0.05`):
     $$\text{posSim} = v_{\text{img}} \cdot v_+, \quad \text{maxNegSim} = \max_k (v_{\text{img}} \cdot v_{-,k})$$
     $$\text{textProb} = \frac{1}{1 + \exp\big((\text{maxNegSim} - \text{posSim}) / T\big)}$$
     When $\text{posSim} = \text{maxNegSim}$, $\text{textProb} = 0.50$ exactly, aligning cleanly with the default `0.50` slider.
   - When a few-shot visual centroid $v_{\text{vis}}$ exists, $\text{finalScore} = \max(\text{textProb}, \text{clamp}_{0..1}(v_{\text{img}} \cdot v_{\text{vis}}))$.
4. **One Vector, Two Uses (Zero Redundant Inference)**:
   - For every track that passes `finalScore ≥ scopeConfidenceThreshold`, the **exact same 768-d `v_img`** is forwarded directly to `BrowserTargetVectorRepository.searchMatches(..., matchThreshold)` for Pocket recognition — zero duplicate encoding.

## 3. Architectural Trade-offs: Why Not a Standalone Model Like Valen?

We prototyped and benchmarked integrating [`Valen-Team/valen-sdk-js`](https://github.com/Valen-Team/valen-sdk-js) (`Valen-Decision-1.5-0.8B-ONNX`, `web-portable` variant with `#bbox-questions`) as a dedicated client-side filter ([Source 012](../raw/012-valen-bbox-semantic-filter-layer.md)) before pivoting to `SemanticScopeFilter` ([Source 013](../raw/013-embeddinggemma2-realtime-scope-filter.md)). Empirical findings:

| Dimension | Reusing `EmbeddingGemma 2` (`SemanticScopeFilter`) | Standalone VLM ([`valen-sdk-js`](https://github.com/Valen-Team/valen-sdk-js) 0.8B `bbox`) | Specialized Ultra-Light Detector (e.g., BlazeFace / YOLO-World) |
| :--- | :--- | :--- | :--- |
| **Extra Download Size** | **0 MB** (already loaded & cached) | **+2.46 GB** (`web-portable`, incl. 970 MiB FP32 embedding table) | ~0.3–1 MB (face only) / 40–150 MB (open-vocab) |
| **Per-Frame / Filter Latency** | **< 0.01 ms** dot-product (reuses Pocket image vector; text encoded once in <20 ms) | **2–4 s / call** on browser WebGPU — cannot keep up with 20 FPS live video | 2–5 ms (BlazeFace) / 40–100 ms (YOLO-World) |
| **Runtime Isolation with FastSAM-s** | **Isolated** (`transformers.web.js` ORT runtime — zero FPS drop on FastSAM-s) | **Contends on shared `onnxruntime-web` Asyncify stack** (requires global mutex, stalling FastSAM-s) | Requires separate ORT session / worker coordination |
| **Multi-Instance Support** | **Native** (filters 2+ faces or multiple custom objects simultaneously) | Single primary `bbox` per question call | Native |
| **Niche IP / Custom Objects (`labubu`)** | Zero-shot text + **instant few-shot boost** once tagged once in local Vector DB | Strong open-world reasoning, but slow & heavy | BlazeFace is face-only; open-vocab detectors still struggle on unseen IPs without fine-tuning |
| **Network / Firewall Footprint** | Reuses existing `transformers-cache`; no extra multi-GB HuggingFace pull | Multi-GB pull sensitive to enterprise firewalls & browser CacheStorage quota | Moderate extra assets |

### Conclusion & Future Extensibility
- **Why Valen is not used here**: `Valen-Decision-1.5-0.8B` is a powerful System-1 multimodal decision/grounding model designed for complex, lower-frequency reasoning rather than 20 FPS real-time video gating inside a browser tab already running `FastSAM-s` + `EmbeddingGemma 2`.
- **Why `SemanticScopeFilter` wins for Name Tag**: Zero extra model download, full 20 FPS segmentation smoothness, native multi-instance filtering, one-vector-two-uses efficiency, and automatic few-shot accuracy gains from the user's own tagged Vector DB.
- **Future option**: If ultra-fast 60 FPS face-only gating ever becomes a dedicated requirement, a tiny (<1 MB) specialized face detector (e.g., BlazeFace) can be plugged in exclusively for `human-face` while keeping `SemanticScopeFilter` for open-vocabulary custom scopes.

## Related Pages
- [Architecture Overview](./architecture.md)
- [Granularity Engine](./granularity-engine.md)
- [UI & Design System](./ui-and-design-system.md)
- [Troubleshooting](./troubleshooting.md)