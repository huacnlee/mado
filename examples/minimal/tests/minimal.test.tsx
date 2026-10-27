import { expect, open, test } from "nsh/test";

const markdown = (app: Awaited<ReturnType<typeof open>>) => app.value("id:markdown") ?? app.texts().find((t) => t.startsWith("# ")) ?? "";

test("the kit's commands edit the document, and Markdown keeps highlights", async () => {
  const app = await open("../App.tsx", { width: 900, height: 700 });
  await app.waitFor("text:/highlighted/");
  expect(markdown(app)).toContain("==highlighted==");
  await app.press("two");
  await app.press("Up");
  await app.waitUntil(() => /[-*] two\n[-*] one/.test(markdown(app)));
  await app.press("Some highlighted text.");
  await app.press("Quote");
  await app.waitUntil(() => markdown(app).includes("> "));
  await app.press("Undo");
  await app.waitUntil(() => !markdown(app).includes("> "));
});
