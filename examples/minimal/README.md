# Rich Text Minimal

The smallest app on nsh-richtext: `richExtension("richTextKit")`, a toolbar of the kit's named commands
(`setBlockStyle`, `toggleListType`, `toggleQuote`, `moveBlockUp`, ...), and the document as Markdown through
`RichText.toMarkdown`. Its `nsh.json` lists the kit's crate in `"rust"`; that is all an app needs.

```sh
nsh run examples/minimal
nsh test examples/minimal
```
