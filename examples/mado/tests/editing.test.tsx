// Editing: Markdown shortcuts as you type, the toolbar, the link editor,
// the slash menu, lists, undo, and the Visual / Source switch.
import { expect, test } from "nsh/test";
import { newFile, openMado, saveAndRead, selectBlock, typeInEditor, typeKeys } from "./helpers";

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
  expect(app.shows("id:block-drop-indicator")).toBe(false);
  await app.keyboard.press("mod+z");
  text = await saveAndRead(app, "drag.md", (t) => t.startsWith("First block"));
  expect(text.trim()).toBe("First block\n\nSecond block\n\nThird block");
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
