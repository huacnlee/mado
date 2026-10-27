//! The RichText Demo example's own Rust: the system's open and save dialogs.

use nsh_core::prelude::*;

/// The system's file dialogs.
#[module]
pub struct Dialogs;

#[module]
impl Dialogs {
    /// Asks for a Markdown file to open: its path, or `null` when cancelled.
    pub async fn open_markdown(directory: Option<String>) -> Option<String> {
        // rfd's async-std backend: zbus runs on its own executor, as NSH
        // polls this future without a Tokio runtime.
        let mut dialog = rfd::AsyncFileDialog::new()
            .set_title("Open")
            .add_filter("Markdown", &["md", "markdown", "mdown", "txt"]);
        if let Some(dir) = directory {
            dialog = dialog.set_directory(dir);
        }
        dialog
            .pick_file()
            .await
            .map(|f| f.path().to_string_lossy().into_owned())
    }
}

/// The example's UI set.
#[native_module("demo/native")]
fn native(registry: &mut Registry) {
    registry.module::<Dialogs>();
}
