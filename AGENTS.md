# Engineering & Execution Guide (`name-tag`)

This document defines the **permanent, feature-agnostic engineering rules and execution workflow** for working on the `name-tag` DSH Web plugin project. Every agent or contributor modifying this repository MUST follow these rules on every task.

---

## 1. Strict OOP Discipline & Explicit Boundaries

### 1.1 Core OOP Rules
- **Class-First Design**: Extract reusable logic, state coordination, persistence, inference pipelines, geometric math, and domain entities into dedicated TypeScript/JavaScript `class` modules with explicit `public` / `private` / `readonly` members.
- **No Standalone Global Functions**: Do **not** declare top-level helper/utility functions outside classes. Place pure helpers and stateless algorithms as `static` methods on the owning class (e.g., `GranularityFilter.filterBoxes(...)`, `CanvasOverlayRenderer.hitTest(...)`, `TranslationCatalog.translate(...)`).
- **Domain Entities Over Plain Bags**: Non-trivial stateful items (such as saved presets or configuration records) should be modeled as explicit OOP classes with immutable transition methods (e.g., `withText(...)`, `withSelected(...)`, `toJSON()`) rather than ad-hoc plain object mutations.

### 1.2 Explicit OOP Boundaries (Permitted Non-Class Exceptions)
Non-class top-level declarations are allowed **only** at framework integration boundaries:
1. **DSH / Cordis Entrypoint Exports**: `export const name`, `export const inject`, and `export function apply(ctx)` in `src/index.ts`, `src/invariant.ts`, and `src/client/index.tsx`. Even here, `apply(ctx)` MUST remain a thin 1–3 line adapter delegating immediately to a class (e.g., `new NameTagHostServer().register(ctx)`, `NameTagClientPlugin.register(ctx)`).
2. **Atomic React Functional Components**: View components under `src/client/components/*.tsx` may be React function components, strictly scoped to declarative JSX rendering and UI event wiring. All business logic, canvas rendering math, storage I/O, and ML pipelines MUST live in OOP classes outside the component.

---

## 2. Atomic Components & Dedicated Asset Files

- **Atomic UI Decomposition**: Keep each React component small and single-responsibility (one card, one modal, one divider handle, one control atom). Avoid monolithic multi-hundred-line JSX files mixing unrelated concerns.
- **Dedicated Translation Module (`src/client/T.js`)**:
  - Store all user-facing strings (Chinese `ZH` and English `EN`) inside `TranslationCatalog` in `src/client/T.js`, synced with DSH's global locale (`ctx.locale` + `<html lang>`).
  - `ZH` and `EN` dictionaries MUST always contain identical key sets.
  - **Zero Dead Wording**: Whenever UI text is removed or refactored, audit `src/` and immediately prune any unused keys from `T.js`.
- **Dedicated Style Module (`src/client/S.js`)**:
  - Store all styling inside `NameTagStyles` in `src/client/S.js`.
  - Follow zero-dependency pure **Material Design 3 (MD3)** styling conventions, dynamically adapting to DSH dark/light themes (`body[data-ds-dark-theme]`). Do not introduce heavy external UI component libraries.

---

## 3. DSH Dual-Face Plugin & Bundling Invariants

- **Exact Host Routes Only**: DSH's `ctx.connection.fetch.register` enforces exact `/api/...` path matching (wildcards are not supported). Register each asset or endpoint with an explicit exact path.
- **Browser Bundle Isolation (`lib/client.js`)**:
  - `tsdown` compiles the browser half into a CJS `window.__ModuleLoader__.load(...)` closure. Never allow Node-only modules (`fs`, `path`, `url`, `child_process`, `sharp`, etc.) or unreplaced `import.meta` into `lib/client.js`.
  - Keep host-provided platform packages (`react`, `react/jsx-runtime`, `react-dom`, `@deepseek-ai/*`) in `neverBundle`, and explicitly alias browser builds (e.g., `transformers.web.js`) when dependencies ship Node entrypoints.
- **Transport & Error Handling**:
  - Browser HTTP calls to `/api/*` MUST use `globalThis.__DSH_TRANSPORT__?.fetch ?? globalThis.fetch` so DSH authentication headers are preserved.
  - Always read `res.text()` and parse JSON inside `try/catch` before throwing, so plain-text `401`/`404` responses surface actionable diagnostics instead of JSON parse crashes.

---

## 4. 100% Client-Side AI, Caching, Storage & Framework Abstraction Rules

- **100% Client-Side AI & User Data Isolation (Mandatory Invariant)**:
  - All AI model inference, computer vision processing, user preferences/presets, and LangChain vector database storage/retrieval MUST execute and persist strictly inside each user's browser (`WebGPU`/`WASM`, `IndexedDB`, `CacheStorage`, `localStorage`).
  - Never add server-side endpoints that persist user vectors, labels, or preferences on the DSH Node host; the Node host must remain strictly limited to stateless, read-only public static asset serving (`/api/name-tag/ort/*`, `/api/name-tag/model`).

- **Lazy-Load First**: Models and heavy assets MUST check local caches first (IndexedDB / CacheStorage / Host disk cache). Never trigger network downloads on startup or when a valid local copy already exists.
- **Cache Symmetry & Visibility**:
  - Every filesystem directory or browser cache introduced by the project MUST be surfaced in the storage-paths diagnostic metadata and wiped cleanly by the unified cache-clear operation.
- **Framework Abstraction Integrity**:
  - When integrating vector databases or embedding runtimes via LangChain JS, interact exclusively through LangChain abstractions (`Embeddings`, `Document`, `VectorStore` / `FaissStore`) rather than calling low-level database driver APIs directly.

---

## 5. Mandatory Post-Task LLM Wiki Maintenance

- **Standalone Project Wiki**: This project owns an independent `.wiki/` directory at `DSH-Plugins/name-tag/.wiki/`. Never mix its pages or logs with any parent repository `.wiki/`.
- **LLM Wiki Standard**: Maintain `.wiki/` strictly according to Andrej Karpathy's **LLM Wiki** specification:
  [https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md)
- **Required Bookkeeping After Every Task**:
  1. Respect the 3-layer split defined in `.wiki/AGENTS.md`: `raw/` (immutable sources), `wiki/` (maintained synthesis pages), and `.wiki/AGENTS.md` (schema).
  2. Update relevant `wiki/` pages (e.g., architecture, troubleshooting, roadmap) whenever code contracts, invariants, or debugging insights change.
  3. Keep `.wiki/index.md` up to date with every page in `raw/` and `wiki/`.
  4. Append a dated entry (`## [YYYY-MM-DD] <operation> | <short title>`) to `.wiki/log.md` summarizing what was built, fixed, ingested, or linted.

---

## 6. Verification Gate Before Completing Any Task

1. Run `pnpm run build` (`tsc && tsdown`) and verify zero TypeScript or bundling errors.
2. Audit `lib/client.js` whenever browser dependencies or bundling configs change to ensure no Node-only `require(...)` leaked into the browser closure.
3. Audit `src/client/T.js` whenever UI wording changes to ensure EN/ZH key parity and zero unused keys.
4. Run `pnpm test` (`node --test tests/*.test.mjs`) and confirm 100% pass rate (adding/updating unit tests for any new or modified behavior).
5. If Node host code (`src/index.ts`, `src/invariant.ts`, `src/vector-store.ts`) changed, explicitly remind the user to restart `pnpm dsh web` (browser refresh alone only hot-serves `lib/client.js`).
