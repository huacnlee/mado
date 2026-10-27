# NSH patches

nsh-richtext builds against NSH at the commit in `NSH_REV` (`c658786b`), with
these patches applied. `scripts/setup-nsh.sh` and CI's `setup-nsh` action apply
every `*.patch` here to `.nsh-src` before building anything; `.cargo/config.toml`
then patches every nsh crate to `.nsh-src`. Drop a patch once the pinned commit
has the fix upstream, keeping the regression tests.

## `nsh-rich-editor-geometry.patch`

NSH's synchronous `selectionRect`, `coordsAtPos`, and `posAtCoords` queries can
run outside the Rust reactive runtime. They used an ambient text measurer, which
panicked when the runtime was not entered. The patch captures the platform text
measurer when the editor view is created and uses it for later queries. A Rust
regression test calls the captured measurer after leaving the runtime; Mado's
tests exercise selection menus, slash menus and block dragging through the
session APIs.

## `nsh-rich-extensions.patch`

Two fixes so an app's crate can extend the editor, as `nsh/base` documents:

- **Extensions registered by a UI set are found by JS.** `registry.rich_extension`
  registers in the engine's reactive runtime (`global`), but `richExtension(name)`
  runs as a module call outside it, where `try_global` finds nothing, so every
  registered extension was "no extension is named …". Registrations are also
  kept in a process-wide table, which `extension_named` reads after the engine's.
- **High-priority extensions' plugins see keys before the keymap.** The manager
  merges every extension's key bindings into one keymap plugin placed before all
  extensions' plugins, so an app's key capture (a slash menu's Enter and arrows)
  could never come first. As in Tiptap, where each extension's plugins follow
  priority, the plugins of extensions above the default priority (100) now come
  before the merged keymap.

Mado's tests cover both: the editor is made with `richExtension("richTextKit")`,
and the slash menu takes Enter through a priority-1000 extension's plugin.
