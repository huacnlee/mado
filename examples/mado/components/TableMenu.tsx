import { View } from "nsh";
import type { RichEditorSession } from "nsh/base";
import { type TableCommand, commands } from "../editor/setup";
import type { IconName } from "./Icon";
import { IconButton, PANE, Separator } from "./ui";

const GROUPS: { value: TableCommand; label: string; icon: IconName }[][] = [
  [
    { value: "addRowBefore", label: "Add row above", icon: "between-horizontal-start" },
    { value: "addRowAfter", label: "Add row below", icon: "between-horizontal-end" },
    { value: "addColumnBefore", label: "Add column before", icon: "between-vertical-start" },
    { value: "addColumnAfter", label: "Add column after", icon: "between-vertical-end" },
  ],
  [
    { value: "toggleHeaderRow", label: "Header row", icon: "panel-top" },
    { value: "mergeOrSplit", label: "Merge or split cells", icon: "table-cells-merge" },
  ],
  [
    { value: "deleteRow", label: "Delete row", icon: "fold-vertical" },
    { value: "deleteColumn", label: "Delete column", icon: "fold-horizontal" },
    { value: "deleteTable", label: "Delete table", icon: "grid-2x2-x" },
  ],
];

/** The items, each group's first after a separator. */
const ITEMS = GROUPS.flatMap((group, g) => group.map((item, i) => ({ ...item, first: g > 0 && i === 0 })));

/** The rows, columns and cells of the table the caret is in (Tiptap's table bubble menu). */
export function TableMenu(props: { editor: RichEditorSession }) {
  return (
    <View testID="table-menu" class={`${PANE} flex-row items-center gap-0.5 p-1`}>
      <Each of={ITEMS}>
        {(item) => (
          <>
            <If when={item().first}>
              <Separator />
            </If>
            <IconButton
              size="small"
              icon={item().icon}
              label={item().label}
              onPress={() => {
                props.editor.run(commands.table(item().value));
                props.editor.focus();
              }}
            />
          </>
        )}
      </Each>
    </View>
  );
}
