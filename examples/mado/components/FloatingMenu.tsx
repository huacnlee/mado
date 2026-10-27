/**
 * Tiptap's FloatingMenu: on an empty line, the blocks it can become, one press each.
 */
import { View } from "nsh";
import type { RichCommand, RichEditorSession } from "nsh/base";
import { commands } from "../editor/setup";
import type { IconName } from "./Icon";
import { IconButton } from "./ui";

const ITEMS: { icon: IconName; label: string; command: () => RichCommand | null }[] = [
  { icon: "heading-1", label: "Heading 1", command: () => commands.block("h1") },
  { icon: "heading-2", label: "Heading 2", command: () => commands.block("h2") },
  { icon: "list", label: "Bullet list", command: () => commands.toggleList("bulletList") },
  { icon: "list-ordered", label: "Numbered list", command: () => commands.toggleList("orderedList") },
  { icon: "list-todo", label: "Task list", command: () => commands.toggleList("taskList") },
  { icon: "text-quote", label: "Quote", command: () => commands.toggleQuote() },
  { icon: "square-code", label: "Code block", command: () => commands.toggleBlock("codeBlock", true) },
];

export function FloatingMenu(props: { editor: RichEditorSession }) {
  return (
    <View testID="floating-menu" class="flex-row items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 shadow-sm">
      <Each of={ITEMS}>
        {(item) => (
          <IconButton
            size="small"
            icon={item().icon}
            label={item().label}
            onPress={() => {
              const command = item().command();
              if (command) props.editor.run(command);
              props.editor.focus();
            }}
          />
        )}
      </Each>
    </View>
  );
}
