// What RichText Demo remembers between launches, in the app's storage (`nsh`'s `Storage`).
import { signal } from "nsh";
import { Storage } from "nsh";

export type Mode = "visual" | "source";
export type Appearance = "dark" | "light" | "system";

export interface Settings {
  /** The editing mode the last document was left in. */
  mode: Mode;
  appearance: Appearance;
  /** Save a moment after each change. */
  autosave: boolean;
  /** Recently opened files, newest first. */
  recent: string[];
  /** The folder new files go to and the open dialog lists; the default folder when empty. */
  folder: string;
  /** `"storage"` keeps files in the app's storage instead of on disk (tests, sandboxes). */
  backend: "disk" | "storage";
}

export const DEFAULTS: Settings = { mode: "visual", appearance: "dark", autosave: true, recent: [], folder: "", backend: "disk" };

export const SETTINGS_KEY = "demo.settings";
export const MAX_RECENT = 12;

export const settings = signal<Settings>(DEFAULTS);

/** Reads the settings once at launch. */
export async function loadSettings(): Promise<Settings> {
  try {
    const text = await Storage.getItem(SETTINGS_KEY);
    if (text) settings.set({ ...DEFAULTS, ...(JSON.parse(text) as Partial<Settings>) });
  } catch {
    settings.set(DEFAULTS);
  }
  return settings();
}

/** Changes the settings and keeps them. */
export function updateSettings(change: Partial<Settings>) {
  const next = { ...settings(), ...change };
  settings.set(next);
  void Storage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

/** Puts `file` first in the recent files. */
export function rememberRecent(file: string) {
  updateSettings({ recent: [file, ...settings().recent.filter((f) => f !== file)].slice(0, MAX_RECENT) });
}

export function forgetRecent(file: string) {
  updateSettings({ recent: settings().recent.filter((f) => f !== file) });
}
