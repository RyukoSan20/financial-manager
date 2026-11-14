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

check('the day cell is a short cell, not a giant square', () => {
  // A min-height with its own padding, rather than a hard height: the
  // fixed h-14/h-16 left the amount label touching the rounded bottom
  // border, so the cell now sets a floor and lets the padding hold
  // the label clear of the edge.
  assert.ok(HEAT.includes('min-h-[54px]'), 'the cell has a compact height floor');
  assert.ok(HEAT.includes('p-1.5 sm:p-2'), 'the cell has its own padding');
  assert.ok(!HEAT.includes('h-14 sm:h-16'), 'the clipping fixed height is gone');
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

check('the botanical sheet carries the Kakeibo palette', () => {
  // Phase 1 Kakeibo overhaul: the warm off-white canvas, the muted
  // deep-sage ticket surface, and the soft sage-cream badge. The old
  // neon lime (#BEF264) on cream is gone - that was the washout bug.
  for (const hex of ['#FAF9F6', '#2F4842', '#D8F3DC']) {
    assert.ok(BOT.includes(hex), `${hex} is in the botanical sheet`);
  }
  assert.ok(!BOT.includes('#BEF264'), 'the retired neon lime is gone from the botanical sheet');
});

check('the forest ticket has a readable non-washed-out surface', () => {
  // The ticket surface and its cream amount must both be pinned, so a
  // light-mode override can never leave white/lime text on cream.
  assert.ok(BOT.includes('background: #2F4842 !important'), 'the ticket surface is deep sage');
  assert.ok(BOT.includes('#FFF8E7'), 'the ticket amount is warm cream');
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
