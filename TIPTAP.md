# Tiptap parity

How Mado's editing compares with Tiptap's, behavior by behavior: what does it, and the test that shows it. "NSH" is
NSH's `RichEditor` (the kernel, `nsh/base`), "kit" is `crates/nsh-richtext`, "Mado" is `examples/mado`. Tests are in
`examples/mado/tests/` (`tiptap` is `tiptap.test.tsx`, `editing` is `editing.test.tsx`) and run headless and on
GTK (`nsh test examples/mado --target linux`).

## Keyboard

| Tiptap | Where | Test |
| --- | --- | --- |
| Markdown input rules: `# `, `- `, `1. `, `[ ] `, `> `, `**b**`, `~~s~~`, `==h==` | NSH, kit | editing: "# and a space make a heading…", "**text**…", "==highlights==…" |
| Typography: `--` `(c)` `...` `->` | NSH | tiptap: "Typography…" |
| Mod-b / i / u / e / Shift-s / Shift-h marks | NSH | tiptap: "Mod-Shift-s…", "Mod-e…"; editing: bold |
| Mod-Alt-0…6 headings | NSH | tiptap: "Mod-Alt-2…", "Mod-Alt-0…" |
| Mod-Shift-7 / 8 / 9 lists, Mod-Shift-b quote | NSH | tiptap: four cases |
| Mod-k link; a URL pasted on a selection links it | NSH, Mado | editing: "Mod-k…"; tiptap: "A URL pasted…" |
| Mod-z / Shift-Mod-z | NSH | editing: "Mod-z undoes typing…" |
| Code block: Enter three times, Down at the end, Mod-Enter leave it | NSH | tiptap: three cases |
| Lists: Enter on an empty item leaves, Backspace at the start lifts, Tab / Shift-Tab nest | NSH | tiptap: two cases; editing: "Tab and Shift-Tab…" |
| Quote: Backspace at the start lifts | NSH | tiptap: "Backspace at a quote's start…" |
| Gap cursor before and after blocks the caret cannot enter (divider, table) | NSH | tiptap: two gap cases; editing: "the caret moves down across a divider…" |
| Tables: Tab / Shift-Tab between cells, Tab in the last adds a row, Down leaves | NSH | tiptap: three table cases |
| Trailing node: a line after a last block that is not a paragraph | NSH, kit (saved without blank lines) | tiptap: "Down past a closing table…"; editing: "a block command saves no trailing blank lines" |
| Alt-↑ / Alt-↓ move a block | kit | editing: "Alt arrows move blocks…" |
| NodeRange: Shift-↑ / Shift-↓ grow a selection by whole blocks | kit | editing: "Shift-arrows grow a selection…"; kit unit test |
| Mod-a selects all | NSH | covered by NSH's tests |
| `/` slash menu: filter, Enter, Escape | Mado, kit | editing: three cases |

## Mouse and the block handle

| Tiptap | Where | Test |
| --- | --- | --- |
| Drag handle beside the hovered block, list items included, in the text column | Mado | editing: "hovering a list item shows its handle…" |
| Press the handle: the block is selected (Backspace deletes it) | NSH, Mado | editing: "pressing a block's handle selects the block…" |
| Drag a block: drop line between blocks by the half under the pointer, anywhere across | NSH | editing: "dragging a block moves it…", "a top-level block moves past a whole list" |
| A list item moves among its siblings and stays in its list past its end | NSH | editing: "list items have a drag handle…", "…dragging it moves the item alone" |
| Tables and other unselectable blocks drag too | NSH | GTK and headless drag probes; NSH `drag_block` |
| A selection over several blocks drags them together | NSH | editing: "the handle carries every block a selection spans" |
| NodeRange Mod-drag: a mouse selection with Mod held covers whole blocks | NSH | editing: "a Mod-drag across blocks selects them whole"; NSH unit test |
| Drag preview beside the pointer while the drag runs | Mado | editing: "while a block is dragged its preview shows until the drop" (`app.dragAndHold`, headless); the drop line (`id:rich-editor-drop-cursor`) is asserted there too |
| Auto-scroll at the editor's edges while dragging | NSH | NSH (`follow_drag_edge`) |
| The handle hides while typing, returns on the next pointer move | Mado | editing: "typing hides the block handle…" |
| Bubble menu on a non-empty text selection; the handle stays beside it | Mado | editing: "selecting text shows the bubble menu…" |
| Floating menu on a focused empty line | Mado (NSH: `autoFocus` reports the focus) | editing: "an empty line's floating menu…", "a new document takes the focus…" |
| Mod-click opens a link while editing; a click when read-only | NSH | editing: "Mod-click opens a link while editing"; NSH unit test in `extensions/link.rs` |
| Table grips: select, move, resize rows and columns | NSH | NSH tests; gallery `rich-editor.test.tsx` |

## Not covered

- Mod-click and Mod-drag run headless and on Linux: `keyboard.down` holds keys there; the other real targets refuse it.
- `app.dragAndHold` runs headless only; on GTK the drag preview is checked by a screenshot.
- `nsh-compat` (`cargo xtask compat`) does not build against NSH's `main` (it still uses `nsh_core::ui` and
  `PatchValue`); the new APIs' case (`tests/compat/cases/base`, step `Page`) passes when run directly.
