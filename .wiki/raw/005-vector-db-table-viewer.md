# Source 005: Vector Database Viewer Modal

- **Date**: 2026-11-17
- **Source**: Direct user specification
- **Status**: Immutable Increment

## Requirements
1. Add a **「数据库」** (`Database`) button next to **「镜像」** (`Mirror`) on the first control card.
2. Clicking it opens a modal table with 4 columns whose header row displays localized titles for `index`, `augmentation`, `title`, `description`.
3. `index` renders the first 5 vector numbers + `...` + last 5 vector numbers; `augmentation`, `title`, and `description` display full text without truncation.
4. Only the `title` column right border (divider between `title` and `description`) and the `description` column right boundary support horizontal drag resizing.
