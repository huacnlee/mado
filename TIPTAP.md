# Tiptap parity

How RichText Demo's editing compares with Tiptap's, behavior by behavior: what does it, and the test that shows it. "NSH" is
NSH's `RichEditor` (the kernel, `nsh/base`), "kit" is `crates/nsh-richtext`, "RichText Demo" is `examples/demo`. Tests are in
`examples/demo/tests/` (`tiptap` is `tiptap.test.tsx`, `editing` is `editing.test.tsx`) and run headless and on
GTK (`nsh test examples/demo --target linux`).

## Keyboard

| Tiptap | Where | Test |
| --- | --- | --- |
| Markdown input rules: `# `, `- `, `1. `, `[ ] `, `> `, `**b**`, `~~s~~`, `==h==` | NSH, kit | editing: "# and a space make a heading…", "**text**…", "==highlights==…" |
| Typography: `--` `(c)` `...` `->` | NSH | tiptap: "Typography…" |
| Mod-b / i / u / e / . / , / Shift-s / Shift-h marks; underline, superscript and subscript saved as `<u>` `<sup>` `<sub>` | NSH, kit | tiptap: "Mod-Shift-s…", "Mod-e…", "Mod-u…", "Mod-.…", "Mod-,…", "Mod-Shift-h…"; editing: bold |
| Mod-Alt-0…6 headings | NSH | tiptap: "Mod-Alt-2…", "Mod-Alt-0…" |
| Mod-Shift-7 / 8 / 9 lists, Mod-Shift-b quote | NSH | tiptap: four cases |
| Mod-k link; a URL pasted on a selection links it; the caret in a link shows its bar (copy, open, edit, remove) | NSH, RichText Demo | editing: "Mod-k…"; tiptap: "A URL pasted…" |
| Mod-z / Shift-Mod-z / Mod-y | NSH | editing: "Mod-z undoes typing…"; tiptap: "Mod-y redoes…" |
| Mod-Alt-c code block; Shift-Enter / Mod-Enter hard break | NSH | tiptap: "Mod-Alt-c…", "Shift-Enter…", "Mod-Enter…" |
| Code block: Enter three times, Down at the end, Mod-Enter leave it; Backspace in an empty one makes it a paragraph | NSH | tiptap: four cases |
| Lists: Enter on an empty item leaves, Backspace at the start lifts, Tab / Shift-Tab nest | NSH | tiptap: two cases; editing: "Tab and Shift-Tab…" |
| Quote: Backspace at the start lifts | NSH | tiptap: "Backspace at a quote's start…" |
| Gap cursor before and after blocks the caret cannot enter (divider, table) | NSH | tiptap: two gap cases; editing: "the caret moves down across a divider…" |
| Tables: Tab / Shift-Tab between cells, Tab in the last adds a row, Down leaves | NSH | tiptap: three table cases |
| Trailing node: a line after a last block that is not a paragraph | NSH, kit (saved without blank lines) | tiptap: "Down past a closing table…"; editing: "a block command saves no trailing blank lines" |
| Alt-↑ / Alt-↓ move a block | kit | editing: "Alt arrows move blocks…" |
| NodeRange: Shift-↑ / Shift-↓ grow a selection by whole blocks | kit | editing: "Shift-arrows grow a selection…"; kit unit test |
| Mod-a selects all | NSH | covered by NSH's tests |
| `/` slash menu: filter, Enter, Escape | RichText Demo, kit | editing: three cases |

## Mouse and the block handle

| Tiptap | Where | Test |
| --- | --- | --- |
| Drag handle beside the hovered block, list items included, in the text column | RichText Demo | editing: "hovering a list item shows its handle…" |
| Press the handle: the block is selected (Backspace deletes it) | NSH, RichText Demo | editing: "pressing a block's handle selects the block…" |
| Drag a block: drop line between blocks by the half under the pointer, anywhere across | NSH | editing: "dragging a block moves it…", "a top-level block moves past a whole list" |
| A list item moves among its siblings and stays in its list past its end | NSH | editing: "list items have a drag handle…", "…dragging it moves the item alone" |
| Tables and other unselectable blocks drag too | NSH | GTK and headless drag probes; NSH `drag_block` |
| A selection over several blocks drags them together | NSH | editing: "the handle carries every block a selection spans" |
| NodeRange Mod-drag: a mouse selection with Mod held covers whole blocks | NSH | editing: "a Mod-drag across blocks selects them whole"; NSH unit test |
| Drag preview beside the pointer while the drag runs | RichText Demo | editing: "while a block is dragged its preview shows until the drop" (`app.dragAndHold`, headless and GTK); the drop line (`id:rich-editor-drop-cursor`) is asserted there too |
| Auto-scroll at the editor's edges while dragging | NSH | NSH (`follow_drag_edge`) |
| The handle hides while typing, returns on the next pointer move | RichText Demo | editing: "typing hides the block handle…" |
| Bubble menu on a non-empty text selection; the handle stays beside it | RichText Demo | editing: "selecting text shows the bubble menu…" |
| Floating menu on a focused empty line | RichText Demo (NSH: `autoFocus` reports the focus) | editing: "an empty line's floating menu…", "a new document takes the focus…" |
| FileHandler: a pasted or dropped image (a file, a screenshot's bytes) becomes an image block, a dropped one where it was let go (`pagePosition`, Linux and headless) | NSH (`onPasteFiles`, `onFileDrop`), RichText Demo | editing: "pasting an image file…", "dropping an image file…", "an image file dropped on a line…", "pasting a screenshot's bytes…" |
| Mod-click opens a link while editing; a click when read-only | NSH | editing: "Mod-click opens a link while editing"; NSH unit test in `extensions/link.rs` |
| Table grips: select, move, resize rows and columns; a selected column or row has its menu (insert either side, clear, align a column, saved as GFM `:---:`, move, delete) | NSH, kit (`cellRange`), RichText Demo | NSH tests; gallery `rich-editor.test.tsx` |

## Not covered

- Text alignment (Tiptap's Mod-Shift-l / e / r / j): Markdown has no alignment to save, so RichText Demo leaves it out.

- Mod-click and Mod-drag run headless and on Linux: `keyboard.down` holds keys there; the other real targets refuse it.
- `app.dragAndHold` and `keyboard.down` run headless and on Linux; the other real targets refuse them for now.
- `nsh-compat` (`cargo xtask compat`) does not build against NSH's `main` (it still uses `nsh_core::ui` and
  `PatchValue`); the new APIs' case (`tests/compat/cases/base`, step `Page`) passes when run directly.
