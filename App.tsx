// Mado: Markdown files, edited as documents.
import { View, effect, mount, signal } from "nsh";
import { setColorScheme, windowSize } from "nsh";
import { Window, titleBar } from "nsh/desktop";
import { keymap } from "nsh";
import { ErrorNote } from "./components/ui";
import { SourceEditor } from "./components/SourceEditor";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { VisualEditor } from "./components/VisualEditor";
import { createDocumentStore } from "./store/document";
import { loadSettings, settings, updateSettings } from "./store/settings";

function App() {
  const doc = createDocumentStore();
  const linkOpen = signal(false);
  const imageOpen = signal(false);
  const openOpen = signal(false);
  const compact = () => windowSize().width < 760;

  // Settings arrive after the first frame: the appearance, the mode, and
  // the file open when Mado was last closed.
  void loadSettings().then(async (s) => {
    setColorScheme(s.appearance);
    doc.setMode(s.mode);
    if (s.recent[0]) await doc.open(s.recent[0]);
  });

  effect(() => Window.setTitle(`${doc.title()}${doc.dirty() ? " — Edited" : ""} · Mado`));

  const save = () => {
    void (doc.file() ? doc.save() : doc.create());
  };
  const openLink = () => {
    if (doc.mode() === "visual") linkOpen.set(true);
  };

  keymap.bind(
    {
      "mod+s": save,
      "mod+o": () => openOpen.set(true),
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
            editor={doc.mado().editor}
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
      <View class="flex-1 items-center px-4 pt-4">
        <View class="w-full max-w-3xl flex-1">
          <If when={doc.mode() === "visual"} else={<SourceEditor value={doc.source()} onChange={doc.setSource} />}>
            {/* One VisualEditor per session: opening a file makes a new session, and a new editor shows it. */}
            <Each of={[doc.mado()]}>
              {(mado) => <VisualEditor mado={mado()} revision={doc.revision()} actions={{ save, openLink, openImage: () => imageOpen.set(true) }} />}
            </Each>
          </If>
        </View>
      </View>
      <StatusBar words={doc.words()} characters={doc.characters()} dirty={doc.dirty()} saving={doc.saving()} path={doc.file()} status={doc.status()} />
    </View>
  );
}

mount(App);
