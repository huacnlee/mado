//! nsh-richtext: a complete rich text editing kit on NSH's `RichEditor`.
//! What Tiptap is to ProseMirror, this crate is to `nsh/base`'s
//! `RichEditor`: extensions (in Rust, registered by name), the commands a
//! toolbar, bubble menu and slash menu run, and the queries their UI needs.
//!
//! ```tsx
//! import { createRichEditor, richExtension } from "nsh/base";
//! import { RichText } from "nsh-richtext";
//!
//! const editor = createRichEditor({ extensions: [richExtension("richTextKit")], content, format: "markdown" });
//! editor.run(command("moveBlockDown"));
//! RichText.slashItems("head");
//! ```

pub mod blocks;
pub mod kit;
pub mod markdown;
pub mod slash;
pub mod tables;
pub mod text;

use nsh_base::rich_editor::{
    extensions::{ExtensionManager, RichExtensionRegistry},
    model::{Node, Schema},
};
use nsh_core::{JsonValue, prelude::*};

pub use crate::{
    blocks::{Block, Drop},
    slash::SlashItem,
    tables::{CellRange, TableEdges},
};

/// Queries of a rich text document, for an editor's UI.
#[module]
pub struct RichText;

/// The schema of [`kit::rich_text_kit`] with its defaults (the starter
/// kit's nodes and marks, and tables).
pub fn schema() -> Schema {
    static SCHEMA: std::sync::OnceLock<Schema> = std::sync::OnceLock::new();
    SCHEMA
        .get_or_init(|| {
            ExtensionManager::new(vec![kit::rich_text_kit()])
                .expect("the kit's extensions resolve")
                .schema()
                .clone()
        })
        .clone()
}

fn doc_of(doc: &JsonValue) -> Option<Node> {
    Node::from_json(&schema(), doc).ok()
}

#[module]
impl RichText {
    /// The block a handle at `pos` moves (the innermost list or task item,
    /// else the top-level block), or `null`.
    pub fn block_at(doc: JsonValue, pos: u32) -> Option<Block> {
        blocks::block_at(&doc_of(&doc)?, pos as usize)
    }

    /// Where dropping the block at `source` at the position `target` puts
    /// it, or `null` where it cannot go.
    pub fn drop_target(doc: JsonValue, source: u32, target: u32) -> Option<Drop> {
        blocks::drop_target(&doc_of(&doc)?, source as usize, target as usize)
    }

    /// What the cell selection from cell `anchor` to cell `head` covers:
    /// whole columns, whole rows or some cells; `null` outside a table.
    pub fn cell_range(doc: JsonValue, anchor: u32, head: u32) -> Option<CellRange> {
        tables::cell_range(&doc_of(&doc)?, anchor as usize, head as usize)
    }

    /// The edges of the table around `pos`, for adding a row or column at
    /// its end; `null` outside a table.
    pub fn table_edges(doc: JsonValue, pos: u32) -> Option<TableEdges> {
        tables::table_edges(&doc_of(&doc)?, pos as usize)
    }

    /// Reads Markdown as a document (JSON, for `createRichEditor`'s
    /// `content` or `setContent`), `==text==` highlighted.
    pub fn from_markdown(markdown: String) -> Result<JsonValue, String> {
        Ok(markdown::parse(&schema(), &markdown)?.to_json())
    }

    /// Writes a document (`editor.doc`) as Markdown, highlights as `==text==`.
    pub fn to_markdown(doc: JsonValue) -> Result<String, String> {
        let doc = Node::from_json(&schema(), &doc).map_err(|e| e.to_string())?;
        markdown::serialize(&doc)
    }

    /// The slash menu's blocks matching `query`.
    pub fn slash_items(query: String) -> Vec<SlashItem> {
        slash::matches(&query)
    }

    /// Words in `text` (each CJK character one).
    pub fn count_words(text: String) -> u32 {
        text::count_words(&text) as u32
    }

    /// Minutes to read `words`.
    pub fn reading_minutes(words: u32) -> u32 {
        text::reading_minutes(words as usize) as u32
    }
}

/// The crate's UI set: `RichText`, and the extensions `richTextKit`,
/// `blockMove`, `editing` and `markdown` for `richExtension(name)`.
#[native_module("nsh-richtext")]
fn native(registry: &mut Registry) {
    registry
        .module::<RichText>()
        .rich_extension("richTextKit", kit::rich_text_kit)
        .rich_extension("blockMove", kit::blocks)
        .rich_extension("editing", kit::editing)
        .rich_extension("markdown", kit::markdown);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tables_read_and_write_as_gfm() {
        let md = "| A | B |\n| --- | --- |\n| 1 | 2 |\n";
        let doc = RichText::from_markdown(md.into()).unwrap();
        assert_eq!(doc["content"][0]["type"], "table");
        let out = RichText::to_markdown(doc).unwrap();
        assert!(out.contains("| A | B |"), "{out}");
        assert!(out.contains("| 1 | 2 |"), "{out}");
    }
}
