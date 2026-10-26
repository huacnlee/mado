// The formatting toolbar, as Tiptap's simple editor lays it out: undo and
// redo, the block type, lists and quote, code block, then the marks, link,
// highlight, sub- and superscript, alignment, and inserts.
import { Text, View, token } from "nsh";
import { Menu, MenuItem, Popover, type RichCommand, type RichEditorSession } from "nsh/base";
import { keymap } from "nsh";
import {
  type Align,
  type BlockKey,
  type ListKey,
  type MarkKey,
  MARK,
  NODE,
  activeAlign,
  activeBlock,
  activeLists,
  activeMarks,
  commands,
} from "../editor/setup";
import { Icon, type IconName } from "./Icon";
import { ImagePanel } from "./ImagePanel";
import { LinkPanel } from "./LinkPanel";
import { IconButton, PANE, Separator, STATE } from "./ui";

const BLOCKS: { value: BlockKey; label: string; icon: IconName; keys: string }[] = [
  { value: "paragraph", label: "Text", icon: "pilcrow", keys: "mod+alt+0" },
  { value: "h1", label: "Heading 1", icon: "heading-1", keys: "mod+alt+1" },
  { value: "h2", label: "Heading 2", icon: "heading-2", keys: "mod+alt+2" },
  { value: "h3", label: "Heading 3", icon: "heading-3", keys: "mod+alt+3" },
  { value: "h4", label: "Heading 4", icon: "heading-4", keys: "mod+alt+4" },
];

const MARKS: { value: MarkKey; label: string; icon: IconName; keys: string }[] = [
  { value: "bold", label: "Bold", icon: "bold", keys: "mod+b" },
  { value: "italic", label: "Italic", icon: "italic", keys: "mod+i" },
  { value: "strike", label: "Strikethrough", icon: "strikethrough", keys: "mod+shift+s" },
  { value: "code", label: "Inline code", icon: "code", keys: "mod+e" },
  { value: "underline", label: "Underline", icon: "underline", keys: "mod+u" },
];

const EXTRA_MARKS: { value: MarkKey; label: string; icon: IconName; keys: string }[] = [
  { value: "highlight", label: "Highlight", icon: "highlighter", keys: "mod+shift+h" },
  { value: "superscript", label: "Superscript", icon: "superscript", keys: "mod+." },
  { value: "subscript", label: "Subscript", icon: "subscript", keys: "mod+," },
];

const LISTS: { value: ListKey; label: string; icon: IconName; keys: string }[] = [
  { value: "bulletList", label: "Bulleted list", icon: "list", keys: "mod+shift+8" },
  { value: "orderedList", label: "Numbered list", icon: "list-ordered", keys: "mod+shift+7" },
  { value: "taskList", label: "Task list", icon: "list-todo", keys: "mod+shift+9" },
];

const ALIGNS: { value: Align; label: string; icon: IconName; keys: string }[] = [
  { value: "left", label: "Align left", icon: "text-align-start", keys: "mod+shift+l" },
  { value: "center", label: "Align center", icon: "text-align-center", keys: "mod+shift+e" },
  { value: "right", label: "Align right", icon: "text-align-end", keys: "mod+shift+r" },
  { value: "justify", label: "Justify", icon: "text-align-justify", keys: "mod+shift+j" },
];

/** A keystroke as this platform writes it (`⌘B`, `Ctrl+B`). */
export function hint(keys: string): string {
  try {
    return keymap.label(keys);
  } catch {
    return "";
  }
}

export interface ToolbarState {
  linkOpen: boolean;
  imageOpen: boolean;
  setLinkOpen: (open: boolean) => void;
  setImageOpen: (open: boolean) => void;
}

