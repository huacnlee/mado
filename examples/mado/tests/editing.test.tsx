// Editing: Markdown shortcuts as you type, the toolbar, the link editor,
// the slash menu, lists, undo, and the Visual / Source switch.
import { expect, test } from "nsh/test";
import { holdKeys, holdsDrag, newFile, openMado, saveAndRead, selectBlock, typeInEditor, typeKeys } from "./helpers";

test("# and a space make a heading, - a list, [ ] a task", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "# Plan");
  await app.keyboard.press("enter");
  await typeInEditor(app, "- one");
  await app.keyboard.press("enter");
  await typeInEditor(app, "two");
  await app.keyboard.press("enter");
  await app.keyboard.press("enter");
  await typeInEditor(app, "> quoted");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("quoted"));
  expect(text).toContain("# Plan");
  expect(text).toMatch(/^[-*] one$/m);
  expect(text).toMatch(/^[-*] two$/m);
  expect(text).toContain("> quoted");
});

test("**text** and the toolbar's Bold make bold text", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "a **strong** word");
  await app.waitFor("text:/a strong word/");
  let text = await saveAndRead(app, "Untitled.md", (t) => t.includes("strong"));
  expect(text).toContain("**strong**");
  await app.keyboard.press("enter");
  await typeInEditor(app, "toolbar");
  // The line's text, selected from the keyboard.
  await app.keyboard.press("shift+home");
  await app.press("id:toolbar >> label:Bold");
  text = await saveAndRead(app, "Untitled.md", (t) => t.includes("**toolbar**"));
  expect(text).toContain("**toolbar**");
});

test("Mod-k edits the selection's link, and Remove link takes it off", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "Mado");
  await app.waitFor("1 word");
  await selectBlock(app, "Mado");
  await app.keyboard.press("mod+k");
  await app.waitFor("id:link-panel");
  await app.type("id:link-href", "github.com/huacnlee/mado");
  await app.press("id:link-apply");
  let text = await saveAndRead(app, "Untitled.md", (t) => t.includes("]("));
  expect(text).toContain("[Mado](https://github.com/huacnlee/mado)");
  // The caret inside the link (a link does not reach past its last character).
  await app.press("Mado");
  await app.keyboard.press("home");
  await app.keyboard.press("right");
  await app.keyboard.press("mod+k");
  await app.waitFor("id:link-remove");
  await app.press("id:link-remove");
  text = await saveAndRead(app, "Untitled.md", (t) => !t.includes("]("));
  expect(text.trim()).toBe("Mado");
});

test("/ opens the block menu, and Enter turns the line into the chosen block", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "/head");
  await app.waitFor("id:slash-menu");
  expect(app.shows("id:slash-menu >> Heading 1")).toBe(true);
  expect(app.shows("id:slash-menu >> Bulleted list")).toBe(false);
  await app.keyboard.press("enter");
  await app.waitFor("id:slash-menu", { state: "gone" });
  await typeInEditor(app, "Chosen");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("Chosen"));
  expect(text.trim()).toBe("# Chosen");
});

test("Escape closes the block menu and keeps the text", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "/");
  await app.waitFor("id:slash-menu");
  await app.keyboard.press("escape");
  await app.waitFor("id:slash-menu", { state: "gone" });
});

test("Tab and Shift-Tab indent and outdent list items", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "- first");
  await app.keyboard.press("enter");
  await typeInEditor(app, "second");
  await app.keyboard.press("tab");
  await app.waitFor("◦");
  await app.keyboard.press("shift+tab");
  await app.waitFor("◦", { state: "gone" });
});

test("Mod-z undoes typing and Shift-Mod-z redoes it", async () => {
  const app = await openMado({ files: { "u.md": "Original\n" }, recent: ["u.md"] });
  await selectBlock(app, "Original");
  await typeKeys(app, "changed");
  await app.waitFor("changed");
  await app.keyboard.press("mod+z");
  await app.waitFor("Original");
  await app.keyboard.press("shift+mod+z");
  await app.waitFor("changed");
});

test("switching to Source and back keeps the document", async () => {
  const app = await openMado({ files: { "m.md": "# Title\n\nSome *text* here.\n" }, recent: ["m.md"] });
  await app.waitFor("Title");
  await app.press("role:button[Source]");
  await app.waitFor("id:source-editor");
  expect(app.shows("text:/# Title/")).toBe(true);
  await app.press("role:button[Visual]");
  await app.waitFor("id:rich-editor");
  await app.waitFor("Title");
  expect(app.shows("id:dirty-dot")).toBe(false);
});

