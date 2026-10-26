import { View } from "nsh";
import type { RichCommand, RichEditorSession } from "nsh/base";
import { type MarkKey, MARK, activeMarks, commands } from "../editor/setup";
import type { IconName } from "./Icon";
import { IconButton, PANE, Separator } from "./ui";
import { hint } from "./Toolbar";

const ITEMS: { value: MarkKey; label: string; icon: IconName; keys: string }[] = [
  { value: "bold", label: "Bold", icon: "bold", keys: "mod+b" },
  { value: "italic", label: "Italic", icon: "italic", keys: "mod+i" },
  { value: "underline", label: "Underline", icon: "underline", keys: "mod+u" },
  { value: "strike", label: "Strikethrough", icon: "strikethrough", keys: "mod+shift+s" },
  { value: "code", label: "Inline code", icon: "code", keys: "mod+e" },
  { value: "highlight", label: "Highlight", icon: "highlighter", keys: "mod+shift+h" },
];

/** The marks and the link of the selected text, over the selection (Tiptap's bubble menu). */
export function BubbleMenu(props: { editor: RichEditorSession; revision: number; onLink: () => void }) {
  const marks = () => {
    void props.revision;
    return activeMarks(props.editor);
  };
  const run = (command: RichCommand | null) => {
    if (command) props.editor.run(command);
  };
  return (
    <View testID="bubble-menu" class={`${PANE} flex-row items-center gap-0.5 p-1`}>
      <Each of={ITEMS}>
        {(item) => (
          <IconButton
            size="small"
            icon={item().icon}
            label={item().label}
            shortcut={hint(item().keys)}
            active={marks().includes(item().value)}
            onPress={() => run(commands.mark(item().value))}
          />
        )}
      </Each>
      <Separator />
      <IconButton size="small" icon="link" label="Edit link" shortcut={hint("mod+k")} active={marks().includes("link")} onPress={props.onLink} />
    </View>
  );
}
