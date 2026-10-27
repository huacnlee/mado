// RichText Demo: Markdown files, edited as documents.
import { View, effect, mount, signal } from "nsh";
import { setColorScheme, windowSize } from "nsh";
import { Window, titleBar } from "nsh/desktop";
import { keymap, platform } from "nsh";
import { Dialogs } from "demo/native";
import { ErrorNote } from "./components/ui";
import { SourceEditor } from "./components/SourceEditor";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { VisualEditor } from "./components/VisualEditor";
import { createDocumentStore, folder } from "./store/document";
import { loadSettings, settings, updateSettings } from "./store/settings";

function App() {
  const doc = createDocumentStore();
  const linkOpen = signal(false);
  const imageOpen = signal(false);
  const openOpen = signal(false);
  const compact = () => windowSize().width < 760;

  // Settings arrive after the first frame: the appearance, the mode, and
  // the file open when RichText Demo was last closed.
  void loadSettings().then(async (s) => {
    setColorScheme(s.appearance);
    doc.setMode(s.mode);
    if (s.recent[0]) await doc.open(s.recent[0]);
  });

  effect(() => Window.setTitle(`${doc.title()}${doc.dirty() ? " — Edited" : ""} · RichText Demo`));

  const save = () => {
    void doc.save();
  };
  /** Open: the system's dialog, starting in the documents folder; the recent list where there is none (the web, tests). */
  const openDialog = async () => {
    if (platform.os === "web" || settings().backend === "storage") {
      openOpen.set(true);
      return;
    }
    const file = await Dialogs.openMarkdown(folder());
    if (file) await doc.open(file);
  };
  const openLink = () => {
    if (doc.mode() === "visual") linkOpen.set(true);
  };

  keymap.bind(
    {
      "mod+s": save,
      "mod+o": () => void openDialog(),
      "mod+n": () => void doc.create(),
      "mod+/": () => doc.setMode(doc.mode() === "visual" ? "source" : "visual"),
    },
    { when: "always" },
  );

  return (
    <View class="flex-1 bg-background">
      <TopBar
        title={doc.title()}
        file={doc.file()}
        dirty={doc.dirty()}
        mode={doc.mode()}
        appearance={settings().appearance}
        openOpen={openOpen()}
        setOpenOpen={(v) => openOpen.set(v)}
        onOpen={(file) => void doc.open(file)}
        onOpenDialog={() => void openDialog()}
        onNew={(name) => void doc.create(name)}
        onSave={save}
        onRename={(name) => void doc.rename(name)}
        onDelete={() => void doc.remove()}
        onMode={doc.setMode}
        onAppearance={(appearance) => {
          setColorScheme(appearance);
          updateSettings({ appearance });
        }}
        inset={titleBar().left}
      />
      <If when={doc.mode() === "visual"}>
        <View class="border-b border-border bg-card px-3 py-1.5 backdrop-blur-xl">
          <Toolbar
            editor={doc.demo().editor}
            revision={doc.revision()}
            compact={compact()}
            panels={{
              get linkOpen() {
                return linkOpen();
              },
              get imageOpen() {
                return imageOpen();
              },
              setLinkOpen: (v: boolean) => linkOpen.set(v),
              setImageOpen: (v: boolean) => imageOpen.set(v),
            }}
          />
        </View>
      </If>
      <If when={doc.error()}>
        <View class="px-4 pt-3">
          <ErrorNote message={doc.error() ?? ""} onDismiss={() => doc.error.set(null)} />
        </View>
      </If>
      {/* The visual editor spans the window, so its scroll bar is at the window's edge; its document is centered (`editorClasses.content`). */}
      <View class="flex-1">
        <View class="flex-1">
          <If
            when={doc.mode() === "visual"}
            else={
              <View class="flex-1 w-full max-w-3xl self-center px-4 pt-4">
                <SourceEditor value={doc.source()} onChange={doc.setSource} />
              </View>
            }
          >
            {/* One VisualEditor per session: opening a file makes a new session, and a new editor shows it. */}
            <Each of={[doc.demo()]}>
              {(demo) => (
                <VisualEditor
                  demo={demo()}
                  revision={doc.revision()}
                  actions={{
                    save,
                    newFile: () => void doc.create(),
                    openFile: () => void openDialog(),
                    toggleMode: () => doc.setMode("source"),
                    openLink,
                    openImage: () => imageOpen.set(true),
                  }}
                />
              )}
            </Each>
          </If>
        </View>
      </View>
      <StatusBar words={doc.words()} characters={doc.characters()} dirty={doc.dirty()} saving={doc.saving()} path={doc.file()} status={doc.status()} />
    </View>
  );
}

mount(App);
