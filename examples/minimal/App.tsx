// The smallest app on nsh-richtext: an editor made with the kit's one
// extension, a toolbar of its named commands, and the document as Markdown.
import { Text, View, mount, signal } from "nsh";
import { RichEditor, type RichCommand, type RichNodeJSON, command, createRichEditor, richExtension, toggleMark, undo, redo } from "nsh/base";
import { RichText } from "nsh-richtext";

const editor = createRichEditor({
  extensions: [richExtension("richTextKit")],
  content: RichText.fromMarkdown("# Notes\n\nSome ==highlighted== text.\n\n- one\n- two\n") as RichNodeJSON,
});

const BUTTONS: [string, () => RichCommand][] = [
  ["H1", () => command("setBlockStyle", { style: "h1" })],
  ["Text", () => command("setBlockStyle", { style: "paragraph" })],
  ["Bold", () => toggleMark("bold")],
  ["List", () => command("toggleListType", { list: "bulletList" })],
  ["Tasks", () => command("toggleListType", { list: "taskList" })],
  ["Quote", () => command("toggleQuote")],
  ["Up", () => command("moveBlockUp")],
  ["Down", () => command("moveBlockDown")],
  ["Undo", () => undo()],
  ["Redo", () => redo()],
];

function App() {
  const markdown = signal(RichText.toMarkdown(editor.doc));
  editor.subscribe(() => markdown.set(RichText.toMarkdown(editor.doc)));
  return (
    <View class="flex-1 gap-3 bg-background p-4">
      <View class="flex-row flex-wrap gap-1">
        <Each of={BUTTONS}>
          {(button) => (
            <View
              role="button"
              accessibilityLabel={button()[0]}
              onPress={() => {
                editor.run(button()[1]());
                editor.focus();
              }}
              class="rounded-md border border-border px-2 py-1"
            >
              <Text class="text-sm text-foreground">{button()[0]}</Text>
            </View>
          )}
        </Each>
      </View>
      <RichEditor editor={editor} testID="editor" class="flex-1 rounded-lg border border-border p-3" />
      <Text testID="markdown" class="font-mono text-xs text-muted-foreground">
        {markdown()}
      </Text>
      <Text class="text-xs text-muted-foreground">{`${RichText.countWords(editor.getText())} words`}</Text>
    </View>
  );
}

mount(App);
