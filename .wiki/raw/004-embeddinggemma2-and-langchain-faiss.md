# Source 004: EmbeddingGemma 2 Client Encoding + LangChain JS FAISS Persistence

- **Date**: 2026-11-17
- **Source**: Direct user specification
- **Status**: Immutable Increment

## Requirements
1. In the **「目标标记」** modal, both `title` and `description` are **required**.
2. Clicking **「保存」** encodes all 6 images (original cutout + 5 augmentations) into 768-d vectors in the browser using **EmbeddingGemma 2** (`onnx-community/embeddinggemma-2-ONNX`, `q4`, audio encoder disabled).
3. All 6 vectors are stored via **LangChain JS + FAISS (`FaissStore`)** without calling raw DB interfaces directly; each vector acts as an index pointing to shared `title` / `description` metadata plus `imageKind`, `isOriginal`, and `augmentation` markers.
4. Embedding model download/lazy-load happens together with `FastSAM-s` when starting the camera.
5. Both the FAISS index directory (`~/.dsh/cache/name-tag/faiss-index`) and the EmbeddingGemma 2 browser cache (`transformers-cache`) are part of the cache system and wiped cleanly on **「清缓存」**.
