# 010 — Top-Left Editable Camera Scope Dropdown

- **Date**: 2026-11-19
- **Requirement Summary**:
  1. Add an editable dropdown at the top-left of the camera layout (left pane of the main workspace).
  2. Default item is **“所有” (All)**, which is strictly non-editable and non-deletable.
  3. Users can type in the dropdown's `<input>` area and press `Enter` to add the item, immediately clearing and keeping focus so they can continue typing and pressing `Enter` to grow the dropdown list unboundedly.
  4. Every custom item in the dropdown list has an `×` button beside it so users can delete it (excluding “所有” / All). Custom items can also be renamed inline.