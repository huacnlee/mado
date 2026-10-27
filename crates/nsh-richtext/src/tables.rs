//! What a table menu asks of a cell selection: whether it covers whole
//! columns or rows, and which.

use nsh_base::rich_editor::{
    model::Node,
    tables::{TableMap, TableRole, table_role},
};
use nsh_core::prelude::*;

/// The cells a cell selection covers in its table.
#[derive(Debug, Clone, Default, PartialEq, Eq, JsObject)]
#[non_exhaustive]
pub struct CellRange {
    /// `"column"` when it covers whole columns, `"row"` whole rows (a
    /// one-row table's columns are columns), else `"cells"`.
    pub kind: String,
    /// The table's position.
    pub table: usize,
    /// The first column (`column`) or row (`row`, `cells`: the first row).
    pub from: usize,
    /// The column or row after the last.
    pub to: usize,
    /// How many columns the table has.
    pub columns: usize,
    /// How many rows the table has.
    pub rows: usize,
}

/// The range of the cell selection from cell `anchor` to cell `head`
/// (positions before the cells), none outside a table.
pub fn cell_range(doc: &Node, anchor: usize, head: usize) -> Option<CellRange> {
    let rp = doc.resolve(anchor).ok()?;
    // Before a cell: the row is the parent, the table around it.
    let depth = rp.depth.checked_sub(1)?;
    let table = rp.node(depth);
    if table_role(table.ty()) != Some(TableRole::Table) {
        return None;
    }
    let start = rp.start(depth);
    let map = TableMap::get(table);
    let rect = map.rect_between(anchor - start, head.checked_sub(start)?);
    let (kind, from, to) = if rect.top == 0 && rect.bottom == map.height {
        ("column", rect.left, rect.right)
    } else if rect.left == 0 && rect.right == map.width {
        ("row", rect.top, rect.bottom)
    } else {
        ("cells", rect.top, rect.bottom)
    };
    Some(CellRange {
        kind: kind.into(),
        table: rp.before(depth),
        from,
        to,
        columns: map.width,
        rows: map.height,
    })
}

/// The edges of the table around a position: where it starts and ends and
/// the cells a row or column added at its end goes after.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, JsObject)]
#[non_exhaustive]
pub struct TableEdges {
    /// The position before the table.
    pub from: usize,
    /// The position after it.
    pub to: usize,
    /// A text position in the last row's last cell.
    pub last_cell: usize,
    /// A text position in the first row's last cell.
    pub last_column: usize,
}

/// The table `pos` is in, by its edges; none outside a table.
pub fn table_edges(doc: &Node, pos: usize) -> Option<TableEdges> {
    let rp = doc.resolve(pos).ok()?;
    let depth = (0..=rp.depth)
        .rev()
        .find(|&d| table_role(rp.node(d).ty()) == Some(TableRole::Table))?;
    let table = rp.node(depth);
    let start = rp.start(depth);
    let map = TableMap::get(table);
    // A cell's offset in the table, then into its first textblock.
    let inside = |offset: usize| start + offset + 2;
    Some(TableEdges {
        from: rp.before(depth),
        to: rp.after(depth),
        last_cell: inside(*map.map.last()?),
        last_column: inside(map.map[map.width - 1]),
    })
}

#[cfg(test)]
mod tests {
    use super::cell_range;
    use crate::markdown;

    #[test]
    fn a_selection_down_a_column_is_a_column() {
        let doc =
            markdown::parse(&crate::schema(), "| a | b |\n| --- | --- |\n| 1 | 2 |\n").unwrap();
        // The cells' positions: table 0, row 1, cells at 2 and the next.
        let mut cells = Vec::new();
        doc.descendants(
            &mut |node: &nsh_base::rich_editor::model::Node, pos: usize, _, _| {
                if node.ty().name().ends_with("Cell") || node.ty().name().ends_with("Header") {
                    cells.push(pos);
                }
                true
            },
        );
        let range = cell_range(&doc, cells[1], cells[3]).unwrap();
        assert_eq!(
            (range.kind.as_str(), range.from, range.to),
            ("column", 1, 2)
        );
        let range = cell_range(&doc, cells[2], cells[3]).unwrap();
        assert_eq!((range.kind.as_str(), range.from, range.to), ("row", 1, 2));
        let edges = super::table_edges(&doc, cells[0] + 2).unwrap();
        assert_eq!((edges.from, edges.to), (0, doc.content().size()));
        assert_eq!(edges.last_cell, cells[3] + 2);
        assert_eq!(edges.last_column, cells[1] + 2);
    }
}
