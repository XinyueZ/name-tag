# Source 008: 100% Client-Side Business, Preferences & Vector DB Migration

- **Date**: 2026-11-17
- **Source**: Direct user instruction ("我希望全部在客户端")
- **Status**: Immutable Increment

## Architectural Decision
To guarantee complete multi-user isolation when DSH Web is deployed in the cloud, **100% of business logic, model inference, user preferences, saved presets, and the LangChain vector database run strictly inside each user's browser**:
1. Replace server-side `faiss-node` / `FaissStore` with browser-side `IndexedDbLangChainVectorStore extends VectorStore` (`@langchain/core/vectorstores`) persisted in Browser IndexedDB (`dsh-name-tag-vectors`).
2. Keep `PreferencesStore` strictly in Browser `localStorage` (no `/api/name-tag/preferences` server sync).
3. Restrict Node Host (`src/index.ts`) exclusively to stateless, read-only public static delivery for `onnxruntime-web` WASM files and the public `FastSAM-s.onnx` mirror.
