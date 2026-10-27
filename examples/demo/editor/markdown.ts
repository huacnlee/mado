// Counting what a document says, as the status bar shows it: nsh-richtext's.
import { RichText } from "nsh-richtext";

/** Words in `text` (each CJK character one, as Typora and Tiptap's CharacterCount count them). */
export function countWords(text: string): number {
  return RichText.countWords(text);
}

/** Minutes to read `words` at 230 words a minute, at least one for a document with any. */
export function readingMinutes(words: number): number {
  return RichText.readingMinutes(words);
}
