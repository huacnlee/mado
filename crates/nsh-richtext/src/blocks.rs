//! The blocks a handle moves: a list or task item (the innermost one around
//! a position), else a block of the document's top level. A block moves
//! among the children of a node of its parent's type, so an item stays in a
//! list and a top-level block at the top level; Alt-↑ / Alt-↓ swap it with
//! its sibling, and a drag drops it before or after another block.

use nsh_base::rich_editor::{
    commands::{BoxCommand, command, tiptap},
    model::Node,
};
use nsh_core::element::JsObject;

/// The node types whose nodes move on their own inside their parent.
pub const ITEMS: [&str; 2] = ["listItem", "taskItem"];

/// A block's range in document positions, and its depth (1 at the top level).
#[derive(Debug, Clone, Copy, PartialEq, Eq, JsObject)]
pub struct Block {
    /// The position before it.
    pub from: usize,
    /// The position after it.
    pub to: usize,
    /// Its depth in the document.
    pub depth: usize,
}

/// Where a dragged block lands: the block it is dropped by, the side of it
/// and the position it is inserted at.
#[derive(Debug, Clone, Copy, PartialEq, Eq, JsObject)]
pub struct Drop {
    /// The dragged block.
    pub source: Block,
    /// The block it is dropped before or after.
    pub target: Block,
    /// Whether it goes after `target`.
    pub after: bool,
    /// The position it is inserted at, in the document before the move.
    pub insert: usize,
}

fn is_item(node: &Node) -> bool {
    ITEMS.contains(&node.ty().name())
}

/// The block at `pos`: the innermost list or task item around it, else the
/// top-level block around it (or, between two, the one after it).
pub fn block_at(doc: &Node, pos: usize) -> Option<Block> {
    let pos = pos.min(doc.content().size());
    let res = doc.resolve(pos).ok()?;
    for depth in (1..=res.depth).rev() {
        if depth == 1 || is_item(res.node(depth)) {
            return Some(Block {
                from: res.before(depth),
                to: res.after(depth),
                depth,
            });
        }
    }
    let (from, to) = match (res.node_after(), res.node_before()) {
        (Some(next), _) => (pos, pos + next.node_size()),
        (None, Some(prev)) => (pos - prev.node_size(), pos),
        (None, None) => return None,
    };
    Some(Block { from, to, depth: 1 })
}

/// The type name of the node holding `block`.
fn parent_name(doc: &Node, block: Block) -> Option<String> {
    let res = doc.resolve(block.from).ok()?;
    Some(res.parent().ty().name().to_owned())
}

/// Moving the block at `pos` one place up (`by < 0`) or down: the block and
/// the position it goes to, or `None` at its parent's end.
pub fn move_by(doc: &Node, pos: usize, by: i32) -> Option<(Block, usize)> {
    let block = block_at(doc, pos)?;
    if by < 0 {
        let prev = doc.resolve(block.from).ok()?.node_before()?;
        Some((block, block.from - prev.node_size()))
    } else {
        let next = doc.resolve(block.to).ok()?.node_after()?;
        Some((block, block.to + next.node_size()))
    }
}

/// Where the block at `source` lands when dropped at `target`: by the
/// innermost block around `target` that is a sibling kind of it (a child of
/// a node of the same type), after it when it follows the dragged block.
/// `None` when there is no such block, or it is the dragged block or in it.
pub fn drop_target(doc: &Node, source: usize, target: usize) -> Option<Drop> {
    let source = block_at(doc, source)?;
    let parent = parent_name(doc, source)?;
    let target = target.min(doc.content().size());
    let res = doc.resolve(target).ok()?;
    let found = (1..=res.depth)
        .rev()
        .find(|&depth| res.node(depth - 1).ty().name() == parent)
        .map(|depth| Block {
            from: res.before(depth),
            to: res.after(depth),
            depth,
        })
        .or_else(|| {
            // Between top-level blocks.
            (source.depth == 1).then(|| block_at(doc, target)).flatten()
        })?;
    if found.from >= source.from && found.to <= source.to {
        return None;
    }
    let after = found.from > source.from;
    Some(Drop {
        source,
        target: found,
        after,
        insert: if after { found.to } else { found.from },
    })
}

/// Moves the block at the selection's head one place up or down.
pub fn move_block_by(by: i32) -> BoxCommand {
    command(move |state, dispatch| {
        let head = state.selection().head();
        let Some((block, target)) = move_by(state.doc(), head, by) else {
            return false;
        };
        let offset = head - block.from;
        let moved = tiptap::cut(block.from, block.to, target);
        let mut made = None;
        if !moved(state, Some(&mut |tr| made = Some(tr))) {
            return false;
        }
        let Some(mut tr) = made else { return false };
        // Keep the caret where it was in the block.
        let start = if by < 0 {
            target
        } else {
            target - (block.to - block.from)
        };
        let pos = (start + offset).min(tr.doc().content().size());
        let selection = nsh_base::rich_editor::state::TextSelection::create(tr.doc(), pos, None);
        tr.set_selection(selection).scroll_into_view();
        if let Some(dispatch) = dispatch {
            dispatch(tr);
        }
        true
    })
}

