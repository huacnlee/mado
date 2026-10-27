// Everything Mado tells the rich text editor lives here. The editing itself
// is nsh-richtext's (`crates/nsh-richtext`): its `richTextKit` extension
// brings the schema, Markdown, the editing commands and block moving, in
// Rust; this module names them for the toolbar, the bubble menu and the
// slash menu, and gives the document's parts their classes.
import {
  type RichCommand,
  type RichEditorClasses,
  type RichEditorSession,
  type RichNodeJSON,
  RichEditorPlugin,
  chain,
  createRichEditor,
  defineExtension,
  insertContent,
  redo,
  richExtension,
  setMark,
  command,
  toggleMark,
  undo,
  unsetMark,
} from "nsh/base";
import { RichText, type Block, type SlashItem as RichSlashItem } from "nsh-richtext";

// --- Names ---------------------------------------------------------------------

/** The node types Mado uses, by their Tiptap names (the starter schema's). */
export const NODE = {
  paragraph: "paragraph",
  heading: "heading",
  blockquote: "blockquote",
  codeBlock: "codeBlock",
  bulletList: "bulletList",
  orderedList: "orderedList",
  listItem: "listItem",
  taskList: "taskList",
  taskItem: "taskItem",
  horizontalRule: "horizontalRule",
  hardBreak: "hardBreak",
  image: "image",
  table: "table",
  tableRow: "tableRow",
  tableHeader: "tableHeader",
  tableCell: "tableCell",
} as const;

/** The mark types Mado uses. */
export const MARK = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  code: "code",
  link: "link",
  highlight: "highlight",
  subscript: "subscript",
  superscript: "superscript",
} as const;

export type MarkKey = keyof typeof MARK;
export type BlockKey = "paragraph" | "h1" | "h2" | "h3" | "h4" | "codeBlock";
export type ListKey = "bulletList" | "orderedList" | "taskList";
export type TableCommand =
  | "addRowBefore"
  | "addRowAfter"
  | "addColumnBefore"
  | "addColumnAfter"
  | "deleteRow"
  | "deleteColumn"
  | "deleteTable"
  | "mergeOrSplit"
  | "toggleHeaderRow";
export type Align = "left" | "center" | "right" | "justify";

// --- Session queries ---------------------------------------------------------------

/** A box in the editor view, in points. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the caret at `pos` is drawn, in page coordinates (ProseMirror's `coordsAtPos`; the editor's scrolling included). */
export function coordsAtPos(editor: RichEditorSession, pos: number): Rect | null {
  return editor.pageCoordsAtPos(pos) as Rect | null;
}

/** The box around the selection in the editor view, or `null`. */
export function selectionRect(editor: RichEditorSession): Rect | null {
  return editor.selectionRect() as Rect | null;
}

/** The document position at a page point, or `null` (ProseMirror's `posAtCoords`). */
export function posAtCoords(editor: RichEditorSession, x: number, y: number): number | null {
  return editor.posAtPageCoords({ x, y });
}

/** The link at the selection: its `href`, or `""`. */
export function linkHref(editor: RichEditorSession): string {
  const attrs = editor.getAttributes(MARK.link) as Record<string, unknown> | null;
  return typeof attrs?.href === "string" ? attrs.href : "";
}

/** Listens to a session event (`selectionUpdate`, `focus`, `blur`); returns the function that stops it. */
export function onEditorEvent(editor: RichEditorSession, event: string, listener: () => void): () => void {
  const id = editor.on(event, listener);
  return () => editor.off(id);
}

/** The innermost textblock around the selection: its type, its start and end, and its text. */
export function currentBlock(editor: RichEditorSession): { type: string; from: number; to: number; text: string } | null {
  const resolved = editor.resolve(editor.selection.head ?? 0) as { parent: string; start: number; end: number } | null;
  if (!resolved) return null;
  return { type: resolved.parent, from: resolved.start, to: resolved.end, text: editor.textBetween(resolved.start, resolved.end, "\n") };
}


// --- Commands --------------------------------------------------------------------

/** A command of the runtime's Tiptap-named registry (`extendMarkRange`, `updateAttributes`, `cut`, ...). */
const named = (name: string, args: unknown): RichCommand => command(name, args);

