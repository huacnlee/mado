// The rich editor and what floats over it: the bubble menu over a selection,
// the slash menu at a `/`, and the block handle beside the first line of the
// block under the pointer or the caret (a "+" on an empty line, a grip to
// drag the block elsewhere). Blocks are nsh-richtext's: a list or task item
// moves on its own among its siblings, any other block at the top level.
import { Overlay, View, cleanup, signal, token, type YNode } from "nsh";
import { RichEditor } from "nsh/base";
import {
  type MadoEditor,
  type SlashItem,
  commands,
  blockAt,
  blockRect,
  coordsAtPos,
  currentBlock,
  dropTarget,
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
  inTable,
} from "../editor/setup";
import { insertText, setNodeSelection } from "nsh/base";
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
/** How far the pointer moves on the grip before a press becomes a drag. */
const DRAG_SLOP = 4;

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
  const handle = signal<{ box: Box; empty: boolean; pos: number; item: boolean } | null>(null);
  /** The block the pointer is over, which the handle follows before the caret's. */
  const hovered = signal<number | null>(null);
  const focused = signal(false);
  const dragging = signal<number | null>(null);
  const dropLine = signal<Box | null>(null);
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
    placeHandle(hovered() ?? head, block);
  };

  /** Puts the handle beside the first line of the block at `pos`. */
  const placeHandle = (pos: number, caretBlock = currentBlock(editor)) => {
    if (dragging() !== null) return;
    const target = blockAt(editor, pos);
    const line = target ? firstLineRect(editor, target) : null;
    if (!target || !line) {
      handle.set(null);
      return;
    }
    const head = editor.selection.head ?? 0;
    const empty = !!caretBlock && caretBlock.text === "" && caretBlock.type === NODE.paragraph && head >= target.from && head < target.to;
    // Below the top level a block is a list or task item, whose marker sits left of its text.
    // Top-level blocks' handles share one column before the text, whatever the block's own padding (a code block, a quote).
    const item = target.depth > 1;
    const box = item || hostWidth === 0 ? line : { ...line, x: textLeft(hostWidth), width: 1 };
    handle.set({ box, empty, pos: target.from + 1, item });
  };

  /** The pointer moved over the editor: the handle follows the block under it. */
  const hover = (pageX: number, pageY: number) => {
    if (dragging() !== null) return;
    const pos = posAtCoords(editor, pageX - origin().x, pageY - origin().y);
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
    onEditorEvent(editor, "focus", () => focused.set(true)),
    onEditorEvent(editor, "blur", () => focused.set(false)),
  ];
  cleanup(() => {
    editor.unsubscribe(subscription);
    for (const off of offs) off();
    handlers.shortcut = null;
  });

  const at = (box: Box) => ({ origin: { x: origin().x + box.x, y: origin().y + box.y }, size: { width: Math.max(box.width, 1), height: box.height } });

  /** The document position at a point, or, past the text's end (below the last block), at the nearest line above it. */
  const nearestPos = (x: number, y: number) => {
    for (let up = 0; up <= 120; up += 8) {
      const pos = posAtCoords(editor, x, y - up);
      if (pos !== null) return pos;
    }
    return null;
  };

  /** Where the dragged block lands, and the line showing it: nsh-richtext decides the place. */
  const dropAt = (pageX: number, pageY: number) => {
    const source = dragging();
    if (source === null) return null;
    const target = nearestPos(pageX - origin().x, pageY - origin().y);
    if (target === null) return null;
    const found = dropTarget(editor, source, target);
    if (!found) return null;
    const box = blockRect(editor, found.target);
    const indent = box ? Math.max(box.x - 4, 0) : 0;
    return {
      source,
      target,
      line: box ? { x: indent, y: found.after ? box.y + box.height + 2 : box.y - 4, width: Math.max(hostWidth - indent, 1), height: 2 } : null,
    };
  };

  const previewDrop = (pageX: number, pageY: number) => {
    if (pressedAt && Math.hypot(pageX - pressedAt.x, pageY - pressedAt.y) <= DRAG_SLOP) return;
    dropLine.set(dropAt(pageX, pageY)?.line ?? null);
  };

  /** Where the grip was pressed: a release near it is a press, not a drag. */
  let pressedAt: { x: number; y: number } | null = null;

  const cancelDrag = () => {
    pressedAt = null;
    dragging.set(null);
    dropLine.set(null);
  };

  /** Drops the dragged block at the boundary shown by the insertion line. */
  const drop = (pageX: number, pageY: number) => {
    const source = dragging();
    const moved = !!pressedAt && Math.hypot(pageX - pressedAt.x, pageY - pressedAt.y) > DRAG_SLOP;
    const destination = moved ? dropAt(pageX, pageY) : null;
    cancelDrag();
    if (destination) editor.run(commands.moveBlock(destination.source, destination.target));
    // A press without a drag selects the whole block (Tiptap's drag handle): Delete, copy and cut act on it.
    else if (!moved && source !== null) editor.run(setNodeSelection(source - 1));
    editor.focus();
  };

  return (
    <View
      ref={(node: YNode) => (host = node)}
      class="relative flex-1"
      onLayout={() => void measure()}
      onHoverMove={(e) => hover(e.pagePosition.x, e.pagePosition.y)}
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
        bubbleMenu={
          <If when={slashQuery() === null && (bubble() !== null || table())}>
            <If when={bubble() !== null} else={<TableMenu editor={editor} />}>
              <BubbleMenu editor={editor} revision={props.revision} onLink={props.actions.openLink} />
            </If>
          </If>
        }
      />
      <If when={dropLine() !== null}>
        <View
          testID="block-drop-indicator"
          pointerEvents="none"
          class="absolute h-0.5 rounded bg-ring"
          style={{ left: dropLine()?.x ?? 0, top: dropLine()?.y ?? 0, width: dropLine()?.width ?? 0, zIndex: 10 }}
        />
      </If>
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
      <If when={(focused() || hovered() !== null || dragging() !== null) && handle() !== null && bubble() === null && !table() && slashQuery() === null}>
        {/* Anchored on the block's first line, centered on it, whatever the block's height. */}
        <Overlay anchor={at((handle() as { box: Box }).box)} placement="left" align="center" offset={handle()?.item ? ITEM_GUTTER : 6}>
          <View class="flex-row items-center gap-0.5">
            <If when={handle()?.empty}>
              <View
                testID="block-plus"
                tooltip="Insert a block"
                accessibilityLabel="Insert a block"
                role="button"
                onPress={() => {
                  editor.run(insertText("/"));
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
              onResponderGrant={(e) => {
                pressedAt = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                dragging.set(handle()?.pos ?? null);
                return true;
              }}
              onResponderMove={(e) => previewDrop(e.nativeEvent.pageX, e.nativeEvent.pageY)}
              onResponderRelease={(e) => drop(e.nativeEvent.pageX, e.nativeEvent.pageY)}
              onResponderTerminate={cancelDrag}
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
