// The rich editor and what floats over it: the bubble menu over a selection,
// the slash menu at a `/`, and the block handle beside the first line of the
// block under the pointer or the caret (a "+" on an empty line, a grip to
// drag the block elsewhere). Blocks are nsh-richtext's: a list or task item
// moves on its own among its siblings, any other block at the top level.
import { Overlay, Text, View, cleanup, signal, token, type YNode } from "nsh";
import { RichEditor } from "nsh/base";
import {
  type MadoEditor,
  type SlashItem,
  commands,
  blockAt,
  coordsAtPos,
  currentBlock,
  editorClasses,
  firstLineRect,
  onEditorEvent,
  placeholders,
  posAtCoords,
  selectionRect,
  slashMatches,
  NODE,
  SLASH_KEY,
  textLeft,
  textRight,
  inTable,
  linkHref,
  cellRange,
} from "../editor/setup";
import { insertContentAt, insertText } from "nsh/base";
import { Buffer } from "buffer";
import * as path from "path";
import { FloatingMenu } from "./FloatingMenu";
import { LinkBar } from "./LinkBar";
import { AxisMenu } from "./AxisMenu";
import type { CellRange } from "nsh-richtext";
import { BubbleMenu } from "./BubbleMenu";
import { Icon } from "./Icon";
import { SlashMenu } from "./SlashMenu";
import { TableMenu } from "./TableMenu";

export interface VisualEditorActions {
  save: () => void;
  newFile: () => void;
  openFile: () => void;
  toggleMode: () => void;
  openLink: () => void;
  openImage: () => void;
}

/** How far left of an item's text its handle goes: past the bullet, number or checkbox. */
const ITEM_GUTTER = 30;

type Box = { x: number; y: number; width: number; height: number };

