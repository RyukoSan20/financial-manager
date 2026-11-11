/**
 * The spending calendar is compact, and says the amount.
 *
 * The calendar's day cells were giant squares, so the month did not
 * fit in one card. They are now short cells of a fixed height, and an
 * active cell carries the amount spent that day in a short form
 * ("Rp35rb") beside the flame, so the calendar reads at a glance.
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

const HEAT = read('components/analytics/SpendingHeatmapCalendar.jsx');

check('the day cell is a short fixed height, not a giant square', () => {
  assert.ok(HEAT.includes('h-14 sm:h-16'), 'the cell has the compact height');
  assert.ok(!HEAT.includes('relative aspect-square rounded-lg flex flex-col items-center justify-center'), 'the giant square cell is gone');
});

check('an active cell shows the amount spent, shortened', () => {
  assert.ok(HEAT.includes('compactRupiah('), 'there is a shortener');
  assert.ok(HEAT.includes('data-testid={`heatmap-amount-${day.day}`}'), 'the amount is on the cell');
});

check('the shortener reads the way the spec asked', () => {
  // "Rp35rb" for thirty-five thousand; "Rp1,2jt" for over a million.
  const fn = HEAT.slice(HEAT.indexOf('function compactRupiah'), HEAT.indexOf('function compactRupiah') + 600);
  assert.ok(fn.includes("rb`"), 'thousands become rb');
  assert.ok(fn.includes("jt`"), 'millions become jt');
});

const BOT = read('styles/botanical.css');

check('the botanical sheet carries the household colours', () => {
  for (const hex of ['#F5F3EC', '#112A20', '#BEF264']) {
    assert.ok(BOT.includes(hex), `${hex} is in the botanical sheet`);
  }
});

check('the forest is the default colour scheme', () => {
  const appearance = read('utils/appearance.js');
  assert.ok(appearance.includes("export const DEFAULT_SCHEME = 'forest'"), 'forest is default');
  // And the amber scheme is no longer the muddy brown.
  const amber = appearance.slice(appearance.indexOf('amber: {'), appearance.indexOf('amber: {') + 400);
  assert.ok(!amber.includes("'#b45309'") && !amber.includes('#b45309'), 'amber is not muddy brown any more');
});

console.log('');
console.log(`the calendar and the theme: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
