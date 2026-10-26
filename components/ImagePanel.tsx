import { signal, View } from "nsh";
import type { RichEditorSession } from "nsh/base";
import * as path from "path";
import { commands } from "../editor/setup";
import { Field, Label, TextButton } from "./ui";

/** Inserts an image by URL or by a path relative to the document (Markdown's `![alt](src)`). */
export function ImagePanel(props: { editor: RichEditorSession; onClose: () => void }) {
  const src = signal("");
  const alt = signal("");
  const insert = () => {
    const value = src().trim();
    if (!value) return;
    const command = commands.image(value, alt().trim() || path.basename(value));
    if (command) props.editor.run(command);
    props.onClose();
    props.editor.focus();
  };
  return (
    <View testID="image-panel" class="w-80 gap-3 p-3">
      <Label>Image</Label>
      <Field testID="image-src" value={src()} placeholder="https://… or images/photo.png" autoFocus onChange={(v) => src.set(v)} onSubmit={insert} />
      <Field testID="image-alt" value={alt()} placeholder="Description (alt text)" onChange={(v) => alt.set(v)} onSubmit={insert} />
      <View class="flex-row justify-end">
        <TextButton testID="image-insert" variant="primary" label="Insert image" disabled={!src().trim()} onPress={insert} />
      </View>
    </View>
  );
}
