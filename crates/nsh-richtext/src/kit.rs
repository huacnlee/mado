//! The extensions: [`blocks`] (moving blocks), [`editing`] (the commands a
//! toolbar, a bubble menu and a slash menu run, by name), [`markdown`]
//! (Markdown shortcuts, paste and copy) and [`rich_text_kit`], which brings
//! them with NSH's starter kit: one extension for a complete editor.

use nsh_base::rich_editor::{
    commands::{BoxCommand, CommandRegistry, chain_commands},
    extensions::{
        Extension,
        kit::{starter_kit, table_kit},
        link::{LinkOptions, link as link_plugins},
        markdown::{MarkdownOptions, markdown as markdown_plugins},
        suggestion::{SuggestionOptions, SuggestionTrigger, suggestion},
    },
    model::Schema,
};
use serde_json::{Value, json};

use crate::blocks::{extend_blocks, move_block_by, move_block_to};

/// The node types a block style sets, by the names the commands take.
pub const BLOCK_STYLES: [&str; 8] = ["paragraph", "h1", "h2", "h3", "h4", "h5", "h6", "codeBlock"];

/// The key of the slash menu's suggestion: `editor.suggestion("slash")`.
pub const SLASH_KEY: &str = "slash";

/// A built-in command made from JSON arguments.
fn builtin(name: &str, args: Value, schema: &Schema) -> Result<BoxCommand, String> {
    CommandRegistry::builtin().make(name, &args, schema)
}

fn pos(args: &Value, key: &str) -> Result<usize, String> {
    args.get(key)
        .and_then(Value::as_u64)
        .map(|n| n as usize)
        .ok_or_else(|| format!("expected a position `{key}`"))
}

fn string<'a>(args: &'a Value, key: &str) -> Result<&'a str, String> {
    args.get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("expected a string `{key}`"))
}

/// The item type of a list type.
fn item_of(list: &str) -> &'static str {
    if list == "taskList" {
        "taskItem"
    } else {
        "listItem"
    }
}

/// Moving blocks: `moveBlockUp` / `moveBlockDown` (Alt-↑ / Alt-↓) swap the
/// block at the caret (a list item, else a top-level block) with its
/// sibling; `moveBlockTo({ source, target })` drops the block at `source`
/// by the block at `target` (see [`crate::blocks::drop_target`]).
pub fn blocks() -> Extension {
    Extension::new("blockMove")
        .add_commands(|_| {
            vec![
                (
                    "moveBlockUp".into(),
                    std::sync::Arc::new(|_: &Value, _: &Schema| Ok(move_block_by(-1))) as _,
                ),
                (
                    "moveBlockDown".into(),
                    std::sync::Arc::new(|_: &Value, _: &Schema| Ok(move_block_by(1))) as _,
                ),
                (
                    "moveBlockTo".into(),
                    std::sync::Arc::new(|args: &Value, _: &Schema| {
                        Ok(move_block_to(pos(args, "source")?, pos(args, "target")?))
                    }) as _,
                ),
            ]
        })
        .add_keyboard_shortcuts(|_| {
            vec![
                ("Alt-ArrowUp".into(), move_block_by(-1)),
                ("Alt-ArrowDown".into(), move_block_by(1)),
                ("Shift-ArrowUp".into(), extend_blocks(-1)),
                ("Shift-ArrowDown".into(), extend_blocks(1)),
            ]
        })
}