export const commands = {
  undo,
  redo,
  /** Toggles a mark (`bold`, `highlight`, ...) over the selection. */
  mark(mark: MarkKey): RichCommand {
    return toggleMark(MARK[mark]);
  },
  /** Makes the selected textblocks `block` (a heading level, a code block or text). */
  block(block: BlockKey): RichCommand {
    return named("setBlockStyle", { style: block });
  },
  /** Toggles a block toggle: pressed sets it, released turns the block back into text. */
  toggleBlock(block: BlockKey, pressed: boolean): RichCommand {
    return commands.block(pressed ? block : "paragraph");
  },
  /** Toggles a list: out of it when in it, else from another list or from text into it. */
  toggleList(list: ListKey): RichCommand {
    return named("toggleListType", { list });
  },
  /** Toggles a quote around the selected blocks. */
  toggleQuote(): RichCommand {
    return named("toggleQuote", null);
  },
  /** Indents the list item (Tab). */
  indent(): RichCommand {
    return named("indentItem", null);
  },
  /** Outdents the list item (Shift-Tab). */
  outdent(): RichCommand {
    return named("outdentItem", null);
  },
  horizontalRule(): RichCommand {
    return named("insertDivider", null);
  },
  image(src: string, alt: string): RichCommand {
    return named("insertImage", { src, alt });
  },
  /** Sets the link over the selection (and over the whole link the caret is in), or types `text` as a link at the caret. */
  setLink(editor: RichEditorSession, href: string, text?: string): RichCommand {
    const selection = editor.selection;
    if (selection.anchor === selection.head && !linkHref(editor)) {
      const label = text?.trim() || href;
      return insertContent({ type: "text", text: label, marks: [{ type: MARK.link, attrs: { href } }] });
    }
    return chain([named("extendMarkRange", { name: MARK.link, attrs: null }), setMark(MARK.link, { href })]);
  },
  /** Removes the link the selection is in (all of it). */
  unsetLink(): RichCommand {
    return chain([named("extendMarkRange", { name: MARK.link, attrs: null }), unsetMark(MARK.link)]);
  },
  /** Aligns the selected paragraphs and headings. */
  align(align: Align): RichCommand {
    return named("setAlign", { align });
  },
  /** Replaces the `/query` the slash menu was opened with by the item's block. */
  fromSlash(from: number, to: number, item: SlashItem): RichCommand {
    return named("replaceWith", { from, to, command: item.command, args: item.args });
  },
  /** Inserts a table of `rows` × `cols` with a header row. */
  insertTable(rows = 3, cols = 3): RichCommand {
    return named("insertTable", { rows, cols, withHeaderRow: true });
  },
  /** One of the table kit's commands that takes no arguments (`addRowAfter`, `deleteColumn`, `mergeOrSplit`, ...). */
  table(name: TableCommand): RichCommand {
    return named(name, null);
  },
  /** Moves the block a handle at `source` moves to where dropping it at `target` puts it. */
  moveBlock(source: number, target: number): RichCommand {
    return named("moveBlockTo", { source, target });
  },
};

/** The block a handle at `pos` moves: the innermost list or task item, else the top-level block. */
export function blockAt(editor: RichEditorSession, pos: number): Block | null {
  return RichText.blockAt(editor.doc, pos);
}

/** Where dropping the block at `source` at `target` puts it, or `null`. */
export function dropTarget(editor: RichEditorSession, source: number, target: number) {
  return RichText.dropTarget(editor.doc, source, target);
}

/** The box of the first line of the block at `from`: where its handle sits. */
export function firstLineRect(editor: RichEditorSession, block: Block): Rect | null {
  // The first position inside a textblock: one past each opening boundary. A
  // position between a wrapper (a quote) and its first child may map anywhere
  // in the block, so the topmost of the first few is the first line.
  let first: Rect | null = null;
  for (let pos = block.from + 1, tries = 0; pos < block.to && tries < 3; pos++) {
    const box = coordsAtPos(editor, pos);
    if (!box) continue;
    tries++;
    if (!first || box.y < first.y) first = box;
  }
  return first;
}

