# nsh-richtext

A complete rich text editing kit on NSH's `RichEditor`, in Rust: what Tiptap is
to ProseMirror. See the [repository README](../../README.md) for the extensions,
commands and the `RichText` module, and `examples/mado` for an app built on it.

- `kit`: the extensions (`richTextKit`, `markdown`, `editing`, `blockMove`).
- `blocks`: which block a handle moves (a list or task item, else a top-level
  block), Alt-↑ / Alt-↓, and where a dragged block lands.
- `slash`: the blocks a slash menu offers, each with its command.
- `text`: word counts (CJK characters one each) and reading time.
