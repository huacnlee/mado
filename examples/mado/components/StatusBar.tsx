import { Text, View } from "nsh";
import { readingMinutes } from "../editor/markdown";
import { BAR } from "./ui";

/** Words, characters and reading time, the file's state and what just happened. */
export function StatusBar(props: { words: number; characters: number; dirty: boolean; saving: boolean; path: string | null; status: string | null }) {
  const state = () => (props.saving ? "Saving…" : props.dirty ? (props.path ? "Edited" : "Not saved") : "Saved");
  return (
    <View testID="status-bar" class={`${BAR} h-8 flex-row items-center gap-4 border-t px-4`}>
      <Text testID="word-count" class="text-xs tabular-nums text-muted-foreground">
        {`${props.words} ${props.words === 1 ? "word" : "words"}`}
      </Text>
      <Text testID="char-count" class="text-xs tabular-nums text-muted-foreground">
        {`${props.characters} ${props.characters === 1 ? "character" : "characters"}`}
      </Text>
      <Text testID="reading-time" class="text-xs tabular-nums text-muted-foreground">
        {`${readingMinutes(props.words)} min read`}
      </Text>
      <View class="flex-1" />
      <Text numberOfLines={1} class="shrink text-xs text-muted-foreground">
        {props.status ?? ""}
      </Text>
      <View class="flex-row items-center gap-1.5">
        <View class={`size-1.5 rounded-full ${props.dirty ? "bg-brand" : "bg-muted-foreground/40"}`} />
        <Text testID="save-state" class="text-xs text-muted-foreground">
          {state()}
        </Text>
      </View>
    </View>
  );
}