export function VisualEditor(props: { mado: MadoEditor; revision: number; actions: VisualEditorActions }) {
  const { editor, handlers } = props.mado;
  let host: YNode | null = null;
  const origin = signal({ x: 0, y: 0 });
  const slashQuery = signal<{ text: string; from: number; to: number } | null>(null);
  const highlighted = signal(0);
  const bubble = signal<Box | null>(null);
  /** The caret is in a table: the bubble menu shows its rows and columns. */
  const table = signal(false);
  /** The link the caret rests in: its bar shows under it. */
  const link = signal("");
  const linkEditing = signal(false);
  /** Whole columns or rows selected (by a grip): their menu shows instead of the table's bar. */
  const axis = signal<CellRange | null>(null);
  const handle = signal<{ box: Box; empty: boolean; pos: number; end: number; item: boolean } | null>(null);
  /** The block the pointer is over, which the handle follows before the caret's. */
  const hovered = signal<number | null>(null);
  const focused = signal(false);
  /** Typed since the pointer last moved: the handle steps aside, as Tiptap's does on a key. */
  const typing = signal(false);
  /** The dragged blocks' first line, beside the pointer (Tiptap's drag image). */
  const preview = signal<{ x: number; y: number; text: string } | null>(null);
  const dragging = signal<number | null>(null);
  let hostWidth = 0;
  const matches = () => {
    const q = slashQuery();
    return q ? slashMatches(q.text) : [];
  };

  handlers.shortcut = (key) => {
    if (key === "Mod-s") props.actions.save();
    else if (key === "Mod-k") props.actions.openLink();
    else if (key === "Mod-n") props.actions.newFile();
    else if (key === "Mod-o") props.actions.openFile();
    else if (key === "Mod-/") props.actions.toggleMode();
  };

  /** The suggestion the menu was dismissed for (Escape is native; a press outside closes it here). */
  let dismissed: string | null = null;
  /** The captured keys already acted on. */
  let keysSeen = 0;

  const closeSlash = () => {
    dismissed = editor.suggestion(SLASH_KEY)?.decorationId ?? null;
    slashQuery.set(null);
  };

  const pick = (item: SlashItem) => {
    const q = slashQuery();
    if (!q) return;
    closeSlash();
    editor.run(commands.fromSlash(q.from, q.to, item));
    if (item.id === "image") props.actions.openImage();
    editor.focus();
  };

  /** A key the kit's slash suggestion captured while active. */
  const slashKey = (key: string) => {
    const count = matches().length;
    if (key === "ArrowDown") highlighted.set((highlighted() + 1) % Math.max(count, 1));
    else if (key === "ArrowUp") highlighted.set((highlighted() + count - 1) % Math.max(count, 1));
    else if ((key === "Enter" || key === "Tab") && count > 0) pick(matches()[highlighted()]);
  };

  /** Follows the kit's `/` suggestion (nsh-richtext's `slashMenu`): its range, its query and the keys it took. */
  const followSlash = () => {
    const state = editor.suggestion(SLASH_KEY);
    if (!state?.active || state.decorationId === dismissed) {
      if (!state?.active) dismissed = null;
      keysSeen = state?.keyCount ?? 0;
      slashQuery.set(null);
      return;
    }
    const opening = slashQuery() === null;
    slashQuery.set({ text: state.query ?? "", from: state.range.from, to: state.range.to });
    if (opening) highlighted.set(0);
    else highlighted.set(Math.min(highlighted(), Math.max(matches().length - 1, 0)));
    if (state.keyCount > keysSeen && state.lastKey) {
      keysSeen = state.keyCount;
      slashKey(state.lastKey);
    }
  };

  const measure = async () => {
    const m = await host?.measure();
    if (m) {
      origin.set({ x: m.pagePosition.x, y: m.pagePosition.y });
      hostWidth = m.bounds.size.width;
    }
  };

  /** After each change: the slash menu, the bubble menu and the block handle follow the selection. */
  const follow = () => {
    const selection = editor.selection;
    const head = selection.head ?? 0;
    const empty = selection.type !== "text" || selection.anchor === selection.head;
    const block = currentBlock(editor);

    followSlash();

    void measure();
    bubble.set(!empty && selection.type === "text" ? selectionRect(editor) : null);
    table.set(inTable(editor));
    const range = cellRange(editor);
    axis.set(range && range.kind !== "cells" ? range : null);
    const href = empty && selection.type === "text" ? linkHref(editor) : "";
    if (href !== link()) linkEditing.set(false);
    link.set(href);
    placeHandle(hovered() ?? head, block);
  };

  let lineRetries = 0;

  /** Puts the handle beside the first line of the block at `pos`. */
  const placeHandle = (pos: number, caretBlock = currentBlock(editor)) => {
    if (dragging() !== null) return;
    const target = blockAt(editor, pos);
    const line = target ? firstLineRect(editor, target) : null;
    if (!target || !line) {
      handle.set(null);
      // A block the transaction just made has no layout yet: read it again over the next frames.
      if (target && lineRetries < 10) {
        lineRetries++;
        setTimeout(() => placeHandle(pos), 16);
      }
      return;
    }
    lineRetries = 0;
    const head = editor.selection.head ?? 0;
    const empty = !!caretBlock && caretBlock.text === "" && caretBlock.type === NODE.paragraph && head >= target.from && head < target.to;
    // Below the top level a block is a list or task item, whose marker sits left of its text.
    // Top-level blocks' handles share one column before the text, whatever the block's own padding (a code block, a quote).
    const item = target.depth > 1;
    const box = item || hostWidth === 0 ? line : { ...line, x: origin().x + textLeft(hostWidth), width: 1 };
    handle.set({ box, empty, pos: target.from + 1, end: target.to, item });
  };

  /** The document position at a page point's height, its x held inside the text column (the handle's gutter maps to the block beside it). */
  const blockPosAt = (pageX: number, pageY: number) => {
    const left = origin().x;
    const x = hostWidth > 0 ? Math.min(Math.max(pageX, left + textLeft(hostWidth) + 8), left + textRight(hostWidth) - 8) : pageX;
    return nearestPos(x, pageY);
  };

  let retried = false;

  /** The pointer moved over the editor: the handle follows the block under it. */
  const hover = (pageX: number, pageY: number) => {
    if (dragging() !== null) return;
    typing.set(false);
    // The block at the pointer's height, read inside the text column: moving left onto the handle keeps its block.
    const pos = blockPosAt(pageX, pageY);
    // The editor learns where it is on the page from the pointer's first move over it, which may reach it after
    // this one: once, the hover is read again a frame later.
    if (pos === null && !retried) {
      retried = true;
      setTimeout(() => hover(pageX, pageY), 16);
      return;
    }
    retried = false;
    if (pos === null || pos === hovered()) return;
    hovered.set(pos);
    placeHandle(pos);
  };

  const subscription = editor.subscribe(() => follow());
  const offs = [
    // The handle stays on the block last hovered (the pointer leaves the text to reach it) until the caret moves.
    onEditorEvent(editor, "selectionUpdate", () => {
      hovered.set(null);
      follow();
    }),
    onEditorEvent(editor, "focus", () => {
      focused.set(true);
      // A document loaded without a change has placed nothing yet.
      follow();
    }),
    onEditorEvent(editor, "update", () => {
      if (dragging() === null) typing.set(true);
    }),
    onEditorEvent(editor, "blur", () => focused.set(false)),
  ];
  // A document opened without a change yet: the menus and the handle start from it as it is.
  setTimeout(() => {
    focused.set(editor.isFocused);
    follow();
  }, 0);
  cleanup(() => {
    editor.unsubscribe(subscription);
    for (const off of offs) off();
    handlers.shortcut = null;
  });

  // Boxes are in page coordinates already (`pageCoordsAtPos`).
  const at = (box: Box) => ({ origin: { x: box.x, y: box.y }, size: { width: Math.max(box.width, 1), height: box.height } });

  /** The document position at a point, or, past the text's end (below the last block), at the nearest line above it. */
  const nearestPos = (x: number, y: number) => {
    for (let up = 0; up <= 120; up += 8) {
      const pos = posAtCoords(editor, x, y - up);
      if (pos !== null) return pos;
    }
    return null;
  };

  /** What a handle drag from the block at `from` carries, as text: the selection when it spans that block, else the block. */
  const draggedText = (from: number) => {
    const block = blockAt(editor, from + 1);
    const { anchor, head } = editor.selection;
    const [a, b] = [Math.min(anchor ?? 0, head ?? 0), Math.max(anchor ?? 0, head ?? 0)];
    const [start, end] = a < b && block && a <= block.to && b >= block.from ? [a, b] : [block?.from ?? from, block?.to ?? from];
    return editor.textBetween(start, end, "\n").trim().split("\n")[0] ?? "";
  };

  /** Ends a handle drag: NSH's view drops the block at its drop cursor, or keeps it selected after a press. */
  const endDrag = () => {
    if (dragging() === null) return;
    dragging.set(null);
    preview.set(null);
    editor.endDrag();
    editor.focus();
  };

  /** Local image files (`file:` URLs, pasted or dropped) become image blocks at the selection, as Tiptap's file handler does. */
  const insertImageFiles = (uris: string[]) => {
    for (const uri of uris) {
      const file = decodeURIComponent(uri.replace(/^file:\/\//, ""));
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(file)) editor.run(commands.image(file, path.basename(file)));
    }
  };

  return (
    <View
      ref={(node: YNode) => (host = node)}
      class="relative flex-1"
      onLayout={() => {
        void measure();
        // The first layout of a new document gives its empty line a place.
        placeHandle(hovered() ?? editor.selection.head ?? 0);
      }}
      onHoverMove={(e) => hover(e.pagePosition.x, e.pagePosition.y)}
      onFileDrop={(e) => insertImageFiles(e.uris)}
    >
      <RichEditor
        editor={editor}
        testID="rich-editor"
        accessibilityLabel="Document"
        placeholders={placeholders}
        showOnlyCurrent
        classes={editorClasses}
        class="flex-1"
        autoFocus
        onFocus={() => focused.set(true)}
        onBlur={() => focused.set(false)}
        onPasteFiles={(paste) => {
          // Tiptap's file handler: pasted images become image blocks. Local files by their path, a screenshot's bytes inline.
          insertImageFiles(paste.uris);
          for (const file of paste.files) {
            if (file.mime.startsWith("image/")) editor.run(commands.image(`data:${file.mime};base64,${Buffer.from(file.data).toString("base64")}`, file.name));
          }
        }}
        bubbleMenuPlacement={link() && bubble() === null ? "bottom" : "top"}
        bubbleMenu={
          <If when={slashQuery() === null && bubble() === null && link() !== "" && (focused() || linkEditing())} else={
          <If when={slashQuery() === null && (bubble() !== null || table() || axis() !== null)}>
            <If
              when={bubble() !== null}
              else={
                <If when={axis()} else={<TableMenu editor={editor} />}>
                  <AxisMenu editor={editor} range={axis() as CellRange} />
                </If>
              }
            >
              <BubbleMenu editor={editor} revision={props.revision} onLink={props.actions.openLink} />
            </If>
          </If>
          }>
            <LinkBar editor={editor} href={link()} editing={linkEditing} />
          </If>
        }
      />
      <If when={slashQuery() !== null}>
        <Overlay
          anchor={(() => {
            const q = slashQuery();
            const box = q ? coordsAtPos(editor, q.to) : null;
            return box ? at(box) : host;
          })()}
          placement="bottom"
          align="start"
          offset={6}
          onPressOutside={closeSlash}
          onCancel={closeSlash}
        >
          <SlashMenu items={matches()} highlighted={highlighted()} onPick={pick} onHover={(v) => highlighted.set(v)} />
        </Overlay>
      </If>
      <If when={preview() !== null}>
        <Overlay anchor={{ origin: { x: preview()?.x ?? 0, y: preview()?.y ?? 0 }, size: { width: 1, height: 1 } }} placement="right" align="center" offset={12}>
          <View testID="drag-preview" class="max-w-96 rounded-md border-2 border-blue-500 bg-background/70 px-2 py-1 opacity-70">
            <Text class="line-clamp-1 text-sm text-foreground">
              {preview()?.text || " "}
            </Text>
          </View>
        </Overlay>
      </If>
      {/* Tiptap's floating menu: an empty line of a focused editor offers the blocks it can become. */}
      <If when={handle()?.empty === true && focused() && dragging() === null && slashQuery() === null && !table()}>
        <Overlay anchor={at((handle() as { box: Box }).box)} placement="right" align="center" offset={4}>
          <FloatingMenu editor={editor} />
        </Overlay>
      </If>
      {/* While a drag runs the handle stays: it holds the press (a dragged table selects, which would hide it). */}
      <If when={handle() !== null && (dragging() !== null || ((focused() || hovered() !== null) && !typing() && !table() && slashQuery() === null))}>
        {/* Anchored on the block's first line, centered on it, whatever the block's height. */}
        <Overlay anchor={at((handle() as { box: Box }).box)} placement="left" align="center" offset={handle()?.item ? ITEM_GUTTER : 6}>
          <View class="flex-row items-center gap-0.5">
            <If when={handle()?.empty || !handle()?.item}>
              <View
                testID="block-plus"
                tooltip="Insert a block below"
                accessibilityLabel="Insert a block"
                role="button"
                // An empty line takes the slash; any other block gets a new line after it with the slash typed (Notion's and allsum's +).
                onPress={() => {
                  const shown = handle();
                  if (shown && !shown.empty) {
                    editor.run(insertContentAt(shown.end, { type: NODE.paragraph, content: [{ type: "text", text: "/" }] }, { updateSelection: true }));
                  } else {
                    editor.run(insertText("/"));
                  }
                  editor.focus();
                }}
                class="size-6 items-center justify-center rounded-md hover:bg-accent"
              >
                <Icon name="plus" size={14} tint={token("muted-foreground")} />
              </View>
            </If>
            <View
              testID="block-grip"
              tooltip="Drag to move, or Alt-↑ / Alt-↓"
              accessibilityLabel="Move block"
              onStartShouldSetResponder={() => true}
              // The handle starts the view's own drag of the block (Tiptap's DragHandle over ProseMirror's): it
              // selects the block, the drop cursor follows the pointer, and the view scrolls at its edges.
              onResponderGrant={(e) => {
                const pos = handle()?.pos;
                if (pos === undefined) return false;
                editor.dragBlock(pos - 1, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                dragging.set(pos);
                preview.set({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, text: draggedText(pos - 1) });
                return true;
              }}
              onResponderMove={(e) => {
                const page = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                editor.dragTo(page);
                const shown = preview();
                if (shown) preview.set({ ...shown, ...page });
              }}
              onResponderRelease={endDrag}
              onResponderTerminate={endDrag}
              onResponderTerminationRequest={() => false}
              class={`h-6 w-5 items-center justify-center rounded-md hover:bg-accent ${dragging() !== null ? "bg-accent" : ""}`}
            >
              <Icon name="grip-vertical" size={14} tint={token("muted-foreground")} />
            </View>
          </View>
        </Overlay>
      </If>
    </View>
  );
}
