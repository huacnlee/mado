// Files: creating, saving, reopening, renaming and deleting, the edited
// state, and errors shown where they happen.
import { expect, test } from "nsh/test";
import { fileKey, newFile, openDemo, saveAndRead, typeInEditor, typeKeys } from "./helpers";

test("a new file is created in the folder and saved with Mod-s", async () => {
  const app = await openDemo();
  await newFile(app);
  expect(app.storage()[fileKey("Untitled.md")]).toBe("");
  await typeInEditor(app, "Hello RichText Demo");
  await app.waitFor("id:dirty-dot");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("Hello RichText Demo"));
  expect(text.trim()).toBe("Hello RichText Demo");
  await app.waitFor("id:dirty-dot", { state: "gone" });
});

test("autosave writes the file a moment after typing stops", async () => {
  const app = await openDemo({ files: { "auto.md": "Start" }, recent: ["auto.md"] });
  await app.waitFor("Start");
  await app.press("Start");
  await app.keyboard.press("end");
  await typeInEditor(app, " and more");
  await app.waitUntil(() => (app.storage()[fileKey("auto.md")] ?? "").includes("Start and more"), { timeout: 4000 });
  // The write finishes before the app marks the file saved.
  await app.waitFor("id:dirty-dot", { state: "gone" });
});

test("the last file opens again at launch, as it was saved", async () => {
  const app = await openDemo({ files: { "notes.md": "# Notes\n\nSaved **before**.\n" }, recent: ["notes.md"] });
  await app.waitFor("Notes");
  await app.waitFor("text:/before/");
  expect(app.shows("text:notes.md")).toBe(true);
  expect(app.shows("id:dirty-dot")).toBe(false);
});

test("a file opens from the open panel's list of the folder", async () => {
  const app = await openDemo({ files: { "a.md": "# Alpha\n", "b.md": "# Beta\n" } });
  await app.press("id:open-button");
  await app.waitFor("id:open-panel");
  await app.press("role:button[b.md]");
  await app.waitFor("Beta");
  expect(JSON.parse(app.storage()["demo.settings"]).recent[0]).toBe("/demo-test/b.md");
});

test("a file opens from a typed path", async () => {
  const app = await openDemo({ files: { "typed.md": "Typed path works\n" } });
  await app.keyboard.press("mod+o");
  await app.waitFor("id:open-panel");
  await app.type("id:open-path", "/demo-test/typed.md");
  await app.press("id:open-submit");
  await app.waitFor("Typed path works");
});

test("renaming moves the file", async () => {
  const app = await openDemo({ files: { "draft.md": "Draft text\n" }, recent: ["draft.md"] });
  await app.waitFor("Draft text");
  await app.press("id:title");
  await app.clear("id:rename-input");
  await app.type("id:rename-input", "final");
  await app.submit("id:rename-input");
  await app.waitFor("final.md");
  await app.waitUntil(() => app.storage()[fileKey("final.md")] !== undefined);
  expect(app.storage()[fileKey("draft.md")]).toBe(undefined);
});

test("deleting asks first, then removes the file", async () => {
  const app = await openDemo({ files: { "gone.md": "Soon gone\n" }, recent: ["gone.md"] });
  await app.waitFor("Soon gone");
  await app.press("id:delete-button");
  await app.press("id:delete-confirm");
  await app.waitFor("Untitled");
  await app.waitUntil(() => app.storage()[fileKey("gone.md")] === undefined);
  await app.waitFor("Welcome to RichText Demo");
});

test("a missing file shows an error in place", async () => {
  const app = await openDemo({ files: { "here.md": "Here\n" } });
  await app.keyboard.press("mod+o");
  await app.type("id:open-path", "/demo-test/missing.md");
  await app.press("id:open-submit");
  await app.waitFor("id:error");
  expect(app.shows("text:/does not exist/")).toBe(true);
});

test("saving the untitled document keeps its existing content", async () => {
  const app = await openDemo();
  await app.waitFor("Welcome to RichText Demo");
  await app.press("role:button[Source]");
  await app.waitFor("id:source-editor");
  await app.press("text:/# Welcome to RichText Demo/");
  await app.keyboard.press("mod+a");
  await typeKeys(app, "A draft before its first save");
  const text = await saveAndRead(app, "Untitled.md", (t) => t.includes("A draft before its first save"));
  expect(text).toBe("A draft before its first save");
  await app.waitFor("Untitled.md");
  await app.waitFor("id:dirty-dot", { state: "gone" });
});

test("rename refuses an existing name and keeps both files", async () => {
  const app = await openDemo({ files: { "one.md": "One\n", "two.md": "Two\n" }, recent: ["one.md"] });
  await app.waitFor("One");
  await app.press("id:title");
  await app.clear("id:rename-input");
  await app.type("id:rename-input", "two.md");
  await app.submit("id:rename-input");
  await app.waitFor("id:error");
  expect(app.storage()[fileKey("one.md")]).toBe("One\n");
  expect(app.storage()[fileKey("two.md")]).toBe("Two\n");
});

test("opening another file saves pending edits to the previous file", async () => {
  const app = await openDemo({ files: { "draft.md": "Draft\n", "next.md": "Next\n" }, recent: ["draft.md"] });
  await app.press("Draft");
  await app.keyboard.press("end");
  await typeInEditor(app, " edited");
  await app.keyboard.press("mod+o");
  await app.waitFor("id:open-panel");
  await app.type("id:open-path", "/demo-test/next.md");
  await app.press("id:open-submit");
  await app.waitFor("Next");
  expect(app.storage()[fileKey("draft.md")]?.trim()).toBe("Draft edited");
  expect(app.storage()[fileKey("next.md")]?.trim()).toBe("Next");
  await app.waitFor("id:dirty-dot", { state: "gone" });
});

test("the web creates and saves documents without a native home directory", async () => {
  const app = await openDemo({ platform: "web", folder: "" });
  await newFile(app);
  // On a native target (`--target linux`) the platform is the real one, with a disk: nothing of the web's to test.
  if (app.texts().some((t) => t.startsWith("Saved /home") || t.startsWith("Saved /Users") || /^Saved [A-Z]:\\/.test(t))) return;
  await typeInEditor(app, "Browser draft");
  await app.keyboard.press("mod+s");
  await app.waitUntil(() => (app.storage()["demo.file:/Documents/RichText Demo/Untitled.md"] ?? "").includes("Browser draft"));
  await app.waitFor("id:dirty-dot", { state: "gone" });
});
