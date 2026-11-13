/**
 * The ratio rows do not overlap, and nothing on them is cut off.
 *
 * The bug this guards: the health card's ratio row was one line, with
 * the verdict as a long sentence on the right. The card is not wide
 * enough for "Perlu diperbaiki", so it was clipped into "Per / dip" -
 * and a verdict that cannot say what it is saying is worse than no
 * verdict at all. On a narrow screen the value and the badge sat on
 * top of each other.
 *
 * The fix has three parts, and each part can be undone by accident by
 * anybody tidying up class names:
 *
 * - the row wraps (flex-wrap), so a badge that does not fit drops to
 *   the next line instead of being pushed off the edge;
 * - the badge and the value never shrink and never break (shrink-0,
 *   whitespace-nowrap), so they stay whole wherever they land;
 * - nothing on the row truncates or hides its overflow - the label
 *   wraps its words instead.
 *
 * All three are checked here, against the component and its sheet.
 *
 * Run with: node src/components/health/__tests__/financialRatioPills.test.js
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', '..');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failed += 1; console.error(`not ok - ${name}`); console.error(`  ${err.message}`); }
};

const PILLS = read('components/health/FinancialRatioPills.jsx');
const CSS = read('components/health/wellness.css');

/* The body of one row, which is where the overlap used to happen. */
const PILL_FN = PILLS.slice(PILLS.indexOf('const Pill = ('), PILLS.indexOf('export default function'));

// ---------------------------------------------------------------------
// The row wraps rather than clipping
// ---------------------------------------------------------------------

check('the row wraps in the markup', () => {
  assert.ok(
    /className="wellness-pill[^"]*flex-wrap/.test(PILL_FN),
    'the row carries flex-wrap, so a badge that does not fit drops down'
  );
});

check('the row wraps in the sheet too', () => {
  const rule = CSS.slice(CSS.indexOf('.wellness-pill {'), CSS.indexOf('.wellness-pill > span'));
  assert.ok(rule.includes('flex-wrap: wrap'), 'the sheet wraps the row');
  assert.ok(rule.includes('max-width: 100%'), 'the row never grows past its card');
  assert.ok(/gap:/.test(rule), 'a wrapped row needs a row gap, or the lines touch');
});

check('the row never hides what does not fit', () => {
  assert.ok(!/overflow-hidden/.test(PILL_FN), 'overflow-hidden would clip the badge again');
  assert.ok(!/\btruncate\b/.test(PILL_FN), 'truncate would cut the words again');
  const rule = CSS.slice(CSS.indexOf('.wellness-pill {'), CSS.indexOf('.dark .wellness-pill'));
  assert.ok(!/overflow:\s*hidden/.test(rule), 'the sheet does not clip either');
  assert.ok(!/text-overflow:\s*ellipsis/.test(rule), 'no ellipsis on a row that can wrap');
  assert.ok(!/white-space:\s*nowrap/.test(rule), 'the row itself must be allowed to wrap');
});

// ---------------------------------------------------------------------
// Nothing on the row overlaps anything else
// ---------------------------------------------------------------------

check('the badge stays whole wherever it lands', () => {
  const badge = PILL_FN.slice(PILL_FN.indexOf('{statusText ? ('));
  assert.ok(/shrink-0/.test(badge), 'the badge does not shrink');
  assert.ok(/whitespace-nowrap/.test(badge), 'the badge does not break its words');
  assert.ok(/rounded-full/.test(badge), 'it is a compact pill, not a sentence');
});

check('the value stays whole and lines up as a number', () => {
  assert.ok(
    /\{value\}/.test(PILL_FN) && /tabular-nums whitespace-nowrap shrink-0/.test(PILL_FN),
    'the value never wraps mid-number and never shrinks'
  );
});

check('the benchmark stays whole', () => {
  const bench = PILL_FN.slice(PILL_FN.indexOf('{benchmark ? ('), PILL_FN.indexOf('{statusText ? ('));
  assert.ok(/whitespace-nowrap/.test(bench) && /shrink-0/.test(bench), 'the target is not broken in half');
});

check('the label wraps its words instead of being cut', () => {
  assert.ok(/whitespace-normal break-words/.test(PILL_FN), 'the name of the ratio wraps');
  const sheet = CSS.slice(CSS.indexOf('.wellness-pill > span'), CSS.indexOf('.dark .wellness-pill'));
  assert.ok(sheet.includes('min-width: 0'), 'a flex child needs min-width 0 to be allowed to wrap');
  assert.ok(sheet.includes('overflow-wrap: break-word'), 'a long word breaks rather than overflowing');
});

check('the left group can shrink so the badge has room', () => {
  assert.ok(
    /flex items-center gap-2 min-w-0 flex-1/.test(PILL_FN),
    'the name and value group yields space instead of pushing the badge off'
  );
});

check('the dot never shrinks away', () => {
  const dot = CSS.slice(CSS.indexOf('.wellness-pill__dot {'), CSS.indexOf('.wellness-pill__dot--excellent'));
  assert.ok(dot.includes('flex-shrink: 0'), 'the status dot keeps its size');
});

// ---------------------------------------------------------------------
// The verdict is the server's, and it is written out in full
// ---------------------------------------------------------------------

check('every status has a dot colour and a badge colour, written out', () => {
  for (const status of ['excellent', 'good', 'warning', 'danger']) {
    assert.ok(PILLS.includes(`${status}: 'wellness-pill__dot--${status}'`), `${status} has a dot class`);
    assert.ok(CSS.includes(`.wellness-pill__dot--${status}`), `${status} dot is in the sheet`);
    assert.ok(PILLS.includes(`health_coach.status_${status}`), `${status} has words`);
  }
  assert.ok(/STATUS_BADGE_CLASS = \{/.test(PILLS), 'the badge colours are a literal map');
  assert.ok(
    !/bg-\$\{/.test(PILLS) && !/`bg-\w+-\$/.test(PILLS),
    'no class names built at run time - the scanner would not see them'
  );
});

check('an unknown status falls back instead of drawing a broken badge', () => {
  assert.ok(PILLS.includes('const safeStatus = STATUS_CLASS[status] ? status : \'\''), 'unknown statuses are neutralised');
  assert.ok(/\|\| 'bg-gray-50 text-gray-600/.test(PILLS), 'and the badge has a neutral fallback');
});

check('the verdict is never worked out in the browser', () => {
  assert.ok(!/IDEAL/.test(PILLS), 'no thresholds here');
  assert.ok(!/>=\s*20\b/.test(PILLS) && !/>=\s*30\b/.test(PILLS), 'the server owns the thresholds');
  assert.ok(/status=\{savingsRatio\?\.status\}/.test(PILLS), 'the status is passed through as given');
});

check('nothing is drawn when there is nothing to draw', () => {
  assert.ok(
    PILLS.includes('if (!savingsRatio && !emergencyFund && !dsrRatio) return null;'),
    'an empty card is better than three empty rows'
  );
});

check('the words of every verdict are in every language', () => {
  for (const language of ['id', 'en', 'ja']) {
    const table = read(`i18n/${language}.js`);
    for (const key of [
      'status_excellent:', 'status_good:', 'status_warning:', 'status_danger:',
      'benchmark_savings:', 'benchmark_emergency:', 'benchmark_dsr:',
      'savings_ratio:', 'emergency_fund:', 'dsr_ratio:',
    ]) {
      assert.ok(table.includes(key), `${language} has ${key}`);
    }
  }
});

console.log('');
console.log(`the ratio rows: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