/** The bounds of the block at `block`: its first line's top to its last line's bottom. */
export function blockRect(editor: RichEditorSession, block: Block): Rect | null {
  const first = firstLineRect(editor, block);
  let last: Rect | null = null;
  for (let pos = block.to - 1; pos > block.from && !last; pos--) last = coordsAtPos(editor, pos);
  if (!first || !last) return first;
  const y = Math.min(first.y, last.y);
  return { x: first.x, y, width: first.width, height: Math.max(first.y + first.height, last.y + last.height) - y };
}

/** The marks active at the selection. */
export function activeMarks(editor: RichEditorSession): MarkKey[] {
  return (Object.keys(MARK) as MarkKey[]).filter((mark) => editor.isActive(MARK[mark]));
}

/** The textblock type at the selection. */
export function activeBlock(editor: RichEditorSession): BlockKey | null {
  if (editor.isActive(NODE.codeBlock)) return "codeBlock";
  for (const level of [1, 2, 3, 4] as const) if (editor.isActive(NODE.heading, { level })) return `h${level}`;
  return editor.isActive(NODE.paragraph) ? "paragraph" : null;
}

/** Whether the selection is in a table. */
export function inTable(editor: RichEditorSession): boolean {
  return editor.isActive(NODE.table);
}

/** The lists around the selection, innermost last. */
export function activeLists(editor: RichEditorSession): ListKey[] {
  return (["bulletList", "orderedList", "taskList"] as const).filter((list) => editor.isActive(NODE[list]));
}

export function activeAlign(editor: RichEditorSession): Align {
  for (const align of ["center", "right", "justify"] as const) {
    if (editor.isActive(NODE.paragraph, { textAlign: align }) || editor.isActive(NODE.heading, { textAlign: align })) return align;
  }
  return "left";
}

// --- The slash menu's items --------------------------------------------------------

/** A block the slash menu inserts (nsh-richtext's), with its icon typed. */
export type SlashItem = RichSlashItem & { icon: import("../components/lucide").LucideName };

/** The slash menu's items matching `query` (by label or keyword). */
export function slashMatches(query: string): SlashItem[] {
  return RichText.slashItems(query) as SlashItem[];
}

// --- The editor ---------------------------------------------------------------------

/** The plugins Mado's editors run, and the app plugins it hands back to capture keys with. */
export interface MadoEditor {
  editor: RichEditorSession;
  /** Takes app shortcuts while the editor has focus. */
  shortcuts: RichEditorPlugin;
  /** Who hears the captured keys now: the view showing the editor sets them while it is shown. */
  handlers: { shortcut: ((key: string) => void) | null };
}

/** The editor's document as Markdown: nsh-richtext's, which keeps `==highlights==`. */
export function markdownOf(editor: RichEditorSession): string {
  return RichText.toMarkdown(editor.doc);
}

/** Makes an editor holding `markdown`. */
export function createMadoEditor(markdownText: string): MadoEditor {
  const shortcuts = new RichEditorPlugin("mado-shortcuts");
  const editor = createRichEditor({
    content: RichText.fromMarkdown(markdownText) as RichNodeJSON,
    // The app's shortcuts bind before the kit's keymap, as a higher priority runs first.
    extensions: [defineExtension({ name: "madoKeys", priority: 1000, addProseMirrorPlugins: () => [shortcuts] }), richExtension("richTextKit")],
  });
  const handlers: MadoEditor["handlers"] = { shortcut: null };
  shortcuts.captureKeys(SHORTCUT_KEYS, (key) => handlers.shortcut?.(key));
  shortcuts.capturing = true;
  return { editor, shortcuts, handlers };
}

/** The editor's keys Mado handles itself, as `RichEditorPlugin.captureKeys` names them. */
export const SHORTCUT_KEYS = ["Mod-s", "Mod-k", "Mod-n", "Mod-o", "Mod-/"];
/** The key of the kit's `/` suggestion (nsh-richtext's `slashMenu`), for `editor.suggestion`. */
export const SLASH_KEY = "slash";

// --- The document's look -------------------------------------------------------------

