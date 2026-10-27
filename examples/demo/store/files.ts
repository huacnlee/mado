// Markdown files on disk. RichText Demo reads and writes them with `fs/promises`
// under the home directory (nsh.json grants `${homeDir}`); the same
// interface over the app's storage lets tests run without a disk.
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Storage, platform } from "nsh";

/** What RichText Demo does with files. */
export interface Files {
  read(file: string): Promise<string>;
  write(file: string, text: string): Promise<void>;
  exists(file: string): Promise<boolean>;
  /** The Markdown files in `dir`, sorted, as absolute paths. */
  list(dir: string): Promise<string[]>;
  mkdir(dir: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(file: string): Promise<void>;
  /** When the file was last changed (ms), or 0. */
  modified(file: string): Promise<number>;
}

export const MARKDOWN = /\.(md|markdown|mdown|mkd)$/i;

/** The files on disk. */
export const diskFiles: Files = {
  read: (file) => fs.readFile(file, "utf8"),
  write: (file, text) => fs.writeFile(file, text),
  exists: (file) => fs.exists(file),
  async list(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => !e.isDirectory() && MARKDOWN.test(e.name)).map((e) => path.join(dir, e.name));
  },
  mkdir: (dir) => fs.mkdir(dir, { recursive: true }),
  rename: (from, to) => fs.rename(from, to),
  remove: (file) => fs.unlink(file),
  async modified(file) {
    try {
      return (await fs.stat(file)).mtimeMs;
    } catch {
      return 0;
    }
  },
};

const PREFIX = "demo.file:";

/** Files kept in the app's storage, keyed by path: a disk of its own for tests and sandboxes without file access. */
export const storageFiles: Files = {
  async read(file) {
    const text = await Storage.getItem(PREFIX + file);
    if (text === null) throw Object.assign(new Error(`ENOENT: no such file, open '${file}'`), { code: "ENOENT" });
    return text;
  },
  write: (file, text) => Storage.setItem(PREFIX + file, text),
  exists: async (file) => (await Storage.getItem(PREFIX + file)) !== null,
  async list(dir) {
    const keys = await Storage.keys();
    return keys
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length))
      .filter((file) => path.dirname(file) === dir && MARKDOWN.test(file))
      .sort();
  },
  mkdir: async () => {},
  async rename(from, to) {
    const text = await storageFiles.read(from);
    await Storage.setItem(PREFIX + to, text);
    await Storage.removeItem(PREFIX + from);
  },
  remove: (file) => Storage.removeItem(PREFIX + file),
  modified: async () => 0,
};

/** The browser's virtual root, or the native home directory. */
function homeDirectory(): string {
  return platform.os === "web" ? "/" : os.homedir() || "/";
}

/** Where new documents go: `~/Documents/RichText Demo` (virtual on the web). */
export function defaultFolder(): string {
  return path.join(homeDirectory(), "Documents", "RichText Demo");
}

/** `~/…` expanded; a relative path is taken in the default folder. */
export function expandPath(input: string): string {
  const text = input.trim();
  if (text === "~") return homeDirectory();
  if (text.startsWith("~/")) return path.join(homeDirectory(), text.slice(2));
  if (path.isAbsolute(text)) return path.normalize(text);
  return path.join(defaultFolder(), text);
}

/** `name` made a Markdown file name (`.md` added when it has no Markdown extension). */
export function markdownName(name: string): string {
  const trimmed = name.trim().replace(/[\\/]/g, "-");
  return MARKDOWN.test(trimmed) ? trimmed : `${trimmed}.md`;
}

/** A path for display: the home directory as `~`. */
export function displayPath(file: string): string {
  const home = homeDirectory();
  return home && file.startsWith(home + path.sep) ? `~${file.slice(home.length)}` : file;
}

/** A file name not taken in `dir`: `Untitled.md`, `Untitled 2.md`, ... */
export async function freeName(files: Files, dir: string, base = "Untitled"): Promise<string> {
  for (let n = 1; ; n++) {
    const file = path.join(dir, `${base}${n > 1 ? ` ${n}` : ""}.md`);
    if (!(await files.exists(file))) return file;
  }
}

/** An error's message as the user reads it. */
export function describeError(error: unknown, action: string): string {
  const e = error as { code?: string; message?: string };
  if (e?.code === "ENOENT") return `${action}: the file does not exist.`;
  if (e?.code === "EACCES" || e?.code === "EPERM") return `${action}: RichText Demo may not access this location.`;
  return `${action}: ${e?.message ?? String(error)}`;
}
