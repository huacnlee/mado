import { View } from "nsh";
import { Editor } from "nsh/base";

/** The document's Markdown, in `nsh/base`'s code editor with Markdown highlighting. */
export function SourceEditor(props: { value: string; onChange: (text: string) => void }) {
  return (
    <View class="flex-1 rounded-2xl border border-border bg-card px-2 py-2">
      <Editor
        testID="source-editor"
        accessibilityLabel="Markdown source"
        language="markdown"
        value={props.value}
        onChange={props.onChange}
        softWrap
        lineNumbers={false}
        activeLine={false}
        autoFocus
        fontSize={14}
        lineHeight={22}
        class="flex-1"
      />
    </View>
  );
}
