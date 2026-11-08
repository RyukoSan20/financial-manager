/**
 * The agent's words, read the way the agent meant them.
 *
 * The agent writes in markdown. When it wanted a number to stand out
 * it wrote "**Rp 5.965.000**", and the reader was seeing the
 * asterisks as though they were part of the sentence.
 *
 * These checks hold the emphasis where it belongs, and hold that the
 * asterisks never reach the reader.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseInlineMarkdown,
  stripInlineMarkdown,
} from '../../utils/inlineMarkdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const read = (relative) =>
  readFileSync(join(ROOT, relative), 'utf8');

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------------------
// The parsing
// ---------------------------------------------------------------------------

check('a bold run becomes a strong piece', () => {
  const pieces = parseInlineMarkdown('Saldo **Rp 5.965.000** saat ini');
  assert.equal(pieces.length, 3);
  assert.equal(pieces[0].text, 'Saldo ');
  assert.equal(pieces[1].strong, 'Rp 5.965.000');
  assert.equal(pieces[2].text, ' saat ini');
});

check('several bold runs are all found', () => {
  const pieces = parseInlineMarkdown(
    '**Dana Darurat (Rp 1,8 juta)** dan **Operasi Lasik (Rp 30 juta)**'
  );
  const strong = pieces.filter((piece) => piece.strong !== undefined);
  assert.equal(strong.length, 2);
  assert.equal(strong[0].strong, 'Dana Darurat (Rp 1,8 juta)');
  assert.equal(strong[1].strong, 'Operasi Lasik (Rp 30 juta)');
});

check('text with no emphasis is one plain piece', () => {
  const pieces = parseInlineMarkdown('Semuanya beres.');
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].text, 'Semuanya beres.');
  assert.equal(pieces[0].strong, undefined);
});

check('empty text is no pieces at all', () => {
  assert.deepEqual(parseInlineMarkdown(''), []);
  assert.deepEqual(parseInlineMarkdown(null), []);
  assert.deepEqual(parseInlineMarkdown(undefined), []);
});

check('a lone asterisk is left alone', () => {
  // A multiplication sign, or a typo, is not emphasis.
  const pieces = parseInlineMarkdown('2 * 3 = 6');
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].text, '2 * 3 = 6');
});

check('the plain text is the emphasis with the asterisks taken out', () => {
  const stripped = stripInlineMarkdown(
    'Saldo **Rp 5.965.000** dan **Dana Darurat**'
  );
  assert.equal(stripped, 'Saldo Rp 5.965.000 dan Dana Darurat');
  assert.ok(!stripped.includes('**'), 'the asterisks are still there');
});

// ---------------------------------------------------------------------------
// The places the reader sees it
// ---------------------------------------------------------------------------

const MARKDOWN_SURFACES = [
  'src/components/ai/TopAiCommandBar.jsx',
  'src/components/common/AIAssistant.jsx',
  'src/components/common/MarkdownText.jsx',
  'src/components/market/AiMarketAdvisorChat.jsx',
  'src/pages/AIAdvisor.jsx',
];

check('every surface that shows the agent uses the markdown reader', () => {
  for (const surface of MARKDOWN_SURFACES) {
    const source = read(surface);
    assert.ok(
      /MarkdownText/.test(source),
      `${surface} shows the agent's words without reading the emphasis`
    );
  }
});

check('no surface turns the reply into markup with html', () => {
  for (const surface of MARKDOWN_SURFACES) {
    const source = read(surface);
    assert.ok(
      !/dangerouslySetInnerHTML/.test(source),
      `${surface} puts the agent's words into the page as markup`
    );
  }
});

// ---------------------------------------------------------------------------
// The bar itself
// ---------------------------------------------------------------------------

check('the bar does not open itself', () => {
  const bar = read('src/components/ai/TopAiCommandBar.jsx');
  // The drawer only shows when the reader has asked for it.
  assert.ok(
    /\{open && \(answer \|\| error \|\| busy\)/.test(bar),
    'the bar opens without being asked to'
  );
});

check('the answer can be closed', () => {
  const bar = read('src/components/ai/TopAiCommandBar.jsx');
  assert.ok(
    /setOpen\(false\)/.test(bar),
    'there is no way to close the answer'
  );
  assert.ok(
    /aria-label=\{t\('common\.close'\)\}/.test(bar),
    'the close button has no name for the reader'
  );
});

check('the four quick actions are on the bar itself on a wide screen', () => {
  const bar = read('src/components/ai/TopAiCommandBar.jsx');
  assert.ok(
    /QUICK_ACTIONS\.map/.test(bar),
    'the quick actions are not drawn'
  );
  assert.ok(
    /md:hidden/.test(bar),
    'the quick actions are behind a button on a wide screen too'
  );
});

check('the dashboard leaves room for the navigation at the bottom', () => {
  const dashboard = read('src/pages/Dashboard.jsx');
  assert.ok(
    /pb-24 md:pb-8/.test(dashboard),
    'the last card of the dashboard sits under the navigation'
  );
});
