//! Markdown with the marks CommonMark lacks: `==highlight==` (as Typora,
//! Obsidian and Tiptap's Markdown read it). NSH's Markdown format reads
//! CommonMark with GFM's strikethrough; this layer turns `==` pairs in a
//! textblock's text into highlight marks after reading, and highlight marks
//! into `==` pairs before writing, so a highlight survives a save.

use nsh_base::rich_editor::{
    formats::{DocFormat, MarkdownFormat, MarkdownNames},
    model::{Node, Schema},
};
use serde_json::{Value, json};

const HIGHLIGHT: &str = "highlight";
const DELIMITER: &str = "==";

fn format() -> MarkdownFormat {
    MarkdownFormat::new(MarkdownNames::default())
}

fn marks_of(node: &Value) -> Vec<Value> {
    node.get("marks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn has_mark(node: &Value, name: &str) -> bool {
    marks_of(node)
        .iter()
        .any(|m| m.get("type").and_then(Value::as_str) == Some(name))
}

fn text_node(text: &str, marks: Vec<Value>) -> Value {
    let mut node = json!({ "type": "text", "text": text });
    if !marks.is_empty() {
        node["marks"] = Value::Array(marks);
    }
    node
}

/// Reads Markdown as a document of `schema`, `==text==` highlighted.
pub fn parse(schema: &Schema, markdown: &str) -> Result<Node, String> {
    let doc = format()
        .parse(schema, markdown)
        .map_err(|e| e.to_string())?;
    if schema.mark_type(HIGHLIGHT).is_none() {
        return Ok(doc);
    }
    let mut json = doc.to_json();
    highlight_pairs(&mut json);
    Node::from_json(schema, &json).map_err(|e| e.to_string())
}

/// Writes `doc` as Markdown, its highlights as `==text==`.
pub fn serialize(doc: &Node) -> Result<String, String> {
    let mut json = doc.to_json();
    delimit_highlights(&mut json);
    let plain = Node::from_json(doc.ty().schema(), &json).map_err(|e| e.to_string())?;
    let markdown = format().serialize(&plain).map_err(|e| e.to_string())?;
    Ok(one_final_newline(unescape_line_starts(&markdown)))
}

/// The empty paragraph an editor keeps after a last block that is not one
/// (a list, a heading, a table: where the caret can go on typing) writes
/// blank lines; a file ends with one newline.
fn one_final_newline(markdown: String) -> String {
    let body = markdown.trim_end_matches('\n');
    if body.is_empty() {
        String::new()
    } else {
        format!("{body}\n")
    }
}

/// The writer escapes `=` starting a line (a setext heading's underline);
/// `==` followed by text is an opening highlight there, never an underline.
fn unescape_line_starts(markdown: &str) -> String {
    let escaped = format!("\\{DELIMITER}");
    markdown
        .split_inclusive('\n')
        .map(|line| {
            let indent = line.len() - line.trim_start_matches([' ', '>', '-', '*', '+']).len();
            let (head, rest) = line.split_at(indent);
            match rest.strip_prefix(&escaped) {
                Some(after)
                    if after
                        .chars()
                        .next()
                        .is_some_and(|c| c != '=' && !c.is_whitespace()) =>
                {
                    format!("{head}{DELIMITER}{after}")
                }
                _ => line.to_owned(),
            }
        })
        .collect()
}

/// Turns the `==` pairs of each textblock (outside code) into highlights.
fn highlight_pairs(node: &mut Value) {
    let Some(children) = node.get_mut("content").and_then(Value::as_array_mut) else {
        return;
    };
    if !children
        .iter()
        .any(|c| c.get("type").and_then(Value::as_str) == Some("text"))
    {
        for child in children.iter_mut() {
            highlight_pairs(child);
        }
        return;
    }
    // The delimiters, as (child, byte offset), outside code; an odd last one stays text.
    let mut found = Vec::new();
    for (i, child) in children.iter().enumerate() {
        if has_mark(child, "code") {
            continue;
        }
        if let Some(text) = child.get("text").and_then(Value::as_str) {
            let mut from = 0;
            while let Some(at) = text[from..].find(DELIMITER) {
                found.push((i, from + at));
                from += at + DELIMITER.len();
            }
        }
    }
    if found.len() % 2 == 1 {
        found.pop();
    }
    if found.is_empty() {
        return;
    }
    let mut out = Vec::new();
    let mut on = false;
    for (i, child) in children.iter().enumerate() {
        let Some(text) = child.get("text").and_then(Value::as_str) else {
            out.push(child.clone());
            continue;
        };
        let marks = marks_of(child);
        let mut start = 0;
        let cuts: Vec<usize> = found
            .iter()
            .filter(|(c, _)| *c == i)
            .map(|(_, at)| *at)
            .collect();
        let mut push = |piece: &str, on: bool| {
            if piece.is_empty() {
                return;
            }
            let mut marks = marks.clone();
            if on {
                marks.push(json!({ "type": HIGHLIGHT }));
            }
            out.push(text_node(piece, marks));
        };
        for at in cuts {
            push(&text[start..at], on);
            on = !on;
            start = at + DELIMITER.len();
        }
        push(&text[start..], on);
    }
    *children = out;
}

/// Puts `==` around each run of highlighted text and drops the mark.
fn delimit_highlights(node: &mut Value) {
    let Some(children) = node.get_mut("content").and_then(Value::as_array_mut) else {
        return;
    };
    for child in children.iter_mut() {
        delimit_highlights(child);
    }
    let lit: Vec<bool> = children.iter().map(|c| has_mark(c, HIGHLIGHT)).collect();
    for i in 0..children.len() {
        if !lit[i] {
            continue;
        }
        let child = &mut children[i];
        let text = child
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        let opens = i == 0 || !lit[i - 1];
        let closes = i + 1 == lit.len() || !lit[i + 1];
        let text = format!(
            "{}{}{}",
            if opens { DELIMITER } else { "" },
            text,
            if closes { DELIMITER } else { "" }
        );
        child["text"] = Value::from(text);
        let marks: Vec<Value> = marks_of(child)
            .into_iter()
            .filter(|m| m.get("type").and_then(Value::as_str) != Some(HIGHLIGHT))
            .collect();
        if marks.is_empty() {
            child.as_object_mut().map(|o| o.remove("marks"));
        } else {
            child["marks"] = Value::Array(marks);
        }
    }
}

#[cfg(test)]
mod tests {
    use nsh_base::rich_editor::extensions::starter;

    use super::*;

    #[test]
    fn highlights_read_and_write_back() {
        let schema = starter::schema();
        let doc = parse(
            &schema,
            "Links and ==highlights== stand out, `a==b==c` stays.\n",
        )
        .unwrap();
        let json = doc.to_json();
        let runs = json["content"][0]["content"].as_array().unwrap();
        assert_eq!(runs[1]["text"], "highlights");
        assert_eq!(runs[1]["marks"][0]["type"], "highlight");
        assert_eq!(runs[3]["text"], "a==b==c");
        let markdown = serialize(&doc).unwrap();
        assert_eq!(
            markdown.trim(),
            "Links and ==highlights== stand out, `a==b==c` stays."
        );
    }

    #[test]
    fn a_trailing_empty_paragraph_writes_no_blank_lines() {
        let schema = starter::schema();
        let mut json = parse(&schema, "## Head\n").unwrap().to_json();
        json["content"]
            .as_array_mut()
            .unwrap()
            .push(serde_json::json!({ "type": "paragraph" }));
        let doc = Node::from_json(&schema, &json).unwrap();
        assert_eq!(serialize(&doc).unwrap(), "## Head\n");
    }

    #[test]
    fn a_lone_delimiter_stays_text() {
        let doc = parse(&starter::schema(), "x == y\n").unwrap();
        assert_eq!(serialize(&doc).unwrap().trim(), "x == y");
    }

    #[test]
    fn highlights_across_other_marks() {
        let doc = parse(&starter::schema(), "==a **b** c==\n").unwrap();
        assert_eq!(serialize(&doc).unwrap().trim(), "==a **b** c==");
    }
}
