/**
 * The custom range stays open until it is applied.
 *
 * The analytics bar had three choices in a dropdown, and a reader who
 * wanted one specific fortnight could not ask for it. Now there is a
 * bar of shortcuts and a pair of date boxes - and the pair of boxes
 * has two rules that are easy to break by accident:
 *
 * - the panel must not close, and the numbers must not move, while
 *   the reader is still typing the second date;
 * - the label on the right must not repeat the pill's own words when
 *   the custom range is chosen but not yet complete.
 *
 * Both rules live in one component, so both are checked here against
 * its source.
 *
 * Run with: node src/components/analytics/__tests__/dateRangeCustomPanel.test.js
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

const BAR = read('components/analytics/DateRangeFilterBar.jsx');
const RANGE = read('utils/dateRange.js');

check('the bar is the shortcuts, not a dropdown', () => {
  assert.ok(BAR.includes('DATE_PRESETS.map('), 'the presets are drawn as buttons');
  assert.ok(!/<select/.test(BAR), 'the old dropdown is gone');
  assert.ok(BAR.includes('data-testid={`date-preset-${preset.key}`}'), 'each shortcut is addressable');
});

check('an active shortcut says it is active to a screen reader', () => {
  assert.ok(BAR.includes('aria-pressed={isActive}'), 'aria-pressed carries the state');
});

check('choosing the custom range opens the panel and does not apply', () => {
  const fn = BAR.slice(BAR.indexOf('const choosePreset'), BAR.indexOf('const applyCustom'));
  const custom = fn.slice(fn.indexOf("if (preset === 'custom')"), fn.indexOf('return;'));
  assert.ok(custom.includes('setOpen(true)'), 'the panel opens');
  assert.ok(!custom.includes('onApply?.()'), 'nothing is applied while the dates are being typed');
});

check('the dates already chosen survive opening the panel', () => {
  const fn = BAR.slice(BAR.indexOf('const choosePreset'), BAR.indexOf('const applyCustom'));
  assert.ok(fn.includes('resolveRange(choice)'), 'the resolved range seeds the drafts');
  assert.ok(fn.includes('setDraftStart(choice.start || resolved.start'), 'the start survives');
  assert.ok(fn.includes('setDraftEnd(choice.end || resolved.end'), 'the end survives');
});

check('any other shortcut closes the panel and applies at once', () => {
  const fn = BAR.slice(BAR.indexOf('const choosePreset'), BAR.indexOf('const applyCustom'));
  const tail = fn.slice(fn.indexOf('return;'));
  assert.ok(tail.includes('setOpen(false)'), 'the panel closes');
  assert.ok(tail.includes('onChange?.({ ...choice, preset })'), 'the choice is passed up');
  assert.ok(tail.includes('onApply?.()'), 'and it is applied');
});

check('applying carries both dates up, then closes', () => {
  const fn = BAR.slice(BAR.indexOf('const applyCustom'), BAR.indexOf('return ('));
  assert.ok(fn.includes('start: draftStart') && fn.includes('end: draftEnd'), 'both dates go up');
  assert.ok(fn.includes('setOpen(false)') && fn.includes('onApply?.()'), 'then it closes and applies');
});

check('apply is refused until both dates are there', () => {
  assert.ok(
    BAR.includes("disabled={!isCustomRangeComplete({ preset: 'custom', start: draftStart, end: draftEnd })}"),
    'the button is disabled on an incomplete range'
  );
  assert.ok(BAR.includes("t('date_range.needs_both_dates')"), 'and the reason is said out loud');
});

check('the two boxes cannot be set the wrong way round', () => {
  assert.ok(BAR.includes('max={draftEnd || undefined}'), 'the start cannot pass the end');
  assert.ok(BAR.includes('min={draftStart || undefined}'), 'the end cannot precede the start');
});

check('the label is dropped while the custom range is incomplete', () => {
  assert.ok(
    BAR.includes("choice.preset === 'custom' && !isCustomRangeComplete(choice) ? null : ("),
    'no label that only repeats the pill'
  );
  assert.ok(BAR.includes('data-testid="date-range-label"'), 'the label is addressable when it is shown');
});

check('the panel is addressable, and only drawn when open', () => {
  assert.ok(BAR.includes('data-testid="custom-range-panel"'), 'the panel is addressable');
  assert.ok(BAR.includes('{open ? ('), 'it is drawn only when open');
  assert.ok(BAR.includes('data-testid="date-range-start"'), 'the start box is addressable');
  assert.ok(BAR.includes('data-testid="date-range-end"'), 'the end box is addressable');
  assert.ok(BAR.includes('data-testid="date-range-apply"'), 'the apply button is addressable');
});

check('the close button says what it does', () => {
  assert.ok(BAR.includes("aria-label={t('date_range.close')}"), 'an icon button needs a name');
});

check('the bar works out nothing the shared helper already knows', () => {
  assert.ok(
    BAR.includes("from '../../utils/dateRange'"),
    'the presets and the labels come from one place'
  );
  assert.ok(!/new Date\(\)/.test(BAR), 'the bar does no date arithmetic of its own');
});

check('custom is one of the shortcuts the helper offers', () => {
  const presets = RANGE.slice(RANGE.indexOf('export const DATE_PRESETS'), RANGE.indexOf('export function toIsoDate'));
  assert.ok(presets.includes("'custom'"), 'custom is a preset');
});

check('a range is complete only when both dates are there', () => {
  const fn = RANGE.slice(RANGE.indexOf('export function isCustomRangeComplete'), RANGE.indexOf('export function rangeLabel'));
  assert.ok(/start/.test(fn) && /end/.test(fn), 'both dates are required');
});

check('the words for the panel are in every language', () => {
  for (const language of ['id', 'en', 'ja']) {
    const table = read(`i18n/${language}.js`);
    for (const key of ['preset_custom', 'needs_both_dates', 'period_label', 'apply:', 'from:', 'to:']) {
      assert.ok(table.includes(key), `${language} has ${key}`);
    }
  }
});

console.log('');
console.log(`the custom range panel: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
