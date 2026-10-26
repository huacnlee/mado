// Everything Mado tells the rich text editor lives here: the node and mark
// names, the plugins and key bindings, the commands the toolbar, the bubble
// menu and the slash menu run, and the classes of the document's parts.
// The rest of the app asks this module, so a change of `nsh/base`'s
// RichEditor API (names, extensions) is adapted in one place.
import {
  type RichCommand,
  type RichEditorClasses,
  type RichEditorSession,
  type RichNodeJSON,
  RichEditorPlugin,
  chain,
  createRichEditor,
  first,
  insertContent,
  liftListItem,
  markdown,
  redo,
  setBlockType,
  setMark,
  command,
  setTextSelection,
  sinkListItem,
  starterKit,
  toggleMark,
  undo,
  unsetMark,
  wrapIn,
  wrapInList,
  lift,
} from "nsh/base";

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
export type Align = "left" | "center" | "right" | "justify";

// --- Session queries ---------------------------------------------------------------

/** A box in the editor view, in points. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the caret at `pos` is drawn, in the editor view. */
export function coordsAtPos(editor: RichEditorSession, pos: number): Rect | null {
  return editor.coordsAtPos(pos) as Rect | null;
}

/** The box around the selection in the editor view, or `null`. */
export function selectionRect(editor: RichEditorSession): Rect | null {
  return editor.selectionRect() as Rect | null;
}

/** The document position at a point of the editor view, or `null`. */
export function posAtCoords(editor: RichEditorSession, x: number, y: number): number | null {
  return editor.posAtCoords({ x, y });
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

const LEAVES = new Set<string>([NODE.horizontalRule, NODE.image, NODE.hardBreak]);

/** A node's size in document positions, as ProseMirror counts it: a text its length, a leaf one, any other node its content and two boundaries. */
export function nodeSize(node: RichNodeJSON): number {
  if (node.type === "text") return node.text?.length ?? 0;
  if (LEAVES.has(node.type)) return 1;
  return (node.content ?? []).reduce((n, c) => n + nodeSize(c), 0) + 2;
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
    if (block === "paragraph") return setBlockType(NODE.paragraph);
    if (block === "codeBlock") return setBlockType(NODE.codeBlock);
    return setBlockType(NODE.heading, { level: Number(block[1]) });
  },
  /** Toggles a block toggle: pressed sets it, released turns the block back into text. */
  toggleBlock(block: BlockKey, pressed: boolean): RichCommand {
    return pressed ? commands.block(block) : commands.block("paragraph");
  },
  /** Toggles a list: out of it when in it, else out of the other lists and into it. */
  toggleList(list: ListKey, active: ListKey[]): RichCommand {
    const itemOf = (l: ListKey) => (l === "taskList" ? NODE.taskItem : NODE.listItem);
    if (active.includes(list)) return liftListItem(itemOf(list));
    const out = active.map((other) => liftListItem(itemOf(other)));
    return out.length ? chain([...out, wrapInList(NODE[list])]) : wrapInList(NODE[list]);
  },
  /** Toggles a quote around the selected blocks. */
  toggleQuote(active: boolean): RichCommand {
    return active ? lift() : wrapIn(NODE.blockquote);
  },
  /** Indents the list item (Tab). */
  indent(): RichCommand {
    return first([NODE.listItem, NODE.taskItem].map((item) => sinkListItem(item)));
  },
  /** Outdents the list item (Shift-Tab). */
  outdent(): RichCommand {
    return first([NODE.listItem, NODE.taskItem].map((item) => liftListItem(item)));
  },
  horizontalRule(): RichCommand {
    return insertContent({ type: NODE.horizontalRule });
  },
  image(src: string, alt: string): RichCommand {
    return insertContent({ type: NODE.image, attrs: { src, alt, title: null } });
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
    const textAlign = align === "left" ? null : align;
    return first([NODE.heading, NODE.paragraph].map((name) => named("updateAttributes", { name, attrs: { textAlign } })));
  },
  /** Replaces the `/query` the slash menu was opened with by `then`'s result. */
  fromSlash(from: number, to: number, then: RichCommand | null): RichCommand {
    const remove = chain([setTextSelection(from, to), command("deleteSelection")]);
    return then ? chain([remove, then]) : remove;
  },
  /** Moves the block at `range` to `target` (drag to move). */
  moveBlock(range: { from: number; to: number }, target: number): RichCommand {
    return named("cut", { range, targetPos: target });
  },
};

