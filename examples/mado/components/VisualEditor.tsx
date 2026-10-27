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
} from "../editor/setup";
import { insertText } from "nsh/base";
import { BubbleMenu } from "./BubbleMenu";
import { Icon } from "./Icon";
import { SlashMenu } from "./SlashMenu";

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
  const { editor, slash, handlers } = props.mado;
  let host: YNode | null = null;
  const origin = signal({ x: 0, y: 0 });
  const slashQuery = signal<{ text: string; from: number; to: number } | null>(null);
  const highlighted = signal(0);
  const bubble = signal<Box | null>(null);
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

  const closeSlash = () => {
    slashQuery.set(null);
    slash.capturing = false;
  };

  const pick = (item: SlashItem) => {
    const q = slashQuery();
    if (!q) return;
    closeSlash();
    editor.run(commands.fromSlash(q.from, q.to, item));
    if (item.id === "image") props.actions.openImage();
    editor.focus();
  };

  handlers.slash = (key) => {
    const count = matches().length;
    if (key === "ArrowDown") highlighted.set((highlighted() + 1) % Math.max(count, 1));
    else if (key === "ArrowUp") highlighted.set((highlighted() + count - 1) % Math.max(count, 1));
    else if ((key === "Enter" || key === "Tab") && count > 0) pick(matches()[highlighted()]);
    else closeSlash();
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

    // `/` typed at the start of a textblock, and what follows it up to the caret.
    const before = block && empty && block.type !== NODE.codeBlock ? block.text.slice(0, head - block.from) : "";
    const found = /^\/([\p{L}\p{N} ]{0,24})$/u.exec(before);
    if (found && block) {
      const opening = slashQuery() === null;
      slashQuery.set({ text: found[1], from: block.from, to: head });
      if (opening) highlighted.set(0);
      else highlighted.set(Math.min(highlighted(), Math.max(matches().length - 1, 0)));
      slash.capturing = true;
    } else {
      closeSlash();
    }

    void measure();
    bubble.set(!empty && selection.type === "text" ? selectionRect(editor) : null);
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
    handle.set({ box: line, empty, pos: target.from + 1, item: target.depth > 1 });
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
    onEditorEvent(editor, "selectionUpdate", follow),
    onEditorEvent(editor, "focus", () => focused.set(true)),
    onEditorEvent(editor, "blur", () => focused.set(false)),
  ];
  cleanup(() => {
    editor.unsubscribe(subscription);
    for (const off of offs) off();
    handlers.shortcut = null;
    handlers.slash = null;
    slash.capturing = false;
  });

  const at = (box: Box) => ({ origin: { x: origin().x + box.x, y: origin().y + box.y }, size: { width: Math.max(box.width, 1), height: box.height } });

  /** Where the dragged block lands, and the line showing it: nsh-richtext decides the place. */
  const dropAt = (pageX: number, pageY: number) => {
    const source = dragging();
    if (source === null) return null;
    const target = posAtCoords(editor, pageX - origin().x, pageY - origin().y);
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
    dropLine.set(dropAt(pageX, pageY)?.line ?? null);
  };

  const cancelDrag = () => {
    dragging.set(null);
    dropLine.set(null);
  };

  /** Drops the dragged block at the boundary shown by the insertion line. */
  const drop = (pageX: number, pageY: number) => {
    const destination = dropAt(pageX, pageY);
    cancelDrag();
    if (destination) editor.run(commands.moveBlock(destination.source, destination.target));
    editor.focus();
  };

  return (
    <View
      ref={(node: YNode) => (host = node)}
      class="relative flex-1"
      onLayout={() => void measure()}
      onHoverMove={(e) => hover(e.pagePosition.x, e.pagePosition.y)}
      onHoverOut={() => {
        hovered.set(null);
        follow();
      }}
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
      <If when={bubble() !== null && slashQuery() === null}>
        <Overlay anchor={at(bubble() as Box)} placement="top" offset={8}>
          <BubbleMenu editor={editor} revision={props.revision} onLink={props.actions.openLink} />
        </Overlay>
      </If>
      <If when={(focused() || hovered() !== null || dragging() !== null) && handle() !== null && bubble() === null && slashQuery() === null}>
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
              onResponderGrant={() => {
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
