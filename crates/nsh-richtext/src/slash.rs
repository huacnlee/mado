//! The blocks a slash menu offers: each with the command that makes it
//! (a command of [`crate::kit::editing`], by name, with its arguments).

use nsh_core::element::JsObject;
use serde_json::{Value, json};

/// A block a slash menu inserts.
#[derive(Debug, Clone, PartialEq, JsObject)]
pub struct SlashItem {
    /// What picks it (`h1`, `bullet`, ...).
    pub id: String,
    /// Its name in the menu.
    pub label: String,
    /// A line saying what it is.
    pub hint: String,
    /// A Lucide icon's name.
    pub icon: String,
    /// More words it is found by.
    pub keywords: String,
    /// The command making it, `null` for one the app handles (`image`).
    pub command: Option<String>,
    /// The command's arguments.
    pub args: Value,
}

fn item(
    id: &str,
    label: &str,
    hint: &str,
    icon: &str,
    keywords: &str,
    command: Option<&str>,
    args: Value,
) -> SlashItem {
    SlashItem {
        id: id.into(),
        label: label.into(),
        hint: hint.into(),
        icon: icon.into(),
        keywords: keywords.into(),
        command: command.map(Into::into),
        args,
    }
}

/// Every block a slash menu offers.
pub fn items() -> Vec<SlashItem> {
    let style = |s: &str| json!({ "style": s });
    let list = |l: &str| json!({ "list": l });
    vec![
        item(
            "text",
            "Text",
            "Plain paragraph",
            "pilcrow",
            "paragraph text",
            Some("setBlockStyle"),
            style("paragraph"),
        ),
        item(
            "h1",
            "Heading 1",
            "Big section heading",
            "heading-1",
            "title h1",
            Some("setBlockStyle"),
            style("h1"),
        ),
        item(
            "h2",
            "Heading 2",
            "Medium section heading",
            "heading-2",
            "subtitle h2",
            Some("setBlockStyle"),
            style("h2"),
        ),
        item(
            "h3",
            "Heading 3",
            "Small section heading",
            "heading-3",
            "h3",
            Some("setBlockStyle"),
            style("h3"),
        ),
        item(
            "bullet",
            "Bulleted list",
            "A simple list",
            "list",
            "ul unordered bullet",
            Some("toggleListType"),
            list("bulletList"),
        ),
        item(
            "ordered",
            "Numbered list",
            "A list with numbers",
            "list-ordered",
            "ol ordered number",
            Some("toggleListType"),
            list("orderedList"),
        ),
        item(
            "task",
            "Task list",
            "Track tasks with checkboxes",
            "list-todo",
            "todo check task",
            Some("toggleListType"),
            list("taskList"),
        ),
        item(
            "quote",
            "Quote",
            "Capture a quote",
            "text-quote",
            "blockquote citation",
            Some("toggleQuote"),
            Value::Null,
        ),
        item(
            "code",
            "Code block",
            "Code with a fence",
            "square-code",
            "code pre fence",
            Some("setBlockStyle"),
            style("codeBlock"),
        ),
        item(
            "rule",
            "Divider",
            "A horizontal rule",
            "minus",
            "hr rule separator divider",
            Some("insertDivider"),
            Value::Null,
        ),
        item(
            "image",
            "Image",
            "Insert an image by path or URL",
            "image",
            "picture photo img",
            None,
            Value::Null,
        ),
    ]
}

/// The items matching `query` by label or keyword.
pub fn matches(query: &str) -> Vec<SlashItem> {
    let q = query.trim().to_lowercase();
    items()
        .into_iter()
        .filter(|i| q.is_empty() || i.label.to_lowercase().contains(&q) || i.keywords.contains(&q))
        .collect()
}