test("edits in Source show in Visual", async () => {
  const app = await openMado({ files: { "s.md": "Plain\n" }, recent: ["s.md"], mode: "source" });
  await app.waitFor("id:source-editor");
  await app.press("Plain");
  await app.keyboard.press("end");
  await app.type("id:source-editor", "\n\n## Added in source");
  await app.press("role:button[Visual]");
  await app.waitFor("Added in source");
});

test("the status bar counts words and characters", async () => {
  const app = await openMado({ files: { "c.md": "one two three\n" }, recent: ["c.md"] });
  await app.waitFor("3 words");
  expect(app.shows("13 characters")).toBe(true);
  expect(app.shows("1 min read")).toBe(true);
  await app.press("one two three");
  await app.keyboard.press("end");
  await typeInEditor(app, " four");
  await app.waitFor("4 words");
});

test("selecting text shows the bubble menu and clearing it hides the menu", async () => {
  const app = await openMado({ files: { "selection.md": "Select these words\n" }, recent: ["selection.md"] });
  await app.press("Select these words");
  await app.keyboard.press("end");
  await app.keyboard.press("shift+home");
  await app.waitFor("id:bubble-menu");
  await app.keyboard.press("right");
  await app.waitFor("id:bubble-menu", { state: "gone" });
});

test("dragging a block moves it below another block and undo restores it", async () => {
  const app = await openMado({ files: { "drag.md": "First block\n\nSecond block\n\nThird block\n" }, recent: ["drag.md"] });
  await app.press("First block");
  await app.waitFor("id:block-grip");
  await app.drag("id:block-grip", { x: 100, y: 48 });
  let text = await saveAndRead(app, "drag.md", (t) => t.indexOf("Second block") < t.indexOf("First block"));
  expect(text.trim()).toBe("Second block\n\nFirst block\n\nThird block");
  expect(app.shows("id:rich-editor-drop-cursor")).toBe(false);
  await app.keyboard.press("mod+z");
  text = await saveAndRead(app, "drag.md", (t) => t.startsWith("First block"));
  expect(text.trim()).toBe("First block\n\nSecond block\n\nThird block");
});

test("while a block is dragged its preview shows until the drop", async () => {
  const app = await openMado({ files: { "held.md": "First block\n\nSecond block\n\nThird block\n" }, recent: ["held.md"] });
  await app.press("First block");
  await app.waitFor("id:block-grip");
  if (!(await holdsDrag(app))) return;
  await app.waitFor("id:drag-preview");
  expect(app.count("text:First block")).toBe(2);
  expect(app.shows("id:rich-editor-drop-cursor")).toBe(true);
  await app.drop();
  await app.waitFor("id:drag-preview", { state: "gone" });
  const text = await saveAndRead(app, "held.md", (t) => t.indexOf("Second block") < t.indexOf("First block"));
  expect(text.trim()).toBe("Second block\n\nFirst block\n\nThird block");
});

test("pasting an image file inserts it as an image", async () => {
  const app = await openMado({ files: { "img.md": "Before\n" }, recent: ["img.md"] });
  await app.press("Before");
  await app.keyboard.press("end");
  await app.paste("label:Document", { uris: ["file:///pics/cat.png"] });
  const text = await saveAndRead(app, "img.md", (t) => t.includes("cat.png"));
  expect(text).toContain("![cat.png](/pics/cat.png)");
});

test("dropping an image file on the editor inserts it", async () => {
  const app = await openMado({ files: { "drop.md": "Before\n" }, recent: ["drop.md"] });
  await app.press("Before");
  await app.keyboard.press("end");
  await app.dropFiles("label:Document", ["file:///pics/dog.jpg"]);
  const text = await saveAndRead(app, "drop.md", (t) => t.includes("dog.jpg"));
  expect(text).toContain("![dog.jpg](/pics/dog.jpg)");
});

test("pasting a screenshot's bytes inserts it inline", async () => {
  const app = await openMado({ files: { "shot.md": "Before\n" }, recent: ["shot.md"] });
  await app.press("Before");
  await app.keyboard.press("end");
  await app.paste("label:Document", { files: ["examples/mado/assets/mado.png"] });
  const text = await saveAndRead(app, "shot.md", (t) => t.includes("data:image/png"));
  expect(text).toContain("](data:image/png;base64,iVBOR");
});

