// The window's only chrome: open, the document's name (press to rename) with
// its edited dot, the Visual / Source switch, save, delete and the
// appearance.
import { Text, View, signal, token } from "nsh";
import { Button, Popover } from "nsh/base";
import * as path from "path";
import type { Appearance, Mode } from "../store/settings";
import { Icon } from "./Icon";
import { OpenPanel } from "./OpenPanel";
import { hint } from "./Toolbar";
import { BAR, Field, IconButton, PANE, TextButton } from "./ui";

export interface TopBarProps {
  title: string;
  file: string | null;
  dirty: boolean;
  mode: Mode;
  appearance: Appearance;
  openOpen: boolean;
  setOpenOpen: (open: boolean) => void;
  onOpen: (file: string) => void;
  /** Asks for a file with the system's open dialog. */
  onOpenDialog: () => void;
  onNew: (name: string) => void;
  onSave: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMode: (mode: Mode) => void;
  onAppearance: (appearance: Appearance) => void;
  /** Room on the left for the window's own controls. */
  inset: number;
}

const NEXT_APPEARANCE: Record<Appearance, Appearance> = { dark: "light", light: "system", system: "dark" };

export function TopBar(props: TopBarProps) {
  const renaming = signal(false);
  const name = signal("");
  const confirmDelete = signal(false);
  const startRename = () => {
    name.set(props.file ? path.basename(props.file) : "Untitled.md");
    renaming.set(true);
  };
  const finishRename = () => {
    renaming.set(false);
    if (name().trim()) props.onRename(name());
  };
  return (
    <View testID="top-bar" class={`${BAR} h-12 flex-row items-center gap-1 border-b pr-2`} style={{ paddingLeft: props.inset + 8 }} desktop={{ windowDrag: true }}>
      <IconButton icon="folder-open" label="Open" shortcut={hint("mod+o")} testID="open-button" onPress={props.onOpenDialog} />
      <Popover
        open={props.openOpen}
        onOpenChange={(open) => props.setOpenOpen(open)}
        placement="bottom"
        align="start"
        popupClass={PANE}
        trigger={
          <View tooltip="Recent files" testID="recent-button" accessibilityLabel="Recent files" role="button" class="h-8 w-5 items-center justify-center rounded-(--radius-control) hover:bg-accent">
            <Icon name="chevron-down" size={14} />
          </View>
        }
      >
        <OpenPanel
          current={props.file}
          onOpen={(file) => {
            props.setOpenOpen(false);
            props.onOpen(file);
          }}
          onNew={(n) => {
            props.setOpenOpen(false);
            props.onNew(n);
          }}
        />
      </Popover>
      <IconButton icon="file-plus" label="New file" shortcut={hint("mod+n")} testID="new-button" onPress={() => props.onNew("")} />
      <View class="flex-1 flex-row items-center justify-center gap-2">
        <If
          when={renaming()}
          else={
            <Button testID="title" accessibilityLabel={`Rename ${props.title}`} onPress={startRename} class="flex-row items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent">
              <Text numberOfLines={1} class="text-sm font-medium text-foreground">
                {props.title}
              </Text>
              <If when={props.dirty}>
                <View testID="dirty-dot" accessibilityLabel="Edited" class="size-2 rounded-full bg-brand" />
              </If>
            </Button>
          }
        >
          <View class="w-64">
            <Field testID="rename-input" value={name()} autoFocus onChange={(v) => name.set(v)} onSubmit={finishRename} />
          </View>
        </If>
      </View>
      <View testID="mode-switch" class="flex-row rounded-(--radius-control) border border-border bg-field p-0.5">
        <Button
          accessibilityLabel="Visual"
          selected={props.mode === "visual"}
          onPress={() => props.onMode("visual")}
          class={`h-7 flex-row items-center gap-1.5 rounded-lg px-2.5 ${props.mode === "visual" ? "bg-accent border border-border" : "border border-transparent"}`}
        >
          <Icon name="eye" size={14} tint={props.mode === "visual" ? token("brand") : token("muted-foreground")} />
          <Text class="text-xs font-medium text-foreground">Visual</Text>
        </Button>
        <Button
          accessibilityLabel="Source"
          selected={props.mode === "source"}
          onPress={() => props.onMode("source")}
          class={`h-7 flex-row items-center gap-1.5 rounded-lg px-2.5 ${props.mode === "source" ? "bg-accent border border-border" : "border border-transparent"}`}
        >
          <Icon name="file-code" size={14} tint={props.mode === "source" ? token("brand") : token("muted-foreground")} />
          <Text class="text-xs font-medium text-foreground">Source</Text>
        </Button>
      </View>
      <IconButton icon="save" label="Save" shortcut={hint("mod+s")} testID="save-button" disabled={!props.dirty && props.file !== null} onPress={props.onSave} />
      <Popover
        open={confirmDelete()}
        onOpenChange={(open) => confirmDelete.set(open)}
        placement="bottom"
        align="end"
        popupClass={PANE}
        trigger={
          <View tooltip="Delete file" testID="delete-button" accessibilityLabel="Delete file" role="button" class={`size-8 items-center justify-center rounded-(--radius-control) hover:bg-accent ${props.file ? "" : "opacity-35"}`}>
            <Icon name="trash-2" size={16} />
          </View>
        }
      >
        <View class="w-64 gap-3 p-3">
          <Text class="text-sm text-foreground">{props.file ? `Delete ${path.basename(props.file)}? This removes the file from disk.` : "This document has no file yet."}</Text>
          <View class="flex-row justify-end gap-2">
            <TextButton label="Cancel" onPress={() => confirmDelete.set(false)} />
            <TextButton
              testID="delete-confirm"
              label="Delete"
              variant="danger"
              disabled={!props.file}
              onPress={() => {
                confirmDelete.set(false);
                props.onDelete();
              }}
            />
          </View>
        </View>
      </Popover>
      <IconButton
        icon={props.appearance === "light" ? "sun" : props.appearance === "dark" ? "moon" : "monitor"}
        label={`Appearance: ${props.appearance}`}
        testID="appearance-button"
        onPress={() => props.onAppearance(NEXT_APPEARANCE[props.appearance])}
      />
    </View>
  );
}
