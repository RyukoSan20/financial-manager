/**
 * The shape of a page.
 *
 * A finance app is mostly cards, numbers and lines. When every card
 * is the same size, with the same border and the same shadow, the
 * page reads as a wall, and the reader cannot tell the one number
 * that matters from the four that are supporting it.
 *
 * These checks hold that the pages share one shape: one card, one
 * badge, one pill, one number treatment, and a spacing rhythm that
 * is a multiple of four.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

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
// The tokens
// ---------------------------------------------------------------------------

check('there is one place the shape is decided', () => {
  const shape = read('src/styles/shape.css');
  assert.ok(shape.length > 500, 'the shape layer is empty');
  // The four families.
  for (const token of [
    '--radius-card',
    '--depth-card',
    '--edge',
    '--surface',
    '--space-4',
  ]) {
    assert.ok(shape.includes(token), `the shape layer has no "${token}"`);
  }
});

check('the shape layer is loaded by the application', () => {
  const main = read('src/main.jsx');
  assert.ok(
    main.includes("styles/shape.css"),
    'the shape layer is never loaded'
  );
});

check('the dark room has its own tokens', () => {
  const shape = read('src/styles/shape.css');
  assert.ok(
    /\.dark\s*\{[\s\S]*?--surface/.test(shape),
    'the dark room has no surface of its own'
  );
});

check('the movement stops when the reader asks for less of it', () => {
  const shape = read('src/styles/shape.css');
  assert.ok(
    /prefers-reduced-motion/.test(shape),
    'the shape ignores the reader asking for less movement'
  );
});

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

check('every card is the same card', () => {
  const card = read('src/components/ui/Card.jsx');
  assert.ok(
    /shape-card/.test(card),
    'the card does not use the shared shape'
  );
  // It is not the old shape any more.
  assert.ok(
    !/rounded-xl shadow-sm border border-gray-100/.test(card),
    'the card still uses the old shape'
  );
});

check('a card the reader can pick up answers the pointer', () => {
  const shape = read('src/styles/shape.css');
  assert.ok(
    /\.shape-card--interactive:hover/.test(shape),
    'the card does not answer the pointer'
  );
});

// ---------------------------------------------------------------------------
// The badge
// ---------------------------------------------------------------------------

check('a badge holds its words whole', () => {
  const badge = read('src/components/ui/Badge.jsx');
  assert.ok(
    /whitespace-nowrap/.test(badge),
    'the badge can be cut in half'
  );
  assert.ok(
    /shrink-0/.test(badge),
    'the badge can be pushed off the edge'
  );
});

check('a badge has a tint of its own', () => {
  const badge = read('src/components/ui/Badge.jsx');
  // Every state carries a ring, so it reads as a separate thing.
  const rings = (badge.match(/ring-1/g) || []).length;
  assert.ok(rings >= 6, `only ${rings} of the states have a ring`);
});

// ---------------------------------------------------------------------------
// The number
// ---------------------------------------------------------------------------

check('an amount is never broken across two lines', () => {
  const shape = read('src/styles/shape.css');
  assert.ok(
    /\.shape-amount[\s\S]*?white-space:\s*nowrap/.test(shape),
    'an amount can be broken across two lines'
  );
  assert.ok(
    /\.shape-amount[\s\S]*?tabular-nums/.test(shape),
    'an amount does not use tabular figures'
  );
});

// ---------------------------------------------------------------------------
// The pages
// ---------------------------------------------------------------------------

check('the dashboard leaves the bottom clear for the navigation', () => {
  const dashboard = read('src/pages/Dashboard.jsx');
  assert.ok(
    /pb-24 md:pb-8/.test(dashboard),
    'the last card of the dashboard sits under the navigation'
  );
});

check('the controls of the dashboard are in groups', () => {
  const dashboard = read('src/pages/Dashboard.jsx');
  // The timeframe buttons sit in a group of their own.
  assert.ok(
    /role="group"/.test(dashboard),
    'the timeframes are not marked as a group'
  );
  assert.ok(
    /aria-pressed=\{timeframe === tf\.key\}/.test(dashboard),
    'the chosen timeframe is not said to the reader'
  );
});

check('the safe-to-spend card says the number in one line', () => {
  const dashboard = read('src/pages/Dashboard.jsx');
  assert.ok(
    /whitespace-nowrap/.test(dashboard),
    'an amount on the dashboard can be broken'
  );
  // The per-day figure is given its own place, because it is the
  // form the number takes in the reader's head.
  assert.ok(
    /dashboard\.per_day/.test(dashboard),
    'the per-day figure is gone'
  );
});

check('the health coach measures the ratios against a target', () => {
  const pills = read('src/components/health/FinancialRatioPills.jsx');
  assert.ok(
    /benchmark/.test(pills),
    'a ratio is not measured against anything'
  );
  for (const key of [
    'health_coach.benchmark_savings',
    'health_coach.benchmark_emergency',
    'health_coach.benchmark_dsr',
  ]) {
    assert.ok(pills.includes(key), `the ratio has no target: ${key}`);
  }
});

check('the health coach says why the strengths are empty', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');
  assert.ok(
    /health_coach\.strengths_empty/.test(bento),
    'the empty panel does not say why it is empty'
  );
});

check('the four amounts of the health coach are one set', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');
  // They are four panels of the same shape, not four loose drawings.
  const panels = (bento.match(/rounded-xl bg-white\/55/g) || []).length;
  assert.ok(panels >= 4, `only ${panels} of the four are in a panel`);
});

check('the transactions page has one shape for its four capture buttons', () => {
  const transactions = read('src/pages/Transactions.jsx');
  // They are in a grid, and they are not four saturated blocks.
  assert.ok(
    /grid grid-cols-2 sm:grid-cols-4/.test(transactions),
    'the four capture buttons are not a grid'
  );
  assert.ok(
    !/bg-green-50 text-green-600 rounded-xl/.test(transactions),
    'the capture buttons are still saturated blocks'
  );
});

check('the quick entry on the add page is a field with a shape', () => {
  const add = read('src/components/layout/AddTransactionPage.jsx');
  assert.ok(
    /focus:shadow-\[0_0_0_3px/.test(add),
    'the quick entry has no focus ring'
  );
  assert.ok(
    /K\.clear/.test(add),
    'the quick entry cannot be cleared'
  );
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

check('the new words are in every language', () => {
  for (const file of ['src/i18n/id.js', 'src/i18n/en.js', 'src/i18n/ja.js']) {
    const source = read(file);
    for (const key of [
      'remaining_short',
      'benchmark_savings',
      'benchmark_emergency',
      'benchmark_dsr',
      'strengths_empty',
    ]) {
      assert.ok(source.includes(key), `${file} has no "${key}"`);
    }
  }
});

check('the clear button has a word in every language', () => {
  const batch = read('src/i18n/keys_batch1.js');
  const clears = (batch.match(/clear:/g) || []).length;
  assert.ok(clears >= 3, `only ${clears} of the languages have "clear"`);
});
