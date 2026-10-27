import { signal, Text, View } from "nsh";
import type { RichEditorSession } from "nsh/base";
import { openUrl } from "nsh";
import { commands, linkHref } from "../editor/setup";
import { Field, IconButton, Label, TextButton } from "./ui";

/** Adds `https://` to an address typed without a scheme, as Tiptap's link popover does. */
export function normalizeHref(href: string): string {
  const text = href.trim();
  if (!text || /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("#") || text.startsWith("/")) return text;
  return `https://${text}`;
}

/** The link editor (Tiptap's link popover): the address of the link at the selection, to apply, open or remove. */
export function LinkPanel(props: { editor: RichEditorSession; onClose: () => void }) {
  const editor = props.editor;
  const current = linkHref(editor);
  const href = signal(current);
  const label = signal("");
  const selection = editor.selection;
  const empty = selection.anchor === selection.head && !current;
  const run = (command: ReturnType<typeof commands.unsetLink>) => {
    if (command) editor.run(command);
    props.onClose();
    editor.focus();
  };
  const apply = () => {
    const value = normalizeHref(href());
    if (!value) return run(commands.unsetLink());
    run(commands.setLink(editor, value, label()));
  };
  return (
    <View testID="link-panel" class="w-80 gap-3 p-3">
      <Label>Link</Label>
      <Field testID="link-href" value={href()} placeholder="Paste a link…" autoFocus onChange={(v) => href.set(v)} onSubmit={apply} />
      <If when={empty}>
        <Field testID="link-text" value={label()} placeholder="Text to show (optional)" onChange={(v) => label.set(v)} onSubmit={apply} />
      </If>
      <View class="flex-row items-center gap-1">
        <TextButton testID="link-apply" variant="primary" label={current ? "Update" : "Add link"} disabled={!href().trim()} onPress={apply} />
        <View class="flex-1" />
        <If when={current}>
          <IconButton icon="external-link" label="Open link" onPress={() => void openUrl(current)} />
          <IconButton testID="link-remove" icon="unlink" label="Remove link" onPress={() => run(commands.unsetLink())} />
        </If>
      </View>
      <If when={current}>
        <Text class="line-clamp-1 text-xs text-muted-foreground">
          {current}
        </Text>
      </If>
    </View>
  );
}