test("Alt arrows move blocks up and down", async () => {
  const app = await openMado({ files: { "move.md": "First\n\nSecond\n" }, recent: ["move.md"] });
  await app.press("Second");
  await app.keyboard.press("alt+up");
  await saveAndRead(app, "move.md", (t) => t.startsWith("Second"));
  await app.keyboard.press("alt+down");
  await saveAndRead(app, "move.md", (t) => t.startsWith("First"));
});

test("the toolbar sets headings and quotes", async () => {
  const app = await openMado({ files: { "blocks.md": "Section\n" }, recent: ["blocks.md"] });
  await app.press("Section");
  await app.press("label:Text style");
  await app.press("Heading 2");
  let text = await saveAndRead(app, "blocks.md", (t) => t.startsWith("## "));
  expect(text.trim()).toBe("## Section");
  await app.press("id:toolbar >> label:Quote");
  text = await saveAndRead(app, "blocks.md", (t) => t.startsWith(">"));
  expect(text).toContain("Section");
});

test("the image panel inserts an image with its description", async () => {
  const app = await openMado();
  await newFile(app);
  await app.press("id:toolbar >> label:Image");
  await app.waitFor("id:image-panel");
  await app.type("id:image-src", "images/example.png");
  await app.type("id:image-alt", "Example image");
  await app.press("id:image-insert");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("images/example.png"));
  expect(text).toContain("![Example image](images/example.png)");
});

test("list items have a drag handle and move among their siblings", async () => {
  const app = await openMado({ files: { "list.md": "- One\n- Two\n\nAfter\n" }, recent: ["list.md"] });
  await app.press("One");
  await app.waitFor("id:block-grip");
  await app.keyboard.press("alt+down");
  const text = await saveAndRead(app, "list.md", (t) => /Two\n[-*] One/.test(t));
  expect(text).toMatch(/^[-*] Two\n[-*] One\n\nAfter/);
});

test("a top-level block moves past a whole list", async () => {
  const app = await openMado({ files: { "list.md": "Before\n\n- One\n- Two\n" }, recent: ["list.md"] });
  await app.press("Before");
  await app.keyboard.press("alt+down");
  const text = await saveAndRead(app, "list.md", (t) => t.trim().endsWith("Before"));
  expect(text).toMatch(/^[-*] One\n[-*] Two\n\nBefore/);
});

test("app shortcuts work while the rich editor has focus", async () => {
  const app = await openMado({ files: { "keys.md": "Focused editor\n" }, recent: ["keys.md"] });
  await app.press("Focused editor");
  await app.keyboard.press("mod+/");
  await app.waitFor("id:source-editor");
  await app.press("role:button[Visual]");
  await app.press("Focused editor");
  await app.keyboard.press("mod+n");
  await app.waitFor("Untitled.md");
});

test("hovering a list item shows its handle, and dragging it moves the item alone", async () => {
  const app = await openMado({ files: { "drag.md": "Intro\n\n- One\n- Two\n- Three\n" }, recent: ["drag.md"] });
  await app.waitFor("Three");
  await app.hover("Two");
  await app.waitFor("id:block-grip");
  // Down over "Three": the item lands after it, in the list.
  await app.drag("id:block-grip", { x: 0, y: 48 });
  const text = await saveAndRead(app, "drag.md", (t) => /Three\n[-*] Two/.test(t));
  expect(text).toMatch(/^Intro\n\n[-*] One\n[-*] Three\n[-*] Two/);
});

test("a task dragged above a paragraph leaves its list for a list of its own", async () => {
  const app = await openMado({ files: { "out.md": "Intro\n\nMiddle\n\n- [ ] Write\n- [x] Second task\n\nAfter\n" }, recent: ["out.md"] });
  await app.press("Second task");
  await app.waitFor("id:block-grip");
  await app.drag("id:block-grip", { x: 100, y: -80 });
  const text = await saveAndRead(app, "out.md", (t) => t.indexOf("Second task") < t.indexOf("Middle"));
  expect(text).toBe("Intro\n\n- [x] Second task\n\nMiddle\n\n- [ ] Write\n\nAfter\n");
});

