//! Counting what a document says, as a status bar shows it.

fn is_cjk(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{30FF}' | '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{AC00}'..='\u{D7AF}')
}

/// Words in `text`: runs of letters and digits, and each CJK character on
/// its own (as Typora and Tiptap's CharacterCount count them).
pub fn count_words(text: &str) -> usize {
    let mut words = 0;
    let mut in_word = false;
    for c in text.chars() {
        if is_cjk(c) {
            words += 1;
            in_word = false;
        } else if c.is_alphanumeric() || (in_word && (c == '\'' || c == '’')) {
            if !in_word {
                words += 1;
            }
            in_word = true;
        } else {
            in_word = false;
        }
    }
    words
}

/// Minutes to read `words` at 230 words a minute, at least one for a
/// document with any.
pub fn reading_minutes(words: usize) -> usize {
    if words == 0 {
        0
    } else {
        ((words as f64 / 230.0).round() as usize).max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_words_and_cjk() {
        assert_eq!(count_words("Hello, world! It's 2026."), 4);
        assert_eq!(count_words("你好 world"), 3);
        assert_eq!(count_words(""), 0);
        assert_eq!(reading_minutes(0), 0);
        assert_eq!(reading_minutes(10), 1);
        assert_eq!(reading_minutes(690), 3);
    }
}
