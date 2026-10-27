// The menu a column's or row's grip opens (allsum's): insert on either side, clear, move, delete.
import { Text, token, View } from "nsh";
import { Button, type RichCommand, type RichEditorSession } from "nsh/base";
import type { CellRange } from "nsh-richtext";
import { commands } from "../editor/setup";
import { Icon, type IconName } from "./Icon";
import { PANE } from "./ui";

type Item = { id: string; label: string; icon: IconName; run: () => RichCommand | null; disabled?: boolean; danger?: boolean; first?: boolean };

function items(range: CellRange): Item[] {
  const column = range.kind === "column";
  const last = (column ? range.columns : range.rows) - 1;
  const move = (to: number) => (column ? commands.moveColumn(range.table, range.from, to) : commands.moveRow(range.table, range.from, to));
  const one = range.to - range.from === 1;
  return column
    ? [
        { id: "insert-left", label: "Insert column left", icon: "column-insert-left", run: () => commands.table("addColumnBefore") },
        { id: "insert-right", label: "Insert column right", icon: "column-insert-right", run: () => commands.table("addColumnAfter") },
        { id: "clear", label: "Clear contents", icon: "eraser", run: () => commands.clearCells() },
        { id: "move-left", label: "Move left", icon: "arrow-left", run: () => move(range.from - 1), disabled: !one || range.from === 0, first: true },
        { id: "move-right", label: "Move right", icon: "arrow-right", run: () => move(range.from + 1), disabled: !one || range.from === last },
        { id: "delete", label: "Delete column", icon: "trash-2", run: () => commands.table("deleteColumn"), danger: true, first: true },
      ]
    : [
        { id: "insert-above", label: "Insert row above", icon: "row-insert-above", run: () => commands.table("addRowBefore") },
        { id: "insert-below", label: "Insert row below", icon: "row-insert-below", run: () => commands.table("addRowAfter") },
        { id: "clear", label: "Clear contents", icon: "eraser", run: () => commands.clearCells() },
        { id: "move-up", label: "Move up", icon: "arrow-up", run: () => move(range.from - 1), disabled: !one || range.from === 0, first: true },
        { id: "move-down", label: "Move down", icon: "arrow-down", run: () => move(range.from + 1), disabled: !one || range.from === last },
        { id: "delete", label: "Delete row", icon: "trash-2", run: () => commands.table("deleteRow"), danger: true, first: true },
      ];
}

export function AxisMenu(props: { editor: RichEditorSession; range: CellRange }) {
  return (
    <View testID={`${props.range.kind}-menu`} class={`${PANE} w-60 p-1.5`}>
      <Each of={items(props.range)}>
        {(item) => (
          <>
            <If when={item().first}>
              <View class="mx-2 my-1 h-px bg-border" />
            </If>
            <Button
              testID={`axis-${item().id}`}
              accessibilityLabel={item().label}
              disabled={item().disabled}
              onPress={() => {
                const command = item().run();
                if (command) props.editor.run(command);
                props.editor.focus();
              }}
              class="h-9 flex-row items-center gap-3 rounded-lg px-2.5 hover:bg-accent active:bg-accent disabled:opacity-40"
            >
              <Icon name={item().icon} size={17} tint={token(item().danger ? "destructive" : "foreground")} />
              <Text class={`text-sm ${item().danger ? "text-destructive" : "text-foreground"}`}>{item().label}</Text>
            </Button>
          </>
        )}
      </Each>
    </View>
  );
}
