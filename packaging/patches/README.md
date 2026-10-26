# NSH toolchain patch

Mado 0.1.1 uses NSH commit `71fa71099cde1dfa2c48ef1e0d97a028b9698df9`
with `nsh-rich-editor-geometry.patch`. CI and release builds apply it before
building both the CLI and platform runners.

NSH's synchronous `selectionRect`, `coordsAtPos`, and `posAtCoords` queries
can run outside the Rust reactive runtime. They used an ambient text measurer,
which panicked when the runtime was not entered. The patch captures the platform
text measurer when the editor view is created, and uses it for later queries.
The existing engine-thread checks still apply. A Rust regression test calls the
captured measurer after leaving the runtime; Mado's integration tests exercise
selection menus, slash menus and block dragging through the session APIs.

For local development, apply the patch to a checkout at the commit above and
build NSH there. Use that checkout's `target/debug/nsh` or `target/release/nsh`
for Mado's checks, tests and packaging. Platform runners must also be built from
the patched checkout. An unpatched system CLI still has the geometry bug.

Remove this patch once the equivalent upstream fix is included in the pinned
NSH revision, keeping the regression tests.
