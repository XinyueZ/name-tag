# UI & Design System

## 1. Layout & Split-Screen Interaction
- **Host Slot**: `conversation.view` with `id: 'name-tag'`, `order: 999` (always rendered as the last tab).
- **Composer Clearance**: Root element carries `data-conversation-composer-overlay=""` and applies bottom clearance via `var(--dsh-composer-height, 152px)` so DSH's floating chat composer never obstructs controls.
- **Split Pane**: Initial `50% / 50%` ratio clamped to `[26%, 74%]`, adjusted smoothly by dragging `SplitPaneDivider` ("把手"), with double-click reset to `50%`.

## 2. Material Design 3 (Zero External Library)
All styles live in `src/client/S.js` (`NameTagStyles`):
- Uses MD3 surface hierarchy (`surface`, `surfaceContainer`, `surfaceContainerHigh`, `outlineVariant`, `primary`, `primaryContainer`), `16px`/`20px` rounded cards, tonal segmented preset chips, pill sliders, and MD3 switch tracks.
- Automatically tracks DSH theme via `ThemeService` (`document.body.hasAttribute('data-ds-dark-theme')`) and integrates DSH CSS custom properties where appropriate.

## 3. Internationalization (`T.js`)
- `TranslationCatalog` in `src/client/T.js` holds `zh` and `en` dictionaries.
- Registered into `ctx.locale` inside `ctx.effect` under namespace `name.tag`, with automatic fallback to `<html lang>` detection so switching DSH Web's global language immediately updates the tab label and all UI text.

## 4. Segmentation Mask Visualization & Preload Alert
- `CanvasOverlayRenderer` renders colored translucent segmentation masks with crisp 1-pixel boundary contours and `#idx · score` pill badges anchored at mask centroids.
- When `showSuppressed` is enabled, suppressed nested sub-part masks render with faint rose fills/contours.
- `CameraControlStrip` probes `ModelCacheStore.checkLocalAvailability()` (IndexedDB -> Host `/api/name-tag/model/status` without downloading) and shows a `❗️` badge on the top-right corner of the `Preload Model` button when no local model is found.
