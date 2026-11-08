/**
 * Inline markdown.
 *
 * The agent writes in markdown - it says "**Rp 5.965.000**" when it
 * means "the number, in bold" - but the reader was seeing the raw
 * asterisks: "**Rp 5.965.000**". The asterisks are the agent's
 * punctuation, not the reader's words, and a reader who reads
 * asterisks as part of a sentence has to work out what they mean.
 *
 * So the asterisks are taken out here and put where they belong: as
 * emphasis. Only the emphasis is understood, on purpose. A link, a
 * table and a heading are not turned into elements, because the
 * agent's answers are short paragraphs and a half-rendered table is
 * worse than the plain text of one.
 *
 * The result is a list of pieces - some of them plain text and some
 * of them strong - so that React can put them on the page without
 * ever using `dangerouslySetInnerHTML`. The agent's words cannot
 * become the page's markup, and a reply that happens to contain
 * something that looks like a tag is still just text.
 */

/**
 * The pieces of a line of markdown.
 *
 * Each piece is either `{ text }` or `{ strong: '...' }`.
 */
export function parseInlineMarkdown(text) {
  const source = String(text ?? '');
  if (!source) return [];

  const pieces = [];
  // The bold runs, and where they are.
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match = pattern.exec(source);

  while (match) {
    // The plain text before the run.
    if (match.index > lastIndex) {
      pieces.push({ text: source.slice(lastIndex, match.index) });
    }
    // The run itself.
    pieces.push({ strong: match[1] });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(source);
  }

  // The plain text after the last run.
  if (lastIndex < source.length) {
    pieces.push({ text: source.slice(lastIndex) });
  }

  return pieces;
}

/**
 * The text of a reply, with the emphasis taken out.
 *
 * Some of the reader's own screens - a tooltip, a title, a line of
 * summary - cannot hold an element. There the emphasis is dropped and
 * the text is kept, which is better than asterisks.
 */
export function stripInlineMarkdown(text) {
  return String(text ?? '').replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * The reply, as React pieces.
 *
 * The key of each piece is its place in the line, so React knows the
 * pieces are the same ones between two renders.
 */
export function renderInlineMarkdown(text, keyPrefix = 'md') {
  return parseInlineMarkdown(text).map((piece, index) => {
    const key = `${keyPrefix}-${index}`;
    if (piece.strong !== undefined) {
      return { key, strong: piece.strong };
    }
    return { key, text: piece.text };
  });
}

export default parseInlineMarkdown;
