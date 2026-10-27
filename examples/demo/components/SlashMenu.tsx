import { Scroll, Text, View, effect, type YNode } from "nsh";
import { Button } from "nsh/base";
import type { SlashItem } from "../editor/setup";
import { Icon } from "./Icon";
import { PANE, STATE } from "./ui";

/** The block menu `/` opens (Tiptap's slash commands): the items matching what follows the slash, each with the Markdown that makes it as you type; the highlighted one first to Enter. */
export function SlashMenu(props: { items: SlashItem[]; highlighted: number; onPick: (item: SlashItem) => void; onHover: (index: number) => void }) {
  // The arrow keys move the highlight past what shows: the list scrolls to keep it in view.
  const ROW = 38;
  const VISIBLE = 300;
  let list: YNode | null = null;
  let top = 0;
  effect(() => {
    const row = props.highlighted * ROW;
    if (row < top) top = row;
    else if (row + ROW > top + VISIBLE) top = row + ROW - VISIBLE;
    else return;
    list?.scrollTo({ y: top, animated: false });
  });
  return (
    <View testID="slash-menu" class={`${PANE} max-h-80 w-72 p-1.5`}>
      <If when={props.items.length > 0} else={<Text class="px-2 py-2 text-sm text-muted-foreground">No matching blocks</Text>}>
        <Scroll ref={(node: YNode) => (list = node)} class="shrink" contentClass="gap-0.5">
        <Each of={props.items}>
          {(item, i) => (
            <Button
              accessibilityLabel={item().label}
              selected={i() === props.highlighted}
              onPress={() => props.onPick(item())}
              onPressDown={() => props.onHover(i())}
              class={`h-9 flex-row items-center gap-3 rounded-lg px-2.5 hover:bg-accent ${i() === props.highlighted ? STATE : ""}`}
            >
              <Icon name={item().icon} size={18} />
              <Text class="flex-1 text-sm text-foreground">{item().label}</Text>
              <If when={item().markdown}>
                <Text class="font-mono text-xs text-muted-foreground">{item().markdown}</Text>
              </If>
            </Button>
          )}
        </Each>
        </Scroll>
      </If>
    </View>
  );
}
