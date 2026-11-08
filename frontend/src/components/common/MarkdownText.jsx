/**
 * The agent's own words, read the way the agent meant them.
 *
 * The agent writes in markdown. When it wants a number to stand out
 * it writes "**Rp 5.965.000**" - and the reader was seeing the
 * asterisks, as part of the sentence, as though they were words.
 *
 * This puts the emphasis where it belongs and takes the punctuation
 * out of sight. The reply is broken into pieces and the strong ones
 * are rendered as elements - the reply's own words are never handed
 * to the page as markup, so a reply that happens to contain
 * something that looks like a tag stays text.
 *
 * Only the emphasis is understood, on purpose. The agent's answers
 * are short paragraphs, and a half-rendered table is worse than the
 * plain text of one.
 */

import { parseInlineMarkdown } from '../../utils/inlineMarkdown';

/**
 * The reply.
 *
 * The pieces are wrapped so that a reply with a line break in it
 * keeps the line break, which is how the agent lays out a list.
 */
export default function MarkdownText({ text, className = '', strongClassName = '' }) {
  const pieces = parseInlineMarkdown(text);

  if (!pieces.length) return null;

  return (
    <span className={className}>
      {pieces.map((piece, index) =>
        piece.strong !== undefined ? (
          <strong
            key={`md-${index}`}
            className={strongClassName || 'font-semibold text-gray-900 dark:text-gray-100'}
          >
            {piece.strong}
          </strong>
        ) : (
          <span key={`md-${index}`}>{piece.text}</span>
        )
      )}
    </span>
  );
}

export { parseInlineMarkdown };
