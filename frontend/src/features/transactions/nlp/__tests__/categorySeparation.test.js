/**
 * The categories of the two kinds of transaction.
 *
 * The sheet that says "Pilih Kategori" showed "Gaji" and "Makanan &
 * Minuman" in one list, so a reader recording an income was offered
 * food, and a reader recording an expense was offered a salary.
 *
 * It happened because the server did not say what kind each category
 * was, and the filter let through anything that did not say. Both are
 * fixed - the server says now, and the filter is strict - and this
 * holds them.
 *
 * What is held here:
 *
 * - an income category is never shown on the expense tab, and an
 *   expense category is never shown on the income tab;
 * - a category that says nothing is still shown, because there is
 *   nothing to be strict about;
 * - the quick pills are of the kind of transaction, and are in the
 *   order the reader uses them;
 * - the date range turns a choice into the two dates the server asks
 *   with, and a range that runs backwards is put the right way round;
 * - and the bar's colour says whether the reader is over the line.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPENSE,
  INCOME,
  TRANSFER,
  categoryMatchesType,
  categoriesForType,
} from '../categoryTypes.js';

import {
  DATE_PRESETS,
  EXPORT_PRESETS,
  rangeForPreset,
  rangeParams,
  resolveRange,
  isCustomRangeComplete,
  rangeLabel,
  exportRange,
  toIsoDate,
} from '../../../../utils/dateRange.js';

import { barColorState } from '../../../../utils/progressColors.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// The repository root.
//
// The test lives at frontend/src/features/transactions/nlp/__tests__/,
// so the root is six levels up: __tests__ -> nlp -> transactions ->
// features -> src -> frontend -> root.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

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

const read = (relative) =>
  readFileSync(join(ROOT, relative), 'utf8');

// ---------------------------------------------------------------------------
// The categories
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 1, name: 'Gaji & Upah', type: 'income' },
  { id: 2, name: 'Freelance & Jasa', type: 'income' },
  { id: 3, name: 'Makanan & Minuman', type: 'expense' },
  { id: 4, name: 'Transportasi', type: 'expense' },
  { id: 5, name: 'Belanja', type: 'expense' },
  { id: 6, name: 'Lainnya', type: 'expense' },
  { id: 7, name: 'Kategori Tanpa Jenis', type: null },
];

check('an income tab never shows an expense category', () => {
  const shown = categoriesForType(CATEGORIES, INCOME);
  const names = shown.map((cat) => cat.name);

  assert.ok(!names.includes('Makanan & Minuman'), names.join(', '));
  assert.ok(!names.includes('Transportasi'), names.join(', '));
  assert.ok(!names.includes('Belanja'), names.join(', '));
});

check('an expense tab never shows an income category', () => {
  const shown = categoriesForType(CATEGORIES, EXPENSE);
  const names = shown.map((cat) => cat.name);

  assert.ok(!names.includes('Gaji & Upah'), names.join(', '));
  assert.ok(!names.includes('Freelance & Jasa'), names.join(', '));
});

check('an income tab shows the income categories', () => {
  const names = categoriesForType(CATEGORIES, INCOME).map((cat) => cat.name);

  assert.ok(names.includes('Gaji & Upah'), names.join(', '));
  assert.ok(names.includes('Freelance & Jasa'), names.join(', '));
});

check('an expense tab shows the expense categories', () => {
  const names = categoriesForType(CATEGORIES, EXPENSE).map((cat) => cat.name);

  assert.ok(names.includes('Makanan & Minuman'), names.join(', '));
  assert.ok(names.includes('Transportasi'), names.join(', '));
});

check('a category that says nothing is still shown', () => {
  // There is nothing to be strict about, and hiding it would hide a
  // category the reader made and can see everywhere else.
  const names = categoriesForType(CATEGORIES, EXPENSE).map((cat) => cat.name);
  assert.ok(names.includes('Kategori Tanpa Jenis'), names.join(', '));

  const incomeNames = categoriesForType(CATEGORIES, INCOME).map((cat) => cat.name);
  assert.ok(incomeNames.includes('Kategori Tanpa Jenis'), incomeNames.join(', '));
});

check('the two tabs share nothing but the untyped ones', () => {
  const expense = categoriesForType(CATEGORIES, EXPENSE);
  const income = categoriesForType(CATEGORIES, INCOME);

  const shared = expense.filter((cat) => income.some((other) => other.id === cat.id));

  for (const cat of shared) {
    assert.ok(!cat.type, `${cat.name} is in both lists`);
  }
});

check('the matching is by kind, not by name', () => {
  assert.equal(categoryMatchesType({ type: 'income' }, INCOME), true);
  assert.equal(categoryMatchesType({ type: 'income' }, EXPENSE), false);
  assert.equal(categoryMatchesType({ type: 'expense' }, EXPENSE), true);
  assert.equal(categoryMatchesType({ type: 'expense' }, INCOME), false);
  assert.equal(categoryMatchesType({ type: null }, EXPENSE), true);
  assert.equal(categoryMatchesType(null, EXPENSE), false);
});

check('a transfer is offered the transfer categories', () => {
  // A transfer moves money between accounts. It is not spending and it
  // is not earning, so it is offered neither of their categories.
  const shown = categoriesForType(CATEGORIES, TRANSFER);
  const names = shown.map((cat) => cat.name);

  assert.ok(!names.includes('Gaji & Upah'), names.join(', '));
  assert.ok(!names.includes('Makanan & Minuman'), names.join(', '));
});

// ---------------------------------------------------------------------------
// The server has to say what kind a category is
// ---------------------------------------------------------------------------

check('the server sends the kind of every category', () => {
  // The bug was here: the answer did not say what kind a category was,
  // so the screen could not tell them apart.
  const source = read('backend/app/api/routes/category_hints.py');

  assert.ok(
    source.includes('"type": getattr(cat, \'type\', None)'),
    'the bootstrap answer does not carry the kind of the category'
  );
});

check('the screen filters strictly', () => {
  const source = read('frontend/src/components/transactions/CategoryTreeSheet.jsx');

  // The old filter let anything that did not say through.
  assert.ok(
    !source.includes("if (type === 'expense') return cat.type !== 'income';"),
    'the filter still lets an income category through on the expense tab'
  );
  assert.ok(
    source.includes("if (type === 'expense') return cat.type === 'expense';"),
    'the filter is not strict on the expense tab'
  );
  assert.ok(
    source.includes("if (type === 'income') return cat.type === 'income';"),
    'the filter is not strict on the income tab'
  );
});

check('the pills are of the kind of transaction', () => {
  const source = read('frontend/src/components/transactions/QuickPillRow.jsx');
  assert.ok(
    source.includes('categoriesForType(categories, type)'),
    'the quick pills are not filtered by the kind of transaction'
  );
});

check('a transfer is offered no wallet pills', () => {
  // A transfer needs two accounts, so a pill that sets one of them
  // does not say which end the reader meant.
  const source = read('frontend/src/components/transactions/QuickPillRow.jsx');
  assert.ok(
    source.includes("if (type === 'transfer') return [];"),
    'a transfer is still offered wallet pills'
  );
});

// ---------------------------------------------------------------------------
// The dates
// ---------------------------------------------------------------------------

const TODAY = new Date(2026, 10, 10); // 10 November 2026

check('the presets are the ones that are offered', () => {
  const keys = DATE_PRESETS.map((preset) => preset.key);
  for (const key of ['today', '7d', 'month', '3m', '6m', '1y', 'custom']) {
    assert.ok(keys.includes(key), `the preset ${key} is missing`);
  }
});

check('today is today', () => {
  const range = rangeForPreset('today', TODAY);
  assert.equal(toIsoDate(range.start), '2026-11-10');
  assert.equal(toIsoDate(range.end), '2026-11-10');
});

check('seven days is seven days', () => {
  const range = rangeForPreset('7d', TODAY);
  assert.equal(toIsoDate(range.start), '2026-11-04');
  assert.equal(toIsoDate(range.end), '2026-11-10');
});

check('this month is this month', () => {
  const range = rangeForPreset('month', TODAY);
  assert.equal(toIsoDate(range.start), '2026-11-01');
  assert.equal(toIsoDate(range.end), '2026-11-30');
});

check('three months starts three months back', () => {
  const range = rangeForPreset('3m', TODAY);
  assert.equal(toIsoDate(range.start), '2026-09-01');
  assert.equal(toIsoDate(range.end), '2026-11-10');
});

check('a year starts a year back', () => {
  const range = rangeForPreset('1y', TODAY);
  assert.equal(toIsoDate(range.start), '2025-11-01');
});

check('a custom range is the two dates the reader typed', () => {
  const resolved = resolveRange(
    { preset: 'custom', start: '2026-10-01', end: '2026-10-31' },
    TODAY,
  );
  assert.equal(resolved.start, '2026-10-01');
  assert.equal(resolved.end, '2026-10-31');
});

check('a range that runs backwards is put the right way round', () => {
  // A reader who typed the dates in the wrong order meant the range
  // between them, not an empty one.
  const resolved = resolveRange(
    { preset: 'custom', start: '2026-10-31', end: '2026-10-01' },
    TODAY,
  );
  assert.equal(resolved.start, '2026-10-01');
  assert.equal(resolved.end, '2026-10-31');
});

check('half a range is not sent to the server', () => {
  // The screen says the range is not ready; the server is not asked
  // about half a range.
  const params = rangeParams({ preset: 'custom', start: '2026-10-01', end: '' }, TODAY);
  assert.deepEqual(params, {});
});

check('a whole range is sent to the server', () => {
  const params = rangeParams(
    { preset: 'custom', start: '2026-10-01', end: '2026-10-31' },
    TODAY,
  );
  assert.equal(params.start_date, '2026-10-01');
  assert.equal(params.end_date, '2026-10-31');
});

check('a preset is sent to the server as its dates', () => {
  const params = rangeParams({ preset: 'month' }, TODAY);
  assert.equal(params.start_date, '2026-11-01');
  assert.equal(params.end_date, '2026-11-30');
});

check('the range is named on the screen', () => {
  assert.equal(rangeLabel({ preset: 'month' }, TODAY), 'Bulan Ini');
  assert.equal(
    rangeLabel({ preset: 'custom', start: '2026-10-01', end: '2026-10-31' }, TODAY),
    '2026-10-01 s/d 2026-10-31',
  );
});

check('a half a range says it is not ready', () => {
  assert.equal(
    isCustomRangeComplete({ preset: 'custom', start: '2026-10-01', end: '' }),
    false,
  );
  assert.equal(
    isCustomRangeComplete({ preset: 'custom', start: '2026-10-01', end: '2026-10-31' }),
    true,
  );
});

// ---------------------------------------------------------------------------
// The export ranges
// ---------------------------------------------------------------------------

check('the export presets are the ones that are offered', () => {
  const keys = EXPORT_PRESETS.map((preset) => preset.key);
  for (const key of ['month', 'lastMonth', '3m', 'year', 'all', 'custom']) {
    assert.ok(keys.includes(key), `the export preset ${key} is missing`);
  }
});

check('all time has no dates at all', () => {
  // "Semua Waktu" is the whole of the reader's history, which is not
  // the same as an empty range.
  const range = exportRange('all', {}, TODAY);
  assert.equal(range.start, null);
  assert.equal(range.end, null);
});

check('last month is last month', () => {
  const range = exportRange('lastMonth', {}, TODAY);
  assert.equal(range.start, '2026-10-01');
  assert.equal(range.end, '2026-10-31');
});

check('this year is this year', () => {
  const range = exportRange('year', {}, TODAY);
  assert.equal(range.start, '2026-01-01');
});

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

check('the bar is calm when it is under eighty per cent', () => {
  assert.equal(barColorState(0), 'idle');
  assert.equal(barColorState(50), 'good');
  assert.equal(barColorState(80), 'good');
});

check('the bar warns over eighty per cent', () => {
  assert.equal(barColorState(81), 'warn');
  assert.equal(barColorState(99), 'warn');
});

check('the bar shouts over a hundred', () => {
  assert.equal(barColorState(100.1), 'over');
  assert.equal(barColorState(250), 'over');
});

check('a bar that measures a gain never goes over', () => {
  assert.equal(barColorState(120, { over: false }), 'warn');
});

check('a number that is not a number has no colour', () => {
  assert.equal(barColorState('not a number'), 'idle');
  assert.equal(barColorState(undefined), 'idle');
});
