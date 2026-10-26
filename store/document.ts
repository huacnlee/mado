// The open document: its file, its editor session, the Markdown last saved,
// and the mode it is edited in. Every document gets an editor session of its
// own, so undo never reaches into the file opened before.
import { batch, computed, signal } from "nsh";
import { platform } from "nsh";
import * as path from "path";
import { createMadoEditor, type MadoEditor } from "../editor/setup";
import { countWords } from "../editor/markdown";
import { describeError, diskFiles, displayPath, type Files, freeName, markdownName, storageFiles, defaultFolder } from "./files";
import { type Mode, rememberRecent, forgetRecent, settings, updateSettings } from "./settings";
import { WELCOME } from "./welcome";

/** How long after the last change autosave waits, in milliseconds. */
export const AUTOSAVE_DELAY = 800;

/** The disk, or the app's storage in tests and on the web, where pages have no file system. */
export function filesBackend(): Files {
  return settings().backend === "storage" || platform.os === "web" ? storageFiles : diskFiles;
}

export function folder(): string {
  return settings().folder || defaultFolder();
}

/** Called with each new editor session, to connect its plugins to the app. */
type Wire = (mado: MadoEditor) => void;

export function createDocumentStore() {
  let wire: Wire = () => {};
  const mado = signal<MadoEditor>(createMadoEditor(WELCOME));
  const file = signal<string | null>(null);
  const saved = signal(mado().editor.getMarkdown());
  const revision = signal(0);
  const mode = signal<Mode>(settings().mode);
  const source = signal(mode() === "source" ? mado().editor.getMarkdown() : "");
  const error = signal<string | null>(null);
  const status = signal<string | null>(null);
  const saving = signal(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const attach = (next: MadoEditor) => {
    next.editor.subscribe((r) => {
      revision.set(r);
      scheduleAutosave();
    });
    wire(next);
  };
  attach(mado());

  /** The document's Markdown as it is now, in either mode. */
  const markdown = () => {
    revision();
    return mode() === "source" ? source() : mado().editor.getMarkdown();
  };
  const dirty = computed(() => markdown() !== saved());
  const text = computed(() => {
    revision();
    return mode() === "source" ? source() : mado().editor.getText();
  });
  const words = computed(() => countWords(text()));
  const characters = computed(() => text().replace(/\n/g, "").length);
  const title = computed(() => (file() ? path.basename(file() as string) : "Untitled"));

  /** Shows `text` in a new editor session, as the last saved state. */
  function load(text: string, at: string | null) {
    const next = createMadoEditor(text);
    batch(() => {
      mado.set(next);
      attach(next);
      file.set(at);
      revision.set(next.editor.revision);
      // The editor writes Markdown its own way: what it reads back is the saved state.
      const normalized = next.editor.getMarkdown();
      saved.set(mode() === "source" ? text : normalized);
      source.set(text);
      error.set(null);
    });
  }

  function scheduleAutosave() {
    if (timer) clearTimeout(timer);
    if (!settings().autosave || !file()) return;
    timer = setTimeout(() => {
      timer = null;
      if (dirty() && file()) void save();
    }, AUTOSAVE_DELAY);
  }

  async function open(target: string): Promise<boolean> {
    try {
      const text = await filesBackend().read(target);
      load(text, target);
      rememberRecent(target);
      status.set(`Opened ${displayPath(target)}`);
      return true;
    } catch (e) {
      error.set(describeError(e, `Could not open ${displayPath(target)}`));
      if ((e as { code?: string }).code === "ENOENT") forgetRecent(target);
      return false;
    }
  }

  /** Writes the document to its file, or to `target` (save as). */
  async function save(target?: string): Promise<boolean> {
    const to = target ?? file();
    if (!to) return false;
    const text = markdown();
    saving.set(true);
    try {
      await filesBackend().mkdir(path.dirname(to));
      await filesBackend().write(to, text);
      batch(() => {
        saved.set(text);
        file.set(to);
        error.set(null);
        status.set(`Saved ${displayPath(to)}`);
      });
      rememberRecent(to);
      return true;
    } catch (e) {
      error.set(describeError(e, `Could not save ${displayPath(to)}`));
      return false;
    } finally {
      saving.set(false);
    }
  }

  /** A new empty document saved at once as `name` (or `Untitled.md`) in the folder. */
  async function create(name?: string): Promise<boolean> {
    const files = filesBackend();
    const target = name?.trim() ? path.join(folder(), markdownName(name)) : await freeName(files, folder());
    if (await files.exists(target)) {
      error.set(`${displayPath(target)} exists already.`);
      return false;
    }
    load("", target);
    return save(target);
  }

  async function rename(name: string): Promise<boolean> {
    const from = file();
    if (!from) return save(path.join(folder(), markdownName(name)));
    const to = path.join(path.dirname(from), markdownName(name));
    if (to === from) return true;
    const files = filesBackend();
    try {
      if (await files.exists(to)) throw new Error(`${path.basename(to)} exists already`);
      if (dirty()) await save();
      await files.rename(from, to);
      file.set(to);
      forgetRecent(from);
      rememberRecent(to);
      status.set(`Renamed to ${path.basename(to)}`);
      return true;
    } catch (e) {
      error.set(describeError(e, "Could not rename"));
      return false;
    }
  }

  async function remove(): Promise<boolean> {
    const at = file();
    if (!at) return false;
    try {
      await filesBackend().remove(at);
      forgetRecent(at);
      load(WELCOME, null);
      status.set(`Deleted ${path.basename(at)}`);
      return true;
    } catch (e) {
      error.set(describeError(e, "Could not delete"));
      return false;
    }
  }

  /** Switches between the rich editor and the Markdown source, carrying the text across. */
  function setMode(next: Mode) {
    if (next === mode()) return;
    const editor = mado().editor;
    if (next === "source") {
      const text = editor.getMarkdown();
      batch(() => {
        source.set(text);
        mode.set("source");
      });
    } else {
      editor.setContent(source(), "markdown");
      // What the editor makes of the source is the text it now holds; a
      // document unchanged since the save stays clean.
      const wasClean = source() === saved();
      batch(() => {
        mode.set("visual");
        revision.set(editor.revision);
        if (wasClean) saved.set(editor.getMarkdown());
      });
    }
    updateSettings({ mode: next });
  }

  function setSource(text: string) {
    source.set(text);
    scheduleAutosave();
  }

  return {
    mado,
    file,
    title,
    mode,
    source,
    revision,
    dirty,
    words,
    characters,
    error,
    status,
    saving,
    markdown,
    open,
    save,
    create,
    rename,
    remove,
    setMode,
    setSource,
    load,
    onEditor(fn: Wire) {
      wire = fn;
      fn(mado());
    },
  };
}

export type DocumentStore = ReturnType<typeof createDocumentStore>;