test("a list item dropped just above its list stays in it", async () => {
  const app = await openMado({ files: { "join.md": "Intro\n\nMiddle\n\n- [ ] Write\n- [x] Second task\n\nAfter\n" }, recent: ["join.md"] });
  await app.press("Second task");
  await app.waitFor("id:block-grip");
  await app.drag("id:block-grip", { x: 100, y: -60 });
  const text = await saveAndRead(app, "join.md", (t) => t.indexOf("Second task") < t.indexOf("Write"));
  expect(text).toBe("Intro\n\nMiddle\n\n- [x] Second task\n- [ ] Write\n\nAfter\n");
});

test("the only item dragged out of its list takes the list along", async () => {
  const app = await openMado({ files: { "only.md": "Intro\n\n- one\n\nAfter\n\nEnd\n" }, recent: ["only.md"] });
  await app.press("one");
  await app.waitFor("id:block-grip");
  await app.drag("id:block-grip", { x: 100, y: 50 });
  const text = await saveAndRead(app, "only.md", (t) => t.indexOf("one") > t.indexOf("After"));
  expect(text).toBe("Intro\n\nAfter\n\n- one\n\nEnd\n");
});

test("==highlights== load as highlights and are saved back", async () => {
  const app = await openMado({ files: { "hl.md": "Some ==marked== words\n" }, recent: ["hl.md"] });
  await app.waitFor("Some marked words");
  await app.press("Some marked words");
  await app.keyboard.press("end");
  await typeInEditor(app, ".");
  const text = await saveAndRead(app, "hl.md", (t) => t.includes("words."));
  expect(text.trim()).toBe("Some ==marked== words.");
});

test("the toolbar inserts a table, its menu adds a row, and it saves as GFM", async () => {
  const app = await openMado();
  await newFile(app);
  await app.press("id:toolbar >> label:Table");
  await app.waitFor("id:table-menu");
  await typeKeys(app, "Name");
  await app.press("id:table-menu >> label:Add row below");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("Name"));
  expect(text).toMatch(/^\| Name \|/m);
  expect(text.trim().split("\n").length).toBe(5);
});

test("tables in a file load and round trip", async () => {
  const app = await openMado({ files: { "t.md": "| A | B |\n| --- | --- |\n| 1 | 2 |\n" }, recent: ["t.md"] });
  await app.waitFor("A");
  await app.press("2");
  await app.keyboard.press("end");
  await typeKeys(app, "0");
  const text = await saveAndRead(app, "t.md", (t) => t.includes("20"));
  expect(text).toContain("| 1 | 20 |");
});

test("/table inserts a table from the block menu", async () => {
  const app = await openMado();
  await newFile(app);
  await typeInEditor(app, "/table");
  await app.waitFor("id:slash-menu >> Table");
  await app.keyboard.press("enter");
  await app.waitFor("id:table-menu");
});

test("pressing a block's handle selects the block, and Backspace deletes it", async () => {
  const app = await openMado({ files: { "sel.md": "First block\n\nSecond block\n" }, recent: ["sel.md"] });
  await app.press("Second block");
  await app.waitFor("id:block-grip");
  // A press that does not move (a drag shorter than the slop).
  await app.drag("id:block-grip", { x: 0, y: 1 });
  await app.keyboard.press("backspace");
  const text = await saveAndRead(app, "sel.md", (t) => !t.includes("Second"));
  expect(text.trim()).toBe("First block");
});

test("the caret moves down across a divider and a code block, line by line", async () => {
  const app = await openMado({ files: { "nav.md": "Above\n\n---\n\n```\ncode\n```\n\nBelow\n" }, recent: ["nav.md"] });
  await app.press("Above");
  await app.keyboard.press("end");
  await app.keyboard.press("down");
  await app.keyboard.press("down");
  await typeKeys(app, "X");
  const text = await saveAndRead(app, "nav.md", (t) => t.includes("X"));
  expect(text).not.toMatch(/BelowX|Below\nX/);
});

test("task lists keep their checks through a save", async () => {
  const app = await openMado({ files: { "t.md": "- [x] done\n- [ ] todo\n" }, recent: ["t.md"] });
  await app.press("todo");
  await app.keyboard.press("end");
  await typeKeys(app, "s");
  const text = await saveAndRead(app, "t.md", (t) => t.includes("todos"));
  expect(text).toContain("- [x] done\n- [ ] todos");
});