/** The top-level blocks of `doc`: their type and their range in document positions. */
export function topLevelBlocks(doc: RichNodeJSON): { type: string; from: number; to: number }[] {
  const blocks: { type: string; from: number; to: number }[] = [];
  let at = 0;
  for (const child of doc.content ?? []) {
    const end = at + nodeSize(child);
    blocks.push({ type: child.type, from: at, to: end });
    at = end;
  }
  return blocks;
}

/** Where moving the top-level block at `pos` one place up (`-1`) or down (`1`) puts it: the command, or `null` at an end. */
export function moveBlockBy(editor: RichEditorSession, pos: number, by: -1 | 1): RichCommand | null {
  const blocks = topLevelBlocks(editor.doc);
  const index = blocks.findIndex((b) => pos >= b.from && pos < b.to);
  const other = blocks[index + by];
  if (index < 0 || !other) return null;
  const block = blocks[index];
  return commands.moveBlock({ from: block.from, to: block.to }, by < 0 ? other.from : other.to);
}

/** The marks active at the selection. */
export function activeMarks(editor: RichEditorSession): MarkKey[] {
  return (Object.keys(MARK) as MarkKey[]).filter((mark) => editor.isActive(MARK[mark]));
}

/** The textblock type at the selection. */
export function activeBlock(editor: RichEditorSession): BlockKey | null {
  if (NODE.codeBlock && editor.isActive(NODE.codeBlock)) return "codeBlock";
  for (const level of [1, 2, 3, 4] as const) if (editor.isActive(NODE.heading, { level })) return `h${level}`;
  return editor.isActive(NODE.paragraph) ? "paragraph" : null;
}

/** The lists around the selection, innermost last. */
export function activeLists(editor: RichEditorSession): ListKey[] {
  return (["bulletList", "orderedList", "taskList"] as const).filter((list) => NODE[list] && editor.isActive(NODE[list] as string));
}

export function activeAlign(editor: RichEditorSession): Align {
  for (const align of ["center", "right", "justify"] as const) {
    if (editor.isActive(NODE.paragraph, { textAlign: align }) || editor.isActive(NODE.heading, { textAlign: align })) return align;
  }
  return "left";
}

// --- The slash menu's items --------------------------------------------------------

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: import("../components/lucide").LucideName;
  keywords: string;
  command: (editor: RichEditorSession) => RichCommand | null;
}

