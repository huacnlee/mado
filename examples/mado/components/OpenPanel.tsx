// Opening a file: a path to type (or paste), the Markdown files of Mado's
// folder, and the recent files.
import { Scroll, Text, View, resource, signal, token } from "nsh";
import { Button } from "nsh/base";
import * as path from "path";
import { displayPath, expandPath } from "../store/files";
import { filesBackend, folder } from "../store/document";
import { settings, updateSettings } from "../store/settings";
import { Icon } from "./Icon";
import { Field, Label, TextButton } from "./ui";

function FileRow(props: { file: string; current: boolean; onOpen: (file: string) => void }) {
  return (
    <Button
      accessibilityLabel={path.basename(props.file)}
      selected={props.current}
      onPress={() => props.onOpen(props.file)}
      class={`flex-row items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-accent ${props.current ? "bg-accent" : ""}`}
    >
      <Icon name="file-text" size={15} tint={props.current ? token("brand") : token("muted-foreground")} />
      <View class="flex-1">
        <Text class="line-clamp-1 text-sm text-foreground">
          {path.basename(props.file)}
        </Text>
        <Text class="line-clamp-1 text-xs text-muted-foreground">
          {displayPath(path.dirname(props.file))}
        </Text>
      </View>
    </Button>
  );
}

export function OpenPanel(props: { current: string | null; onOpen: (file: string) => void; onNew: (name: string) => void }) {
  const typed = signal("");
  const newName = signal("");
  const folderInput = signal(settings().folder);
  const listing = resource(
    () => `${settings().backend}:${folder()}`,
    async () => {
      try {
        return { files: await filesBackend().list(folder()), error: null as string | null };
      } catch (e) {
        const code = (e as { code?: string }).code;
        return { files: [] as string[], error: code === "ENOENT" ? null : String((e as Error).message ?? e) };
      }
    },
  );
  const open = () => {
    if (typed().trim()) props.onOpen(expandPath(typed()));
  };
  return (
    <View testID="open-panel" class="w-96 max-h-[560px] gap-3 p-3">
      <Label>Open a file</Label>
      <View class="flex-row items-center gap-2">
        <View class="flex-1">
          <Field testID="open-path" value={typed()} placeholder="~/Documents/notes.md" autoFocus onChange={(v) => typed.set(v)} onSubmit={open} />
        </View>
        <TextButton testID="open-submit" label="Open" variant="primary" disabled={!typed().trim()} onPress={open} />
      </View>
      <Scroll class="max-h-[380px]" contentClass="gap-3">
        <If when={settings().recent.length > 0}>
          <View class="gap-0.5">
            <Label>Recent</Label>
            <Each of={settings().recent}>{(file) => <FileRow file={file()} current={file() === props.current} onOpen={props.onOpen} />}</Each>
          </View>
        </If>
        <View class="gap-0.5">
          <Label>{`In ${displayPath(folder())}`}</Label>
          <If when={listing()?.error}>
            <Text class="px-2 text-xs text-destructive">{listing()?.error ?? ""}</Text>
          </If>
          <If when={(listing()?.files.length ?? 0) > 0} else={<Text class="px-2 py-1 text-sm text-muted-foreground">No Markdown files yet</Text>}>
            <Each of={listing()?.files ?? []}>{(file) => <FileRow file={file()} current={file() === props.current} onOpen={props.onOpen} />}</Each>
          </If>
        </View>
      </Scroll>
      <View class="h-px bg-border" />
      <Label>New file</Label>
      <View class="flex-row items-center gap-2">
        <View class="flex-1">
          <Field testID="new-name" value={newName()} placeholder="Name (Untitled.md)" onChange={(v) => newName.set(v)} onSubmit={() => props.onNew(newName())} />
        </View>
        <TextButton testID="new-submit" label="Create" icon="file-plus" onPress={() => props.onNew(newName())} />
      </View>
      <Label>Folder</Label>
      <View class="flex-row items-center gap-2">
        <View class="flex-1">
          <Field testID="folder-path" value={folderInput()} placeholder={displayPath(folder())} onChange={(v) => folderInput.set(v)} onSubmit={() => updateSettings({ folder: folderInput().trim() ? expandPath(folderInput()) : "" })} />
        </View>
        <TextButton label="Use" onPress={() => updateSettings({ folder: folderInput().trim() ? expandPath(folderInput()) : "" })} />
      </View>
    </View>
  );
}