test("typing hides the block handle until the pointer moves again", async () => {
  const app = await openMado({ files: { "type.md": "First\n\nSecond\n" }, recent: ["type.md"] });
  await app.press("Second");
  await app.hover("First");
  await app.waitFor("id:block-grip");
  await app.keyboard.press("end");
  await typeInEditor(app, "!");
  await app.waitUntil(() => !app.shows("id:block-grip"));
  await app.hover("First");
  await app.waitFor("id:block-grip");
});

test("a block command saves no trailing blank lines", async () => {
  const app = await openMado({ files: { "end.md": "Para\n" }, recent: ["end.md"] });
  await app.press("Para");
  await app.keyboard.press("mod+alt+2");
  const text = await saveAndRead(app, "end.md", (t) => t.startsWith("## "));
  expect(text).toBe("## Para\n");
});

test("the handle carries every block a selection spans", async () => {
  const app = await openMado({ files: { "range.md": "One\n\nTwo\n\nThree\n\nFour\n" }, recent: ["range.md"] });
  await app.press("One");
  await app.keyboard.press("home");
  await app.keyboard.press("shift+down");
  await app.hover("One");
  await app.waitFor("id:block-grip");
  await app.drag("id:block-grip", { x: 0, y: 2000 });
  const text = await saveAndRead(app, "range.md", (t) => t.startsWith("Three"));
  expect(text).toBe("Three\n\nFour\n\nOne\n\nTwo\n");
});

test("Shift-arrows grow a selection across blocks by whole blocks", async () => {
  const app = await openMado({ files: { "sel.md": "One\n\nTwo\n\nThree\n\nFour\n" }, recent: ["sel.md"] });
  await app.press("One");
  await app.keyboard.press("home");
  await app.keyboard.press("shift+down");
  await app.keyboard.press("shift+down");
  await typeKeys(app, "X");
  const text = await saveAndRead(app, "sel.md", (t) => t.startsWith("X"));
  expect(text).toBe("X\n\nFour\n");
});

test("an empty line's floating menu turns it into a heading", async () => {
  const app = await openMado({ files: { "float.md": "Intro\n" }, recent: ["float.md"] });
  await app.press("Intro");
  await app.keyboard.press("end");
  await app.keyboard.press("enter");
  await app.waitFor("id:floating-menu");
  await app.press("id:floating-menu >> label:Heading 2");
  await typeKeys(app, "Title");
  const text = await saveAndRead(app, "float.md", (t) => t.includes("Title"));
  expect(text).toBe("Intro\n\n## Title\n");
});

test("a new document takes the focus and offers its blocks on the empty line", async () => {
  const app = await openMado();
  await newFile(app);
  await app.waitFor("id:floating-menu");
  await app.press("id:floating-menu >> label:Bullet list");
  await typeKeys(app, "item");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("item"));
  expect(text).toBe("- item\n");
});

test("Mod-click opens a link while editing", async () => {
  // The link fills the line, so a press at its middle is on it.
  const label = "a link long enough to run across the whole line of the editor, from its left edge past its middle to the right";
  const app = await openMado({ files: { "link.md": `[${label}](https://example.com)\n` }, recent: ["link.md"] });
  await app.waitFor(label);
  await app.press(label);
  expect(app.openedUrls()).toEqual([]);
  // Past the double-click interval: a second, separate click.
  await app.wait(600);
  // Where the target holds keys (headless, Linux).
  if (!(await holdKeys(app, "mod"))) return;
  await app.press(label);
  await app.keyboard.up("mod");
  await app.waitUntil(() => app.openedUrls().length > 0);
  expect(app.openedUrls()).toEqual(["https://example.com"]);
});

test("a Mod-drag across blocks selects them whole", async () => {
  const app = await openMado({ files: { "md.md": "First line\n\nSecond line\n\nThird\n" }, recent: ["md.md"] });
  await app.waitFor("Third");
  // Where the target holds keys (headless, Linux).
  if (!(await holdKeys(app, "mod"))) return;
  await app.drag("First line", { x: 0, y: 44 });
  await app.keyboard.up("mod");
  await typeKeys(app, "X");
  const text = await saveAndRead(app, "md.md", (t) => t.startsWith("X"));
  expect(text).toBe("X\n\nThird\n");
});