export const SLASH_ITEMS: SlashItem[] = [
    { id: "text", label: "Text", hint: "Plain paragraph", icon: "pilcrow", keywords: "paragraph text", command: () => commands.block("paragraph") },
    { id: "h1", label: "Heading 1", hint: "Big section heading", icon: "heading-1", keywords: "title h1", command: () => commands.block("h1") },
    { id: "h2", label: "Heading 2", hint: "Medium section heading", icon: "heading-2", keywords: "subtitle h2", command: () => commands.block("h2") },
    { id: "h3", label: "Heading 3", hint: "Small section heading", icon: "heading-3", keywords: "h3", command: () => commands.block("h3") },
    { id: "bullet", label: "Bulleted list", hint: "A simple list", icon: "list", keywords: "ul unordered bullet", command: (e) => commands.toggleList("bulletList", activeLists(e)) },
    { id: "ordered", label: "Numbered list", hint: "A list with numbers", icon: "list-ordered", keywords: "ol ordered number", command: (e) => commands.toggleList("orderedList", activeLists(e)) },
    { id: "task", label: "Task list", hint: "Track tasks with checkboxes", icon: "list-todo", keywords: "todo check task", command: (e) => commands.toggleList("taskList", activeLists(e)) },
    { id: "quote", label: "Quote", hint: "Capture a quote", icon: "text-quote", keywords: "blockquote citation", command: (e) => commands.toggleQuote(e.isActive(NODE.blockquote)) },
    { id: "code", label: "Code block", hint: "Code with a fence", icon: "square-code", keywords: "code pre fence", command: () => commands.block("codeBlock") },
    { id: "rule", label: "Divider", hint: "A horizontal rule", icon: "minus", keywords: "hr rule separator divider", command: () => commands.horizontalRule() },
    { id: "image", label: "Image", hint: "Insert an image by path or URL", icon: "image", keywords: "picture photo img", command: () => null },
];

/** The slash menu's items matching `query` (by label or keyword). */
export function slashMatches(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) => item.label.toLowerCase().includes(q) || item.keywords.includes(q));
}

// --- The editor ---------------------------------------------------------------------

/** The plugins Mado's editors run, and the app plugins it hands back to capture keys with. */
export interface MadoEditor {
  editor: RichEditorSession;
  /** Takes Mod-s and Mod-k while the editor has the focus: saving and the link editor are the app's. */
  shortcuts: RichEditorPlugin;
  /** Takes the arrows, Enter and Escape while the slash menu is open. */
  slash: RichEditorPlugin;
  /** Who hears the captured keys now: the view showing the editor sets them while it is shown. */
  handlers: { shortcut: ((key: string) => void) | null; slash: ((key: string) => void) | null };
}

/** Makes an editor holding `markdown`. */
export function createMadoEditor(markdownText: string): MadoEditor {
  const shortcuts = new RichEditorPlugin("mado-shortcuts");
  const slash = new RichEditorPlugin("mado-slash");
  const editor = createRichEditor({
    content: markdownText,
    format: "markdown",
    plugins: [slash, shortcuts, markdown(), starterKit()],
  });
  const handlers: MadoEditor["handlers"] = { shortcut: null, slash: null };
  shortcuts.captureKeys(SHORTCUT_KEYS, (key) => handlers.shortcut?.(key));
  shortcuts.capturing = true;
  slash.captureKeys(SLASH_KEYS, (key) => handlers.slash?.(key));
  return { editor, shortcuts, slash, handlers };
}

/** The editor's keys Mado handles itself, as `RichEditorPlugin.captureKeys` names them. */
export const SHORTCUT_KEYS = ["Mod-s", "Mod-k", "Alt-ArrowUp", "Alt-ArrowDown"];
/** The keys the slash menu takes while open. */
export const SLASH_KEYS = ["ArrowUp", "ArrowDown", "Enter", "Escape", "Tab"];

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
};
for (const align of ["center", "right", "justify"] as const) {
  nodes[`${NODE.paragraph}[textAlign=${align}]`] = `${nodes[NODE.paragraph]} text-${align}`;
}

/** The classes of the editor's parts and the document's nodes and marks. */
export const editorClasses: RichEditorClasses = {
  content: "gap-4 px-1 pb-24",
  placeholder: "text-muted-foreground",
  listMarker: "text-muted-foreground",
  selectedNode: "outline outline-2 outline-ring rounded",
  taskCheckbox: "mt-1.5 size-4 rounded border border-input",
  dropCursor: "bg-ring",
  nodes,
  marks,
};

/** What an empty block says, by its node type (the `placeholders` prop). */
export const placeholders: Record<string, string> = {
  [NODE.paragraph]: "Write something, or type / for commands…",
  [NODE.heading]: "Heading",
  [NODE.codeBlock]: "Code",
};
