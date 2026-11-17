# Name Tag Plugin — LLM Wiki Schema

This `.wiki/` directory is the dedicated, persistent knowledge base for the **`name-tag`** DSH Web plugin project, strictly following Andrej Karpathy's [LLM Wiki](https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f) pattern. It lives inside `DSH-Plugins/name-tag/.wiki/` and is completely independent from any parent repository wiki.

## Architecture: Three Layers

1. **`raw/` (Immutable Sources of Truth)**
   - Contains original requirements baselines, external reference notes, model specs, and session snapshots.
   - **Rule**: Never edit an existing source file in `raw/` after ingestion; add new dated source files instead.
2. **`wiki/` (LLM-Owned Compounding Knowledge Base)**
   - Structured, interlinked Markdown pages covering architecture, OOP module design, model inference contracts, granularity algorithms, UI/UX specs, and development progress.
   - **Rule**: Keep pages factual, concise, cross-linked, and synchronized with actual code in `../src/`.
3. **`AGENTS.md` (This Schema)**
   - Defines conventions, file formats, and maintenance workflows for future LLM sessions working on `name-tag`.

## Navigation & Bookkeeping Files

- **`index.md`**: Content-oriented catalog of every page in `raw/` and `wiki/`, organized by category with one-line summaries and relative links. Update on every ingest or structural change.
- **`log.md`**: Chronological append-only ledger of every operation. Each entry MUST start with:
  `## [YYYY-MM-DD] <operation> | <short title>`
  where `<operation>` is one of `init`, `ingest`, `build`, `query`, `lint`, or `milestone`.
  This supports quick inspection via `grep "^## \[" .wiki/log.md | tail -n 10`.

## Workflows

### 1. Ingest (Adding Code Changes, Specs, or Research)
1. Save new immutable reference material or requirement updates into `raw/` (if applicable).
2. Extract key facts, design constraints, and interface contracts.
3. Create or update relevant pages in `wiki/` (updating cross-references and noting superseded decisions).
4. Update `index.md` if pages were added or descriptions changed.
5. Append a dated entry to `log.md`.

### 2. Query (Answering Questions & Filing Insights Back)
1. Read `index.md` first to locate relevant `wiki/` pages, then read only the needed pages.
2. Answer with explicit references to `wiki/` pages and `../src/` files.
3. If an exploration yields a durable architectural insight or decision, file it back into `wiki/` and log it.

### 3. Lint (Periodic Wiki Health Check)
Periodically verify:
- Contradictions between `wiki/` pages and actual `../src/` implementation.
- Orphan pages not linked from `index.md`.
- Stale milestones or broken relative file links.
- Missing documentation for newly added classes, components, or API routes.

## Project Engineering Invariants (Must Always Hold)
- **Plugin Identity**: Official name `name-tag` (`@deepseek-ai/dsh-client-name-tag`), dedicated permanent DSH Web tab placed last in `conversation.view`.
- **100% Client-Side AI & Zero Server User State**: All AI model inference (`FastSAM-s`, `EmbeddingGemma 2`), business logic, user preferences/presets (`localStorage`), and the LangChain vector database (`IndexedDbLangChainVectorStore` in IndexedDB) MUST run and persist strictly in the client browser. The DSH Node host MUST remain stateless regarding user data (serving only read-only public static ORT/model assets) to guarantee multi-user isolation.
- **Strict OOP**: Prefer classes and static class methods over standalone global helper functions (except where DSH Cordis/module entrypoints require exported symbols like `name`, `inject`, `apply`).
- **Atomic Components**: Keep UI components small, single-responsibility, and decoupled from inference/storage services.
- **Dedicated Assets**:
  - `src/client/T.js`: English & Chinese translations following DSH global locale.
  - `src/client/S.js`: Zero-dependency pure Material Design 3 (MD3) styles adapting to DSH dark/light themes.
