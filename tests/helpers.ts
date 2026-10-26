// What Mado's tests share: an app whose files live in its storage (no disk),
// in a desktop window, and the ways a user selects and types.
import { type App, open } from "nsh/test";

export const FOLDER = "/mado-test";

/** The storage key a file is kept under (`store/files.ts` `storageFiles`). */
export const fileKey = (name: string) => `mado.file:${FOLDER}/${name}`;

/** Opens Mado with `files` (name → Markdown) in its test folder; `recent` names the file it reopens. */
export async function openMado(options: { files?: Record<string, string>; recent?: string[]; mode?: "visual" | "source" } = {}): Promise<App> {
  const storage: Record<string, string> = {
    "mado.settings": JSON.stringify({
      backend: "storage",
      folder: FOLDER,
      recent: (options.recent ?? []).map((name) => `${FOLDER}/${name}`),
      mode: options.mode ?? "visual",
      appearance: "dark",
    }),
  };
  for (const [name, text] of Object.entries(options.files ?? {})) storage[fileKey(name)] = text;
  return open("../App.tsx", { storage, platform: "macos", width: 1200, height: 800 });
}

/** Selects a textblock as a user does: three presses on it. */
export async function selectBlock(app: App, selector: string) {
  await app.press(selector);
  await app.press(selector);
  await app.press(selector);
}

/** Types into the rich editor key by key. */
export async function typeInEditor(app: App, text: string) {
  await app.type("id:rich-editor", text);
}

/** A new empty file (Mod-n), with the caret in it (the new editor takes the focus as it appears). */
export async function newFile(app: App) {
  await app.keyboard.press("mod+n");
  await app.waitFor("Untitled.md");
}

/** Saves (Mod-s) and waits for the file to hold what `check` wants. */
export async function saveAndRead(app: App, name: string, check: (text: string) => boolean): Promise<string> {
  await app.keyboard.press("mod+s");
  await app.waitUntil(() => check(app.storage()[fileKey(name)] ?? ""));
  return app.storage()[fileKey(name)] ?? "";
}