/// The editing commands, by name:
///
/// - `setBlockStyle({ style })`: `paragraph`, `h1`…`h6` or `codeBlock`;
/// - `toggleListType({ list })`: `bulletList`, `orderedList` or `taskList`,
///   out of it when in it, else from another list or from text into it;
/// - `toggleQuote()`; `indentItem()` / `outdentItem()` (list and task items);
/// - `setAlign({ align })`: `left` (none), `center`, `right` or `justify`, on
///   paragraphs and headings;
/// - `insertDivider()`, `insertImage({ src, alt })`;
/// - `replaceWith({ from, to, command?, args? })`: deletes the range (a typed
///   `/query`), then runs the named command.
pub fn editing() -> Extension {
    Extension::new("editing").add_commands(|_| {
        let make = |f: fn(&Value, &Schema) -> Result<BoxCommand, String>| {
            std::sync::Arc::new(f) as nsh_base::rich_editor::commands::CommandFactory
        };
        vec![
            ("setBlockStyle".into(), make(set_block_style)),
            ("toggleListType".into(), make(|args, schema| {
                let list = string(args, "list")?;
                builtin("toggleList", json!({ "listName": list, "itemName": item_of(list) }), schema)
            })),
            ("toggleQuote".into(), make(|_, schema| builtin("toggleWrap", json!({ "name": "blockquote" }), schema))),
            ("indentItem".into(), make(|_, schema| each_item("sinkListItem", schema))),
            ("outdentItem".into(), make(|_, schema| each_item("liftListItem", schema))),
            ("setAlign".into(), make(|args, schema| {
                let align = string(args, "align")?;
                let value = if align == "left" { Value::Null } else { Value::from(align) };
                let tries = ["heading", "paragraph"]
                    .into_iter()
                    .map(|name| builtin("updateAttributes", json!({ "name": name, "attrs": { "textAlign": value } }), schema))
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(chain_commands(tries))
            })),
            ("insertDivider".into(), make(|_, schema| {
                insert_content(json!({ "type": "horizontalRule" }), schema)
            })),
            ("insertImage".into(), make(|args, schema| {
                let src = string(args, "src")?;
                let alt = args.get("alt").cloned().unwrap_or(Value::Null);
                insert_content(json!({ "type": "image", "attrs": { "src": src, "alt": alt, "title": null } }), schema)
            })),
            ("replaceWith".into(), make(|args, schema| {
                let (from, to) = (pos(args, "from")?, pos(args, "to")?);
                let mut steps = vec![
                    builtin("setTextSelection", json!({ "position": { "from": from, "to": to } }), schema)?,
                    builtin("deleteSelection", Value::Null, schema)?,
                ];
                if let Some(name) = args.get("command").and_then(Value::as_str) {
                    let then = args.get("args").cloned().unwrap_or(Value::Null);
                    steps.push(registry_command(name, then, schema)?);
                }
                Ok(nsh_base::rich_editor::commands::chain(steps))
            })),
        ]
    })
}

/// A command of this kit or a built-in one, by name.
fn registry_command(name: &str, args: Value, schema: &Schema) -> Result<BoxCommand, String> {
    match name {
        "setBlockStyle" => set_block_style(&args, schema),
        "toggleListType" => builtin(
            "toggleList",
            json!({ "listName": string(&args, "list")?, "itemName": item_of(string(&args, "list")?) }),
            schema,
        ),
        "toggleQuote" => builtin("toggleWrap", json!({ "name": "blockquote" }), schema),
        "insertDivider" => insert_content(json!({ "type": "horizontalRule" }), schema),
        _ => builtin(name, args, schema),
    }
}

/// Inserts `content` over the selection.
fn insert_content(content: Value, schema: &Schema) -> Result<BoxCommand, String> {
    // Checked now, so a bad node fails when the command is made.
    builtin(
        "insertContentAt",
        json!({ "position": { "from": 0, "to": 0 }, "content": content }),
        schema,
    )?;
    let schema = schema.clone();
    Ok(nsh_base::rich_editor::commands::command(
        move |state, dispatch| {
            let (from, to) = (state.selection().from(), state.selection().to());
            let args = json!({ "position": { "from": from, "to": to }, "content": content });
            builtin("insertContentAt", args, &schema).is_ok_and(|insert| insert(state, dispatch))
        },
    ))
}

/// `name` (`sinkListItem`, `liftListItem`) on a list item, else a task item.
fn each_item(name: &str, schema: &Schema) -> Result<BoxCommand, String> {
    let tries = ["listItem", "taskItem"]
        .into_iter()
        .filter(|item| schema.node_type(item).is_some())
        .map(|item| builtin(name, json!({ "name": item }), schema))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(chain_commands(tries))
}

fn set_block_style(args: &Value, schema: &Schema) -> Result<BoxCommand, String> {
    let style = string(args, "style")?;
    match style {
        "paragraph" | "codeBlock" => builtin("setNode", json!({ "name": style }), schema),
        h if h.len() == 2 && h.starts_with('h') => {
            let level: u64 = h[1..]
                .parse()
                .map_err(|_| format!("unknown block style `{h}`"))?;
            builtin(
                "setNode",
                json!({ "name": "heading", "attrs": { "level": level } }),
                schema,
            )
        }
        other => Err(format!("unknown block style `{other}`")),
    }
}

/// Markdown: shortcuts as you type (block and inline), Markdown paste, and
/// copies as Markdown text.
pub fn markdown() -> Extension {
    Extension::new("markdown").add_plugins(|_| markdown_plugins(MarkdownOptions::default()))
}

/// `autolink` (Tiptap's Link behavior): URLs typed or pasted become links,
/// and a URL pasted over a selection links it.
pub fn autolink() -> Extension {
    Extension::new("autolink").add_plugins(|_| link_plugins(LinkOptions::default()))
}