const marks: Record<string, string> = {
  [MARK.bold]: "font-semibold",
  [MARK.italic]: "italic",
  [MARK.underline]: "underline",
  [MARK.strike]: "line-through",
  [MARK.code]: "font-mono text-sm bg-muted rounded px-1",
  [MARK.link]: "text-primary underline",
  [MARK.highlight]: "bg-yellow-200 dark:bg-yellow-500/40",
  [MARK.subscript]: "text-xs",
  [MARK.superscript]: "text-xs",
};

const nodes: Record<string, string> = {
  [NODE.paragraph]: "text-base leading-7",
  [`${NODE.heading}[level=1]`]: "text-3xl font-bold tracking-tight mt-4",
  [`${NODE.heading}[level=2]`]: "text-2xl font-semibold tracking-tight mt-3",
  [`${NODE.heading}[level=3]`]: "text-xl font-semibold mt-2",
  [`${NODE.heading}[level=4]`]: "text-lg font-semibold mt-1",
  [`${NODE.heading}[level=5]`]: "text-base font-semibold",
  [`${NODE.heading}[level=6]`]: "text-sm font-semibold text-muted-foreground",
  [NODE.blockquote]: "border-l-4 border-border pl-4 text-muted-foreground gap-2",
  [NODE.codeBlock]: "font-mono text-sm leading-6 bg-muted rounded-lg px-4 py-3",
  [NODE.bulletList]: "gap-1 pl-6",
  [NODE.orderedList]: "gap-1 pl-6",
  [NODE.taskList]: "gap-1 pl-1",
  [NODE.taskItem]: "flex-row gap-2",
  [NODE.listItem]: "gap-1",
  [NODE.horizontalRule]: "h-px bg-border my-4",
  [NODE.image]: "rounded-lg max-w-full",
  [NODE.table]: "border border-border rounded-md",
  [NODE.tableRow]: "border-b border-border",
  [NODE.tableHeader]: "bg-muted font-semibold px-3 py-2 border-r border-border",
  [NODE.tableCell]: "px-3 py-2 border-r border-border",
};
for (const align of ["center", "right", "justify"] as const) {
  nodes[`${NODE.paragraph}[textAlign=${align}]`] = `${nodes[NODE.paragraph]} text-${align}`;
}

/** The document column `editorClasses.content` makes: its widest (`max-w-3xl`) and its left gutter (`pl-16`). */
export const CONTENT = { maxWidth: 768, gutter: 64 };

/** Where top-level blocks' text starts in an editor `width` wide: the column every handle sits before. */
export function textLeft(width: number): number {
  return Math.max(0, (width - Math.min(width, CONTENT.maxWidth)) / 2) + CONTENT.gutter;
}

/** Where the document column's text ends in an editor `width` wide (`pr-5`). */
export function textRight(width: number): number {
  return textLeft(width) - CONTENT.gutter + Math.min(width, CONTENT.maxWidth) - 20;
}

/** The classes of the editor's parts and the document's nodes and marks. */
export const editorClasses: RichEditorClasses = {
  // `pl-16`: the gutter the block handle sits in, so it never covers the text in a narrow window.
  // Centered at a reading width inside the full-width scroll view (`CONTENT`).
  content: "w-full max-w-3xl self-center gap-4 pl-16 pr-5 pt-4 pb-24",
  placeholder: "text-muted-foreground",
  listMarker: "text-muted-foreground",
  selectedNode: "outline outline-2 outline-blue-500 rounded-md",
  taskCheckbox: "mt-1.5 size-4 rounded border border-input checked:bg-primary checked:border-primary",
  dropCursor: "bg-blue-500 h-[3px] rounded-full",
  selectedCell: "bg-accent",
  tableGrip: "bg-muted-foreground/40 rounded-full hover:bg-ring",
  tableResizeHandle: "bg-ring",
  tableDropIndicator: "bg-ring",
  nodes,
  marks,
};

/** What an empty block says, by its node type (the `placeholders` prop). */
export const placeholders: Record<string, string> = {
  [NODE.paragraph]: "Write something, or type / for commands…",
  [NODE.heading]: "Heading",
  [NODE.codeBlock]: "Code",
};
