// Editing: Markdown shortcuts as you type, the toolbar, the link editor,
// the slash menu, lists, undo, and the Visual / Source switch.
import { expect, test } from "nsh/test";
import { newFile, openMado, saveAndRead, selectBlock, typeInEditor } from "./helpers";

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
  await selectBlock(app, "Mado");
  await app.keyboard.press("mod+k");
  await app.waitFor("id:link-panel");
  await app.type("id:link-href", "github.com/huacnlee/mado");
  await app.press("id:link-apply");
  let text = await saveAndRead(app, "Untitled.md", (t) => t.includes("]("));
  expect(text).toContain("[Mado](https://github.com/huacnlee/mado)");
  await app.press("Mado");
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
  await typeInEditor(app, "Changed");
  await app.waitFor("Changed");
  await app.keyboard.press("mod+z");
  await app.waitFor("Original");
  await app.keyboard.press("shift+mod+z");
  await app.waitFor("Changed");
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
  await app.keyboard.press("mod+down");
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