export function Toolbar(props: { editor: RichEditorSession; revision: number; panels: ToolbarState; compact: boolean }) {
  const editor = () => props.editor;
  // Read on every change of the session.
  const state = <T,>(read: (e: RichEditorSession) => T) => () => {
    void props.revision;
    return read(editor());
  };
  const can = (command: RichCommand | null) => {
    void props.revision;
    return command !== null && editor().can(command);
  };
  const run = (command: RichCommand | null) => {
    if (command) editor().run(command);
    editor().focus();
  };
  const marks = state(activeMarks);
  const block = state(activeBlock);
  const lists = state(activeLists);
  const align = state(activeAlign);
  const quoted = state((e) => e.isActive(NODE.blockquote));
  const blockItem = () => BLOCKS.find((b) => b.value === block()) ?? BLOCKS[0];

  return (
    <View testID="toolbar" class="flex-row flex-wrap items-center gap-0.5">
      <IconButton icon="undo-2" label="Undo" shortcut={hint("mod+z")} disabled={!can(commands.undo())} onPress={() => run(commands.undo())} />
      <IconButton icon="redo-2" label="Redo" shortcut={hint("mod+shift+z")} disabled={!can(commands.redo())} onPress={() => run(commands.redo())} />
      <Separator />
      <Menu
        placement="bottom"
        popupClass={`${PANE} p-1 min-w-48`}
        trigger={
          <View
            tooltip="Text style"
            accessibilityLabel="Text style"
            role="button"
            testID="block-menu"
            class="h-8 flex-row items-center gap-1 rounded-(--radius-control) px-2 hover:bg-accent"
          >
            <Icon name={blockItem().icon} size={16} />
            <If when={!props.compact}>
              <Text class="text-sm text-foreground">{blockItem().label}</Text>
            </If>
            <Icon name="chevron-down" size={12} tint={token("muted-foreground")} />
          </View>
        }
      >
        <Each of={BLOCKS}>
          {(item) => (
            <MenuItem
              accessibilityLabel={item().label}
              onSelect={() => run(commands.block(item().value))}
              class={`flex-row items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent ${block() === item().value ? STATE : ""}`}
            >
              <Icon name={item().icon} size={16} />
              <Text class="flex-1 text-sm text-foreground">{item().label}</Text>
              <Text class="text-xs text-muted-foreground">{hint(item().keys)}</Text>
            </MenuItem>
          )}
        </Each>
      </Menu>
      <Each of={LISTS}>
        {(item) => (
          <IconButton
            icon={item().icon}
            label={item().label}
            shortcut={hint(item().keys)}
            active={lists().includes(item().value)}
            disabled={!can(commands.toggleList(item().value, lists()))}
            onPress={() => run(commands.toggleList(item().value, lists()))}
          />
        )}
      </Each>
      <IconButton
        icon="text-quote"
        label="Quote"
        shortcut={hint("mod+shift+b")}
        active={quoted()}
        disabled={!can(commands.toggleQuote(quoted()))}
        onPress={() => run(commands.toggleQuote(quoted()))}
      />
      <IconButton
        icon="square-code"
        label="Code block"
        shortcut={hint("mod+alt+c")}
        active={block() === "codeBlock"}
        disabled={!can(commands.toggleBlock("codeBlock", block() !== "codeBlock"))}
        onPress={() => run(commands.toggleBlock("codeBlock", block() !== "codeBlock"))}
      />
      <Separator />
      <Each of={MARKS}>
        {(item) => (
          <IconButton
            icon={item().icon}
            label={item().label}
            shortcut={hint(item().keys)}
            active={marks().includes(item().value)}
            disabled={!can(commands.mark(item().value))}
            onPress={() => run(commands.mark(item().value))}
          />
        )}
      </Each>
      <Popover
        open={props.panels.linkOpen}
        onOpenChange={(open) => props.panels.setLinkOpen(open)}
        placement="bottom"
        popupClass={PANE}
        trigger={
          <View tooltip={`Link  ${hint("mod+k")}`} testID="link-button" accessibilityLabel="Link" role="button" class={`size-8 items-center justify-center rounded-(--radius-control) hover:bg-accent ${marks().includes("link") ? STATE : ""}`}>
            <Icon name="link" size={16} tint={marks().includes("link") ? token("brand") : token("foreground")} />
          </View>
        }
      >
        <LinkPanel editor={editor()} onClose={() => props.panels.setLinkOpen(false)} />
      </Popover>
      <Each of={EXTRA_MARKS}>
        {(item) => (
          <IconButton
            icon={item().icon}
            label={item().label}
            shortcut={hint(item().keys)}
            active={marks().includes(item().value)}
            disabled={!can(commands.mark(item().value))}
            onPress={() => run(commands.mark(item().value))}
          />
        )}
      </Each>
      <Separator />
      <Each of={ALIGNS}>
        {(item) => (
          <IconButton
            icon={item().icon}
            label={item().label}
            shortcut={hint(item().keys)}
            active={align() === item().value}
            onPress={() => run(commands.align(item().value))}
          />
        )}
      </Each>
      <Separator />
      <IconButton icon="minus" label="Divider" disabled={!can(commands.horizontalRule())} onPress={() => run(commands.horizontalRule())} />
      <Popover
        open={props.panels.imageOpen}
        onOpenChange={(open) => props.panels.setImageOpen(open)}
        placement="bottom"
        popupClass={PANE}
        trigger={
          <View tooltip="Image" testID="image-button" accessibilityLabel="Image" role="button" class="size-8 items-center justify-center rounded-(--radius-control) hover:bg-accent">
            <Icon name="image" size={16} />
          </View>
        }
      >
        <ImagePanel editor={editor()} onClose={() => props.panels.setImageOpen(false)} />
      </Popover>
      <IconButton icon="list-indent-decrease" label="Outdent" shortcut={hint("shift+tab")} disabled={!can(commands.outdent())} onPress={() => run(commands.outdent())} />
      <IconButton icon="list-indent-increase" label="Indent" shortcut={hint("tab")} disabled={!can(commands.indent())} onPress={() => run(commands.indent())} />
    </View>
  );
}
