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

## 5. Top-Left Editable Camera Scope Dropdown & Floating Tips Bubble
- Anchored inside `.nt-camera-hud-left` at the top-left of `.nt-camera-frame` (`z-index: 20`, above `.nt-camera-media` / `.nt-camera-empty` `z-index: 5`) so it stays visible and interactive whether the camera is active or idle.
- Styled as a frosted-glass MD3 pill trigger (`.nt-scope-trigger`) opening an elevated MD3 popover (`.nt-scope-menu`) with a pinned `<input>` row (`.nt-scope-input-row`) and scrollable listbox (`.nt-scope-list`).
- Built-in locked options **「所有」 / 「All」** (`all`) and **「人脸」 / 「Human Face」** (`human-face`) are strictly non-editable and non-deletable; user-added options support continuous `Enter` creation (with IME `isComposing` guard), inline `✎` rename, and `×` deletion (reverting selection to 「所有」 if the active item is deleted).
- **Floating Tips Bubble (`.nt-scope-tips-bubble`)**: Anchored above the top-left corner of the dropdown (`bottom: calc(100% + 9px); left: 0; pointer-events: none; user-select: none;`, with media clipped in `.nt-camera-media` so the bubble never clips). Styled with a vibrant warm golden-amber sunrise gradient (`#ffe066` → `#ffb732` → `#ff9248`), deep espresso text (`#241400`), dark/gold `Tips` pill badge, and gentle breathing glow animation. Pops up for **5 seconds** immediately whenever the camera turns on and repeats every **60 seconds** while active, with no manual close action.
