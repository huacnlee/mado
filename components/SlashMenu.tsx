import { Text, View } from "nsh";
import { Button } from "nsh/base";
import type { SlashItem } from "../editor/setup";
import { Icon } from "./Icon";
import { PANE, STATE } from "./ui";

/** The block menu `/` opens (Tiptap's slash commands): the items matching what follows the slash, the highlighted one first to Enter. */
export function SlashMenu(props: { items: SlashItem[]; highlighted: number; onPick: (item: SlashItem) => void; onHover: (index: number) => void }) {
  return (
    <View testID="slash-menu" class={`${PANE} w-72 gap-0.5 p-1`}>
      <Text class="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">Blocks</Text>
      <If when={props.items.length > 0} else={<Text class="px-2 py-2 text-sm text-muted-foreground">No matching blocks</Text>}>
        <Each of={props.items}>
          {(item, i) => (
            <Button
              accessibilityLabel={item().label}
              selected={i() === props.highlighted}
              onPress={() => props.onPick(item())}
              onPressDown={() => props.onHover(i())}
              class={`flex-row items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-accent ${i() === props.highlighted ? STATE : ""}`}
            >
              <View class="size-8 items-center justify-center rounded-lg border border-border bg-field">
                <Icon name={item().icon} size={16} />
              </View>
              <View class="flex-1">
                <Text class="text-sm font-medium text-foreground">{item().label}</Text>
                <Text class="text-xs text-muted-foreground">{item().hint}</Text>
              </View>
            </Button>
          )}
        </Each>
      </If>
    </View>
  );
}
