//! Markdown with the marks CommonMark lacks: `==highlight==` (as Typora,
//! Obsidian and Tiptap's Markdown read it). NSH's Markdown format reads
//! CommonMark with GFM's strikethrough; this layer turns `==` pairs in a
//! textblock's text into highlight marks after reading, and highlight marks
//! into `==` pairs before writing, so a highlight survives a save. Underline,
//! superscript and subscript, which Markdown has no syntax for, are written
//! as the inline HTML `<u>`, `<sup>` and `<sub>` (as GitHub shows them) and
//! read back the same way.

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
    let mut json = doc.to_json();
    if schema.mark_type(HIGHLIGHT).is_some() {
        pair_marks(&mut json, HIGHLIGHT, DELIMITER, DELIMITER);
    }
    for (mark, open, close) in TAGS {
        if schema.mark_type(mark).is_some() {
            pair_marks(&mut json, mark, open, close);
        }
    }
    Node::from_json(schema, &json).map_err(|e| e.to_string())
}

/// Writes `doc` as Markdown, its highlights as `==text==`.
pub fn serialize(doc: &Node) -> Result<String, String> {
    let mut json = doc.to_json();
    delimit(&mut json, HIGHLIGHT, DELIMITER, DELIMITER);
    for (k, (mark, ..)) in TAGS.iter().enumerate() {
        delimit(&mut json, mark, &placeholder(k, false), &placeholder(k, true));
    }
    let plain = Node::from_json(doc.ty().schema(), &json).map_err(|e| e.to_string())?;
    let markdown = format().serialize(&plain).map_err(|e| e.to_string())?;
    let mut markdown = unescape_line_starts(&markdown);
    for (k, (_, open, close)) in TAGS.iter().enumerate() {
        markdown = markdown
            .replace(&placeholder(k, false), open)
            .replace(&placeholder(k, true), close);
    }
    Ok(one_final_newline(markdown))
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

/// The marks written as inline HTML tags, which CommonMark reads as raw
/// HTML (text here) and this layer pairs into marks: (mark, open, close).
const TAGS: [(&str, &str, &str); 3] = [
    ("underline", "<u>", "</u>"),
    ("superscript", "<sup>", "</sup>"),
    ("subscript", "<sub>", "</sub>"),
];

/// What a tag is written as before the Markdown writer runs, which would
/// escape its `<`: private-use characters it leaves alone, replaced with
/// the tag after.
fn placeholder(tag: usize, close: bool) -> String {
    format!("\u{E000}{}{}\u{E001}", tag, if close { "c" } else { "o" })
}

/// Turns the `open` … `close` pairs of each textblock (outside code) into
/// `mark`s; `open == close` toggles (`==`), and a delimiter without its
/// pair stays text.
fn pair_marks(node: &mut Value, mark: &str, open: &str, close: &str) {
    let Some(children) = node.get_mut("content").and_then(Value::as_array_mut) else {
        return;
    };
    if !children
        .iter()
        .any(|c| c.get("type").and_then(Value::as_str) == Some("text"))
    {
        for child in children.iter_mut() {
            pair_marks(child, mark, open, close);
        }
        return;
    }
    // Every delimiter, as (child, byte offset, length, opens), outside code.
    let mut tokens = Vec::new();
    for (i, child) in children.iter().enumerate() {
        if has_mark(child, "code") {
            continue;
        }
        if let Some(text) = child.get("text").and_then(Value::as_str) {
            let mut from = 0;
            loop {
                let o = text[from..].find(open).map(|at| (from + at, open.len(), true));
                let c = (open != close)
                    .then(|| text[from..].find(close).map(|at| (from + at, close.len(), false)))
                    .flatten();
                let Some((at, len, opens)) = [o, c].into_iter().flatten().min_by_key(|t| t.0)
                else {
                    break;
                };
                tokens.push((i, at, len, opens));
                from = at + len;
            }
        }
    }
    // The delimiters that pair: an open then the next close (or the next
    // `==`); the rest stay text.
    let mut used = Vec::new();
    let mut pending = None;
    for (k, &(_, _, _, opens)) in tokens.iter().enumerate() {
        match pending {
            None if opens => pending = Some(k),
            Some(o) if open == close || !opens => {
                used.push(o);
                used.push(k);
                pending = None;
            }
            Some(_) => pending = Some(k),
            None => {}
        }
    }
    if used.is_empty() {
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
        let mut push = |piece: &str, on: bool| {
            if piece.is_empty() {
                return;
            }
            let mut marks = marks.clone();
            if on {
                marks.push(json!({ "type": mark }));
            }
            out.push(text_node(piece, marks));
        };
        for &k in &used {
            let (c, at, len, _) = tokens[k];
            if c != i {
                continue;
            }
            push(&text[start..at], on);
            on = !on;
            start = at + len;
        }
        push(&text[start..], on);
    }
    *children = out;
}

/// Puts `open` and `close` around each run of `mark`ed text and drops the mark.
fn delimit(node: &mut Value, mark: &str, open: &str, close: &str) {
    let Some(children) = node.get_mut("content").and_then(Value::as_array_mut) else {
        return;
    };
    for child in children.iter_mut() {
        delimit(child, mark, open, close);
    }
    let lit: Vec<bool> = children.iter().map(|c| has_mark(c, mark)).collect();
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
            if opens { open } else { "" },
            text,
            if closes { close } else { "" }
        );
        child["text"] = Value::from(text);
        let marks: Vec<Value> = marks_of(child)
            .into_iter()
            .filter(|m| m.get("type").and_then(Value::as_str) != Some(mark))
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
    fn underline_superscript_and_subscript_are_written_as_tags() {
        let md = "<u>under</u>, x<sup>2</sup> and H<sub>2</sub>O, a <u lone.\n";
        let doc = parse(&starter::schema(), md).unwrap();
        let json = doc.to_json();
        let runs = json["content"][0]["content"].as_array().unwrap();
        assert_eq!(runs[0]["text"], "under");
        assert_eq!(runs[0]["marks"][0]["type"], "underline");
        // A lone `<` is plain text, escaped.
        assert_eq!(serialize(&doc).unwrap(), md.replace("a <u", "a \\<u"));
        assert_eq!(parse(&starter::schema(), &serialize(&doc).unwrap()).unwrap().to_json(), json);
    }

    #[test]
    fn highlights_across_other_marks() {
        let doc = parse(&starter::schema(), "==a **b** c==\n").unwrap();
        assert_eq!(serialize(&doc).unwrap().trim(), "==a **b** c==");
    }
}
