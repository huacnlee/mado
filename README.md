# nsh-richtext

A complete rich text editing kit for [Native Shell (NSH)](https://github.com/longbridge/nsh) apps, in Rust. NSH's
`RichEditor` is the kernel, as ProseMirror is; nsh-richtext is the layer apps build with, as Tiptap is: extensions,
named commands and the queries an editor's toolbar, bubble menu, slash menu and block handles need. It renders with
each platform's own UI on macOS, Windows, Linux and the web.

**RichText Demo** (`examples/demo`), a Markdown editor, is its example: a whole app built on the kit. `examples/minimal` is
the smallest one: the kit's extension, a toolbar of its commands and the document as Markdown.

> **A demo, not a maintained product.** nsh-richtext and RichText Demo show what NSH's `RichEditor` can carry: the goal is a
> kernel good enough, as ProseMirror is, for third parties and NSH apps to build editors like Allsum's on it. This
> repository is not maintained as a Tiptap counterpart; whoever wants one is welcome to build on it.

```
crates/nsh-richtext/   the kit (Rust): extensions, commands, block moving, slash items, text counts
examples/demo/         RichText Demo: a TSX app on the kit, with a small crate of its own (native/, the open dialog)
examples/minimal/      the smallest app on the kit
```

## Using it

Add the crate to an NSH app with Rust (`nsh.json` `"rust"`), then use its extension and its module in TSX:

```tsx
import { command, createRichEditor, richExtension, RichEditor } from "nsh/base";
import { RichText } from "nsh-richtext";

const editor = createRichEditor({
  extensions: [richExtension("richTextKit", { starterKit: { heading: { levels: [1, 2, 3] } } })],
  content: "# Hello",
  format: "markdown",
});

editor.run(command("setBlockStyle", { style: "h2" }));
editor.run(command("moveBlockDown"));
RichText.slashItems("head");          // the slash menu's blocks matching "head"
<RichEditor editor={editor} />;
```

| Extension (`richExtension(name)`) | What it brings |
|---|---|
| `richTextKit` | All of the below with NSH's starter kit (`starterKit` configures it); any part off with `{ name: false }` |
| `markdown` | Markdown shortcuts as you type, Markdown paste, copy as Markdown |
| `editing` | `setBlockStyle({ style })`, `toggleListType({ list })`, `toggleQuote`, `indentItem`, `outdentItem`, `setAlign({ align })`, `insertDivider`, `insertImage({ src, alt })`, `replaceWith({ from, to, command, args })` |
| `tableKit` | NSH's table kit: tables with header rows, cell selection, resizing, row and column grips; `insertTable({ rows, cols, withHeaderRow })`, `addRowBefore` / `addRowAfter`, `addColumnBefore` / `addColumnAfter`, `deleteRow`, `deleteColumn`, `deleteTable`, `mergeOrSplit`, `toggleHeaderRow`, ...; GFM tables in Markdown |
| `autolink` | URLs typed or pasted become links; a URL pasted over a selection links it |
| `slashMenu` | A suggestion keyed `slash`: `/` at the start of a line; `editor.suggestion("slash")` gives its range, query and the arrows / Enter / Tab it took (Escape dismisses it) |
| `blockMove` | `moveBlockUp` / `moveBlockDown` (Alt-↑ / Alt-↓), `moveBlockTo({ source, target })`: a list or task item moves among its siblings, other blocks at the top level |

`RichText` (the crate's module): `fromMarkdown(text)` / `toMarkdown(doc)` (Markdown with `==highlight==`, which NSH's own format drops), `blockAt(doc, pos)` and `dropTarget(doc, source, target)` for block handles and
drag and drop, `slashItems(query)`, `countWords(text)`, `readingMinutes(words)`.

From Rust, the extensions are plain `nsh_base` `Extension`s: `nsh_richtext::kit::rich_text_kit()`, `kit::blocks()`, ...

## RichText Demo

RichText Demo opens Markdown files and edits them as documents. Headings, lists, tasks, quotes, code and links take their
shape as you type, and the file stays plain Markdown that every other tool reads.

### Features

- **Visual editing.** Markdown shortcuts as you type (`#` headings, `-` / `1.` lists, `[ ]` tasks, `>` quotes,
  fenced code, `---` rules, `**bold**`, `_italic_`, `` `code` ``, `~~strike~~`, `==highlight==`), Markdown and HTML
  paste, undo and redo, Tab / Shift-Tab in lists.
- **A toolbar** with the block style menu, bulleted, numbered and task lists, quote, code block, bold, italic,
  strikethrough, inline code, underline, link, highlight, superscript, subscript, text alignment, divider, table, image,
  indent and outdent, each showing its state and shortcut.
- **Tables**: from the toolbar or `/table`, saved as GFM tables; a menu over the table adds and deletes rows and
  columns, toggles the header row, merges and splits cells; cells select by dragging, columns resize at their border.
- **Links** as you type or paste a URL.
- **A bubble menu** (RichEditor's `bubbleMenu`) over selected text for its marks and its link, and a **link editor** (⌘K) to add, update, open
  or remove a link.
- **A slash menu**: `/` at the start of a line lists the blocks to insert; type to filter, arrows and Enter to pick.
  An empty line shows a `+` that opens it.
- **Blocks move** by dragging their handle, or with Alt-↑ / Alt-↓; a list or task item moves on its own.
- **Source mode**: the Markdown itself in a code editor with Markdown highlighting; switching back and forth keeps
  every change (⌘/).
- **Files**: open with the system's dialog (⌘O) or from the folder and recent lists, new files (⌘N), rename by pressing the title,
  delete, save (⌘S) and autosave, with the edited state in the title bar and the status bar.
- **A status bar** with words, characters and reading time.
- **Solid Glass**: smoky glass panes with an emerald accent, dark by default, with light and system appearances one
  press away.

### Install

Releases are on [GitHub](https://github.com/huacnlee/nsh-richtext/releases): macOS (Apple silicon and Intel), Linux (x86_64
and ARM64), Windows (x86_64) and a web build.

**macOS / Linux**

```sh
curl -fsSL https://raw.githubusercontent.com/huacnlee/nsh-richtext/main/install.sh | sh
```

It installs `RichText Demo.app` into `~/Applications` on macOS, and `richtext-demo` into `~/.local` on Linux (with its desktop entry
and icon), for the current user. `--version 0.2.0` installs a given release, `--dir <path>` another location. Every
download is checked against the release's `SHA256SUMS`. Linux uses GTK 4.14+ and WebKitGTK 6.0.

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/huacnlee/nsh-richtext/main/install.ps1 | iex
```

It installs into `%LOCALAPPDATA%\Programs\RichText Demo` and adds RichText Demo to the Start menu.

**Arch Linux**

From a clone, with `nsh` on `PATH`: `makepkg -si`.

## Develop

NSH's `RichEditor` is newer than its last release, so the kit builds against NSH at the commit in `NSH_REV`, with
the fixes in [packaging/patches](packaging/patches/README.md). `scripts/setup-nsh.sh` checks it out into `.nsh-src`,
applies them and builds its `nsh`; `.cargo/config.toml` points every nsh crate there, so the kit, RichText Demo's crate and
the hosts `nsh` builds for them share one NSH.

```sh
scripts/setup-nsh.sh                      # .nsh-src and .nsh-src/target/release/nsh
export PATH="$PWD/.nsh-src/target/release:$PATH"
cargo test --workspace                    # the kit's tests
nsh run examples/demo                     # RichText Demo in a window, reloading as you save
nsh check examples/demo                   # type check
nsh test examples/demo                    # RichText Demo's tests, headless
nsh package examples/demo --target macos  # RichText Demo.app in examples/demo/.nsh/out (also linux, windows, web)
```

In RichText Demo, `App.tsx` is the window, `components/` its parts, `editor/setup.ts` what it asks of the kit (command names,
classes), `store/` the document, the files and the settings, and `native/` its own Rust (the open dialog). New
documents go to `~/Documents/RichText Demo`. `python3 scripts/test-install.py` tests the installer, and
`pwsh scripts/test-install.ps1` the Windows one.

## Release

Tag a version that matches `examples/demo/nsh.json`'s `version` (`v0.2.0`) and push the tag. The release workflow builds NSH at
the commit `NSH_REV` names, packages RichText Demo with `nsh package` for each target, writes the archives
`richtext-demo-<version>-<target>.tar.gz` (`.zip` on Windows) and their `SHA256SUMS`, and publishes them as a GitHub release.

## License

MIT. RichText Demo's theme comes from [Solid Glass](https://github.com/deeplethe/solid-glass) (MIT) and its icons from
[Lucide](https://lucide.dev) (ISC): see [NOTICE.md](NOTICE.md).
