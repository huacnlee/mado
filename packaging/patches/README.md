# NSH patches

nsh-richtext builds against NSH at the commit in `NSH_REV`: longbridge/nsh#518
(RichEditor tables), which also carries the fixes the kit needs (geometry queries
outside the reactive runtime, coalesced typing through input rules, extensions an
app's crate registers, key captures before the merged keymap).

`scripts/setup-nsh.sh` and CI's `setup-nsh` action apply every `*.patch` here to
`.nsh-src` before building. Put a fix the kit needs here only until it lands
upstream.

- `0001-fix-browser-event-payloads.patch`: updates the browser host from the
  removed `Hover` payload to `Mouse`, including `pressedButton`, and handles
  `FileDropAt` with its page position, matching the native JS host.
