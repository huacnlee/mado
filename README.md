# Mado

Mado opens Markdown files and edits them as documents. Headings, lists, tasks, quotes, code and links take their
shape as you type, and the file stays plain Markdown that every other tool reads.

Mado is built with [Native Shell (NSH)](https://github.com/longbridge/nsh): one TSX app, drawn with each platform's
own UI on macOS, Windows and Linux, with its rich text editor running natively in NSH's `RichEditor`.

## Features

- **Visual editing.** Markdown shortcuts as you type (`#` headings, `-` / `1.` lists, `[ ]` tasks, `>` quotes,
  fenced code, `---` rules, `**bold**`, `_italic_`, `` `code` ``, `~~strike~~`, `==highlight==`), Markdown and HTML
  paste, undo and redo, Tab / Shift-Tab in lists.
- **A toolbar** with the block style menu, bulleted, numbered and task lists, quote, code block, bold, italic,
  strikethrough, inline code, underline, link, highlight, superscript, subscript, text alignment, divider, image,
  indent and outdent, each showing its state and shortcut.
- **A bubble menu** over selected text for its marks and its link, and a **link editor** (⌘K) to add, update, open
  or remove a link.
- **A slash menu**: `/` at the start of a line lists the blocks to insert; type to filter, arrows and Enter to pick.
  An empty line shows a `+` that opens it.
- **Blocks move** by dragging their handle, or with Alt-↑ / Alt-↓.
- **Source mode**: the Markdown itself in a code editor with Markdown highlighting; switching back and forth keeps
  every change (⌘/).
- **Files**: open by path or from the folder and recent lists (⌘O), new files (⌘N), rename by pressing the title,
  delete, save (⌘S) and autosave, with the edited state in the title bar and the status bar.
- **A status bar** with words, characters and reading time.
- **Solid Glass**: smoky glass panes with an emerald accent, dark by default, with light and system appearances one
  press away.

## Install

Releases are on [GitHub](https://github.com/huacnlee/mado/releases): macOS (Apple silicon and Intel), Linux (x86_64
and ARM64), Windows (x86_64) and a web build.

**macOS / Linux**

```sh
curl -fsSL https://raw.githubusercontent.com/huacnlee/mado/main/install.sh | sh
```

It installs `Mado.app` into `~/Applications` on macOS, and `mado` into `~/.local` on Linux (with its desktop entry
and icon), for the current user. `--version 0.1.3` installs a given release, `--dir <path>` another location. Every
download is checked against the release's `SHA256SUMS`. Linux uses GTK 4.14+ and WebKitGTK 6.0.

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/huacnlee/mado/main/install.ps1 | iex
```

It installs into `%LOCALAPPDATA%\Programs\Mado` and adds Mado to the Start menu.

**Arch Linux**

From a clone, with `nsh` on `PATH`: `makepkg -si`.

## Develop

Mado is a TSX app: `App.tsx` is the window, `components/` its parts, `editor/setup.ts` everything it tells the rich
text editor (schema names, plugins, commands, classes), and `store/` the document, the files and the settings.
`nsh.json` declares the app and its file access (`fs` under the home directory); `theme.json` holds its design
tokens. New documents go to `~/Documents/Mado`.

Use the pinned NSH toolchain and geometry fix described in
[packaging/patches/README.md](packaging/patches/README.md). With that `nsh` on `PATH`:

```sh
nsh run                       # Mado in a window, reloading as you save
nsh check                     # type check
nsh test                      # the tests in tests/, headless
nsh test --target macos       # the same tests in a macOS window (also linux, windows)
nsh package --target macos    # Mado.app in .nsh/out (also linux, windows, web)
```

`python3 scripts/test-install.py` tests the installer, and `pwsh scripts/test-install.ps1` the Windows one.

## Release

Tag a version that matches `nsh.json`'s `version` (`v0.1.3`) and push the tag. The release workflow builds NSH at
the commit `NSH_REF` names, packages Mado with `nsh package` for each target, writes the archives
`mado-<version>-<target>.tar.gz` (`.zip` on Windows) and their `SHA256SUMS`, and publishes them as a GitHub release.

## License

MIT. Mado's theme comes from [Solid Glass](https://github.com/deeplethe/solid-glass) (MIT) and its icons from
[Lucide](https://lucide.dev) (ISC): see [NOTICE.md](NOTICE.md).

A release can also be rebuilt with the workflow's optional `runtime_run` and
`web_runtime_run` inputs while those build artifacts are retained. It verifies
the source NSH commit, patch set and archive checksums before reusing the generic
runtimes; the app code, metadata, macOS signatures and release archives are built
again. Omit the inputs to build every runtime from source.