/// Moves the block at `source` to where dropping it at `target` puts it.
pub fn move_block_to(source: usize, target: usize) -> BoxCommand {
    command(move |state, dispatch| {
        let Some(drop) = drop_target(state.doc(), source, target) else {
            return false;
        };
        tiptap::cut(drop.source.from, drop.source.to, drop.insert)(state, dispatch)
    })
}

#[cfg(test)]
mod tests {
    use nsh_base::rich_editor::{
        extensions::starter,
        model::Node,
        state::{EditorState, EditorStateConfig, TextSelection},
    };
    use serde_json::json;

    use super::*;

    fn p(text: &str) -> serde_json::Value {
        json!({ "type": "paragraph", "content": [{ "type": "text", "text": text }] })
    }

    fn li(text: &str) -> serde_json::Value {
        json!({ "type": "listItem", "content": [p(text)] })
    }

    /// `A`, a list of `one` `two` `three`, `B`.
    fn doc() -> Node {
        let json = json!({ "type": "doc", "content": [
            p("A"),
            { "type": "bulletList", "content": [li("one"), li("two"), li("three")] },
            p("B"),
        ]});
        Node::from_json(&starter::schema(), &json).unwrap()
    }

    fn texts(doc: &Node) -> Vec<String> {
        let mut out = Vec::new();
        doc.descendants(&mut |node: &Node, _pos: usize, _parent, _index| {
            if node.is_textblock() {
                out.push(node.text_content());
            }
            true
        });
        out
    }

    /// Position inside the textblock whose text is `text`.
    fn pos_of(doc: &Node, text: &str) -> usize {
        let mut found = None;
        doc.descendants(&mut |node: &Node, pos: usize, _parent, _index| {
            if found.is_none() && node.is_textblock() && node.text_content() == text {
                found = Some(pos + 1);
            }
            found.is_none()
        });
        found.unwrap()
    }

    fn run(doc: Node, at: usize, command: BoxCommand) -> Option<Node> {
        let selection = TextSelection::create(&doc, at, None);
        let config = EditorStateConfig::new(starter::schema())
            .doc(doc)
            .selection(selection);
        let state = EditorState::create(config).unwrap();
        let mut out = None;
        command(&state, Some(&mut |tr| out = Some(tr.doc().clone()))).then_some(())?;
        out
    }

    #[test]
    fn a_list_item_is_a_block() {
        let doc = doc();
        let block = block_at(&doc, pos_of(&doc, "two")).unwrap();
        assert_eq!(block.depth, 2);
        assert_eq!(doc.node_at(block.from).unwrap().ty().name(), "listItem");
        assert_eq!(block_at(&doc, pos_of(&doc, "A")).unwrap().depth, 1);
    }

    #[test]
    fn alt_arrows_move_list_items_among_their_siblings() {
        let doc = doc();
        let up = run(doc.clone(), pos_of(&doc, "two"), move_block_by(-1)).unwrap();
        assert_eq!(texts(&up), ["A", "two", "one", "three", "B"]);
        let down = run(doc.clone(), pos_of(&doc, "two"), move_block_by(1)).unwrap();
        assert_eq!(texts(&down), ["A", "one", "three", "two", "B"]);
        assert!(run(doc.clone(), pos_of(&doc, "one"), move_block_by(-1)).is_none());
        let top = run(doc.clone(), pos_of(&doc, "B"), move_block_by(-1)).unwrap();
        assert_eq!(texts(&top), ["A", "B", "one", "two", "three"]);
    }

    #[test]
    fn drops_keep_items_in_lists_and_blocks_at_the_top() {
        let doc = doc();
        let item = run(
            doc.clone(),
            0,
            move_block_to(pos_of(&doc, "one"), pos_of(&doc, "three")),
        )
        .unwrap();
        assert_eq!(texts(&item), ["A", "two", "three", "one", "B"]);
        // An item dropped on a top-level paragraph has nowhere to go.
        assert!(drop_target(&doc, pos_of(&doc, "one"), pos_of(&doc, "B")).is_none());
        // A paragraph dropped on an item goes by the list.
        let block = run(
            doc.clone(),
            0,
            move_block_to(pos_of(&doc, "A"), pos_of(&doc, "two")),
        )
        .unwrap();
        assert_eq!(texts(&block), ["one", "two", "three", "A", "B"]);
        assert!(drop_target(&doc, pos_of(&doc, "two"), pos_of(&doc, "two")).is_none());
    }
}