/// `slashMenu`: a suggestion keyed [`SLASH_KEY`] triggered by `/` at the
/// start of a line (Tiptap's slash commands); the arrows, Enter and Tab are
/// captured while it is active, Escape dismisses it. The app reads it with
/// `editor.suggestion("slash")` and runs the chosen item's command over its
/// range. Its priority puts it before the keymap, so Enter and the arrows
/// reach the menu rather than the document while it is open.
pub fn slash_menu() -> Extension {
    Extension::new("slashMenu")
        .with_priority(200)
        .add_plugins(|_| {
            let mut trigger = SuggestionTrigger::default();
            trigger.char = "/".into();
            trigger.start_of_line = true;
            let mut options = SuggestionOptions::default();
            options.key = SLASH_KEY.into();
            options.trigger = trigger;
            options.capture_keys = ["ArrowUp", "ArrowDown", "Enter", "Tab"]
                .map(String::from)
                .to_vec();
            vec![suggestion(options)]
        })
}

/// Everything a complete editor needs: NSH's starter kit (configured with
/// the option `starterKit`), [`markdown`], [`editing`], [`blocks`], NSH's
/// table kit (`tableKit`), [`autolink`] and [`slash_menu`] (`slashMenu`);
/// each left out with `false` under its name (`{ blockMove: false }`).
pub fn rich_text_kit() -> Extension {
    Extension::new("richTextKit").add_extensions(|options| {
        let on = |name: &str| options.get(name) != Some(&Value::Bool(false));
        let mut kit = Vec::new();
        if on("starterKit") {
            let starter = starter_kit();
            kit.push(match options.get("starterKit") {
                Some(config @ Value::Object(_)) => starter.configure(config.clone()),
                _ => starter,
            });
        }
        if on("markdown") {
            kit.push(markdown());
        }
        if on("editing") {
            kit.push(editing());
        }
        if on("blockMove") {
            kit.push(blocks());
        }
        if on("tableKit") {
            let tables = table_kit();
            kit.push(match options.get("tableKit") {
                Some(config @ Value::Object(_)) => tables.configure(config.clone()),
                _ => tables,
            });
        }
        if on("autolink") {
            kit.push(autolink());
        }
        if on("slashMenu") {
            kit.push(slash_menu());
        }
        kit
    })
}

#[cfg(test)]
mod tests {
    use nsh_base::rich_editor::{
        extensions::ExtensionManager,
        model::Node,
        state::{EditorState, EditorStateConfig, TextSelection},
    };
    use serde_json::json;

    use super::*;

    /// Runs the kit's command `name` on a document of one paragraph `text`, the caret at its end.
    fn run(name: &str, args: Value, text: &str) -> Result<Value, String> {
        let manager = ExtensionManager::new(vec![rich_text_kit()]).map_err(|e| format!("{e:?}"))?;
        let schema = manager.schema().clone();
        let doc = Node::from_json(
            &schema,
            &json!({ "type": "doc", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": text }] }] }),
        )
        .map_err(|e| e.to_string())?;
        let selection = TextSelection::create(&doc, 1 + text.len(), None);
        let state = EditorState::create(
            EditorStateConfig::new(schema.clone())
                .doc(doc)
                .selection(selection),
        )
        .map_err(|e| format!("{e:?}"))?;
        let command = manager.commands().make(name, &args, &schema)?;
        let mut out = None;
        if !command(&state, Some(&mut |tr| out = Some(tr.doc().to_json()))) {
            return Err(format!("{name} did not apply"));
        }
        out.ok_or_else(|| "no transaction".into())
    }

    #[test]
    fn insert_table_comes_with_the_kit() {
        let doc = run(
            "insertTable",
            json!({ "rows": 2, "cols": 2, "withHeaderRow": true }),
            "",
        )
        .unwrap();
        let types: Vec<_> = doc["content"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| n["type"].as_str().unwrap().to_owned())
            .collect();
        assert!(types.contains(&"table".to_owned()), "{types:?}");
    }

    #[test]
    fn replace_with_turns_a_slash_query_into_the_block() {
        let doc = run(
            "replaceWith",
            json!({ "from": 1, "to": 6, "command": "setBlockStyle", "args": { "style": "h1" } }),
            "/head",
        )
        .unwrap();
        assert_eq!(doc["content"][0]["type"], "heading");
        assert_eq!(doc["content"][0]["attrs"]["level"], 1);
        assert!(doc["content"][0].get("content").is_none());
    }

    #[test]
    fn block_styles_lists_and_quotes() {
        let doc = run("setBlockStyle", json!({ "style": "codeBlock" }), "x").unwrap();
        assert_eq!(doc["content"][0]["type"], "codeBlock");
        let doc = run("toggleListType", json!({ "list": "taskList" }), "x").unwrap();
        assert_eq!(doc["content"][0]["type"], "taskList");
        let doc = run("toggleQuote", Value::Null, "x").unwrap();
        assert_eq!(doc["content"][0]["type"], "blockquote");
        let doc = run("setAlign", json!({ "align": "center" }), "x").unwrap();
        assert_eq!(doc["content"][0]["attrs"]["textAlign"], "center");
        let doc = run("insertDivider", Value::Null, "x").unwrap();
        assert!(doc.to_string().contains("horizontalRule"));
    }
}
