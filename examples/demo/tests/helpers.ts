// What RichText Demo's tests share: an app whose files live in its storage (no disk),
// in a desktop window, and the ways a user selects and types.
import { type App, open } from "nsh/test";

export const FOLDER = "/demo-test";

/** The storage key a file is kept under (`store/files.ts` `storageFiles`). */
export const fileKey = (name: string) => `demo.file:${FOLDER}/${name}`;

/** Opens RichText Demo with `files` (name → Markdown) in its test folder; `recent` names the file it reopens. */
export async function openDemo(options: { files?: Record<string, string>; recent?: string[]; mode?: "visual" | "source"; platform?: "macos" | "web"; folder?: string } = {}): Promise<App> {
  const storage: Record<string, string> = {
    "demo.settings": JSON.stringify({
      backend: "storage",
      folder: options.folder ?? FOLDER,
      recent: (options.recent ?? []).map((name) => `${FOLDER}/${name}`),
      mode: options.mode ?? "visual",
      appearance: "dark",
    }),
  };
  for (const [name, text] of Object.entries(options.files ?? {})) storage[fileKey(name)] = text;
  return open("../App.tsx", { storage, platform: options.platform ?? "macos", width: 1200, height: 800 });
}

/** Selects a one-line textblock: a press on it, then Home and Shift-End. (Three presses would be a triple click, but a
 * native driver settles between presses, slower than the platform's multi-click interval.) */
export async function selectBlock(app: App, selector: string) {
  await app.press(selector);
  await app.keyboard.press("home");
  await app.keyboard.press("shift+end");
}

/** Types into the rich editor key by key. */
export async function typeInEditor(app: App, text: string) {
  await app.type("id:rich-editor", text);
}

/** A new empty file (Mod-n), with the caret in it (the new editor takes the focus as it appears). */
export async function newFile(app: App) {
  await app.keyboard.press("mod+n");
  await app.waitFor("Untitled.md");
  // The new file's editor, empty: typing before it mounts would go to the one it replaces.
  await app.waitFor("text:/Write something/");
}

/** Saves (Mod-s) and waits for the file to hold what `check` wants. */
export async function saveAndRead(app: App, name: string, check: (text: string) => boolean): Promise<string> {
  await app.keyboard.press("mod+s");
  await app.waitUntil(() => check(app.storage()[fileKey(name)] ?? ""));
  return app.storage()[fileKey(name)] ?? "";
}

/** Types `text` at the caret by key presses, keeping the selection (`type` presses the editor to focus it first). */
/** Symbols typed with Shift on a US layout, by their unshifted key. */
const SHIFTED: Record<string, string> = { "~": "`", "!": "1", "@": "2", "#": "3", "*": "8", "(": "9", ")": "0", _: "-", "+": "=", ">": ".", "|": "\\" };

export async function typeKeys(app: App, text: string) {
  for (const c of text) {
    const key = c === " " ? "space" : SHIFTED[c] ? `shift+${SHIFTED[c]}` : c !== c.toLowerCase() ? `shift+${c.toLowerCase()}` : c;
    await app.keyboard.press(key);
  }
}

/** Holds modifier keys (`keyboard.down`); false on a target that holds none yet (the caller ends there). */
export async function holdKeys(app: App, keys: string): Promise<boolean> {
  try {
    await app.keyboard.down(keys);
    return true;
  } catch (error) {
    if (String(error).includes("for now")) return false;
    throw error;
  }
}

/** Drags the block grip down past the next block and keeps the pointer down; false where only headless runs can. */
export async function holdsDrag(app: App): Promise<boolean> {
  try {
    await app.dragAndHold("id:block-grip", { x: 100, y: 48 });
    return true;
  } catch (e) {
    if (String(e).includes("for now")) return false;
    throw e;
  }
}
