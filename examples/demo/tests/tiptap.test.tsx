// Tiptap's keyboard behaviors, one case each: the document, where the caret
// starts, the keys, what is typed after, and the Markdown saved. The list of
// what they cover is TIPTAP.md at the repository's root.
import { expect, test } from "nsh/test";
import { openDemo, saveAndRead, typeKeys } from "./helpers";

const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";

type Case = { name: string; doc: string; at: string; keys: string[]; type?: string; paste?: string; saved: string };

const CASES: Case[] = [
  { name: "Enter three times leaves a code block", doc: "```\nabc\n```\n", at: "abc", keys: ["end", "enter", "enter", "enter"], type: "X", saved: "```\nabc\n```\n\nX\n" },
  { name: "Down at a code block's end leaves it", doc: "```\nabc\n```\n", at: "abc", keys: ["end", "down"], type: "X", saved: "```\nabc\n```\n\nX\n" },
  { name: "Mod-Enter leaves a code block", doc: "```\nabc\n```\n", at: "abc", keys: ["end", "mod+enter"], type: "X", saved: "```\nabc\n```\n\nX\n" },
  { name: "Backspace at an item's start lifts it out of the list", doc: "- one\n- two\n", at: "two", keys: ["home", "backspace"], saved: "- one\n\ntwo\n" },
  { name: "Enter on an empty item leaves the list", doc: "- one\n", at: "one", keys: ["end", "enter", "enter"], type: "X", saved: "- one\n\nX\n" },
  { name: "Backspace at a quote's start lifts it", doc: "> quoted\n", at: "quoted", keys: ["home", "backspace"], saved: "quoted\n" },
  { name: "Mod-Alt-2 makes a heading", doc: "Para\n", at: "Para", keys: ["mod+alt+2"], saved: "## Para\n" },
  { name: "Mod-Alt-0 makes a heading a paragraph", doc: "## Head\n", at: "Head", keys: ["mod+alt+0"], saved: "Head\n" },
  { name: "Mod-Shift-8 makes a bullet list", doc: "Para\n", at: "Para", keys: ["mod+shift+8"], saved: "- Para\n" },
  { name: "Mod-Shift-7 makes a numbered list", doc: "Para\n", at: "Para", keys: ["mod+shift+7"], saved: "1. Para\n" },
  { name: "Mod-Shift-9 makes a task list", doc: "Para\n", at: "Para", keys: ["mod+shift+9"], saved: "- [ ] Para\n" },
  { name: "Mod-Shift-b makes a quote", doc: "Para\n", at: "Para", keys: ["mod+shift+b"], saved: "> Para\n" },
  { name: "Mod-Shift-s strikes the selection through", doc: "Para\n", at: "Para", keys: ["home", "shift+end", "mod+shift+s"], saved: "~~Para~~\n" },
  { name: "Mod-e makes the selection code", doc: "Para\n", at: "Para", keys: ["home", "shift+end", "mod+e"], saved: "`Para`\n" },
  { name: "The gap cursor reaches past a closing divider", doc: "Para\n\n---\n", at: "Para", keys: ["end", "down", "down"], type: "X", saved: "Para\n\n---\n\nX\n" },
  { name: "The gap cursor reaches before an opening table", doc: TABLE, at: "a", keys: ["up", "up"], type: "X", saved: `X\n\n${TABLE}` },
  { name: "Tab and Shift-Tab move between a table's cells", doc: TABLE, at: "a", keys: ["end", "tab"], type: "X", saved: "| a | X |\n| --- | --- |\n| 1 | 2 |\n" },
  { name: "Tab in a table's last cell adds a row", doc: TABLE, at: "2", keys: ["end", "tab"], type: "Z", saved: `${TABLE}| Z |  |\n` },
  { name: "Down past a closing table reaches the line after it", doc: TABLE, at: "2", keys: ["down"], type: "after", saved: `${TABLE}\nafter\n` },
  { name: "A URL pasted on a selection links it", doc: "word\n", at: "word", keys: ["home", "shift+end"], paste: "https://example.com", saved: "[word](https://example.com)\n" },
  { name: "Typography turns -- (c) ... -> into their characters", doc: "x\n", at: "x", keys: ["end"], type: " -- (c) ... ->", saved: "x — © … →\n" },
  { name: "Mod-Alt-c makes a code block", doc: "Para\n", at: "Para", keys: ["mod+alt+c"], saved: "```\nPara\n```\n" },
  { name: "Shift-Enter breaks the line inside a paragraph", doc: "ab\n", at: "ab", keys: ["end", "shift+enter"], type: "c", saved: "ab\\\nc\n" },
  { name: "Mod-y redoes what Mod-z undid", doc: "Para\n", at: "Para", keys: ["mod+alt+2", "mod+z", "mod+y"], saved: "## Para\n" },
  { name: "Mod-u underlines the selection", doc: "Para\n", at: "Para", keys: ["home", "shift+end", "mod+u"], saved: "<u>Para</u>\n" },
  { name: "Mod-. makes the selection superscript", doc: "Para\n", at: "Para", keys: ["home", "shift+end", "mod+."], saved: "<sup>Para</sup>\n" },
  { name: "Mod-, makes the selection subscript", doc: "Para\n", at: "Para", keys: ["home", "shift+end", "mod+,"], saved: "<sub>Para</sub>\n" },
  { name: "Mod-Shift-h highlights the selection", doc: "Para\n", at: "Para", keys: ["home", "shift+end", "mod+shift+h"], saved: "==Para==\n" },
  { name: "Mod-Enter breaks the line inside a paragraph", doc: "ab\n", at: "ab", keys: ["end", "mod+enter"], type: "c", saved: "ab\\\nc\n" },
  { name: "Backspace in an empty code block makes it a paragraph", doc: "Para\n\n```\nx\n```\n", at: "x", keys: ["end", "backspace", "backspace"], type: "Y", saved: "Para\n\nY\n" },
];

for (const c of CASES) {
  test(c.name, async () => {
    const app = await openDemo({ files: { "t.md": c.doc }, recent: ["t.md"] });
    await app.waitFor(c.at);
    await app.press(c.at);
    for (const key of c.keys) await app.keyboard.press(key);
    if (c.paste) await app.paste("label:Document", { text: c.paste });
    if (c.type) await typeKeys(app, c.type);
    const saved = await saveAndRead(app, "t.md", (t) => t === c.saved);
    expect(saved).toBe(c.saved);
  });
}
