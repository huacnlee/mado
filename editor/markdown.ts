// Counting what a document says, as the status bar shows it.

/** Words in `text`: runs of letters and digits, and each CJK character on its own (as Typora and Tiptap's CharacterCount count them). */
export function countWords(text: string): number {
  const cjk = text.match(/[぀-ヿ㐀-䶿一-鿿가-힯]/g)?.length ?? 0;
  const rest = text.replace(/[぀-ヿ㐀-䶿一-鿿가-힯]/g, " ");
  const words = rest.split(/[\s\p{P}]+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return words + cjk;
}

/** Minutes to read `words` at 230 words a minute, at least one for a document with any. */
export function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.round(words / 230));
}
