// The bar under a link the caret is in (allsum's and Notion's link toolbar): its address, copy, open, edit and
// remove; Edit turns it into the address field with Apply.
import { Button, Input } from "nsh/base";
import { Clipboard, signal, Text, token, View } from "nsh";
import { openUrl } from "nsh";
import type { RichEditorSession } from "nsh/base";
import { commands } from "../editor/setup";
import { Icon } from "./Icon";
import { IconButton } from "./ui";
import { normalizeHref } from "./LinkPanel";

function Action(props: { label: string; testID: string; onPress: () => void }) {
  return (
    <Button testID={props.testID} accessibilityLabel={props.label} onPress={props.onPress} class="h-7 justify-center rounded-md px-2 hover:bg-accent active:bg-accent">
      <Text class="text-sm text-foreground">{props.label}</Text>
    </Button>
  );
}

/** `editing`: the bar's field has the focus away from the editor, so the bar stays while it does. */
export function LinkBar(props: { editor: RichEditorSession; href: string; editing: { (): boolean; set(v: boolean): void } }) {
  const editing = props.editing;
  const draft = signal(props.href);
  const run = (command: ReturnType<typeof commands.unsetLink>) => {
    if (command) props.editor.run(command);
    editing.set(false);
    props.editor.focus();
  };
  const apply = () => {
    const value = normalizeHref(draft());
    run(value ? commands.setLink(props.editor, value) : commands.unsetLink());
  };
  return (
    <View testID="link-bar" class="self-start rounded-xl border border-border bg-popover p-1 shadow-md">
      <If
        when={editing()}
        else={
          <View class="flex-row items-center gap-1">
            <View class="max-w-64 flex-row items-center gap-1.5 px-2">
              <Icon name="link" size={14} tint={token("muted-foreground")} />
              <Text testID="link-bar-href" class="shrink text-sm text-blue-500 line-clamp-1">
                {props.href}
              </Text>
            </View>
            <IconButton testID="link-copy" icon="copy" label="Copy link" size="small" onPress={() => void Clipboard.writeText(props.href)} />
            <View class="mx-1 h-4 w-px bg-border" />
            <Action testID="link-open" label="Open" onPress={() => void openUrl(props.href)} />
            <Action testID="link-edit" label="Edit" onPress={() => { draft.set(props.href); editing.set(true); }} />
            <Action testID="link-bar-remove" label="Remove" onPress={() => run(commands.unsetLink())} />
          </View>
        }
      >
        <View class="w-96 flex-row items-center gap-2">
          <Input
            testID="link-bar-input"
            value={draft()}
            autoFocus
            placeholder="Paste or type a link"
            autoCapitalize="none"
            autoCorrect={false}
            onChange={(v: string) => draft.set(v)}
            onSubmit={apply}
            class="h-9 flex-1 rounded-lg border border-ring bg-field px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <Button testID="link-apply-bar" accessibilityLabel="Apply" onPress={apply} class="h-9 justify-center rounded-lg bg-primary px-4 active:opacity-90">
            <Text class="text-sm font-medium text-primary-foreground">Apply</Text>
          </Button>
        </View>
      </If>
    </View>
  );
}
