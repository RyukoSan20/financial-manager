/**
 * The sub-categories, as the reader sees them.
 *
 * The sheet used to be a tall plain list of lines of text under each
 * category, and the reader was scrolling through it. It is a grid of
 * pastel pills now, so the whole set can be seen at once.
 *
 * And there was a broken entry: "Pesan Antar (Delivery)" was showing
 * as two items, "Minuman" and "Antar", because the name had been cut
 * in half somewhere along the way. A reader who wanted to record a
 * delivery was shown a choice of two pieces of a word.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUB_CATEGORIES, subCategoriesFor } from '../subCategories.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..');

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
// The names
// ---------------------------------------------------------------------------

check('the delivery is one whole name', () => {
  const names = SUB_CATEGORIES.food_drink.map((sub) => sub.name);
  assert.ok(
    names.includes('Pesan Antar (Delivery)'),
    `the delivery is not one whole name: ${JSON.stringify(names)}`
  );
  assert.ok(
    !names.includes('Antar'),
    'the delivery is still split in half'
  );
});

check('the food list has no half-names', () => {
  for (const sub of SUB_CATEGORIES.food_drink) {
    assert.ok(sub.name.trim().length > 2, `"${sub.name}" is too short to be a name`);
    assert.ok(
      !/^\s|\s$/.test(sub.name),
      `"${sub.name}" has space at its edge`
    );
  }
});

check('the dictionary and the parser agree on the delivery', () => {
  const dictionary = read('src/data/categoryDictionary.js');
  assert.ok(
    /name: 'Pesan Antar \(Delivery\)'/.test(dictionary),
    'the dictionary does not have the delivery as one name'
  );
  assert.ok(
    !/name: 'Antar'/.test(dictionary),
    'the dictionary still has the broken name'
  );
});

check('every sub-category of food has words to find it by', () => {
  for (const sub of SUB_CATEGORIES.food_drink) {
    assert.ok(
      Array.isArray(sub.words) && sub.words.length > 0,
      `"${sub.name}" has no words to find it by`
    );
  }
});

check('the sheet offers the sub-categories of the category', () => {
  const subs = subCategoriesFor('food_drink');
  assert.ok(subs.length >= 6, `only ${subs.length} sub-categories of food`);
  assert.ok(
    subs.some((sub) => sub.name === 'Pesan Antar (Delivery)'),
    'the sheet does not offer the delivery'
  );
});

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

check('the sub-categories are a grid of pills, not a list of lines', () => {
  const sheet = read('src/components/transactions/CategoryTreeSheet.jsx');
  assert.ok(
    /grid grid-cols-2 sm:grid-cols-3 gap-2/.test(sheet),
    'the sub-categories are not in a grid'
  );
  assert.ok(
    /bg-emerald-50\/40/.test(sheet),
    'the grid has no pastel behind it'
  );
});

check('the pills have the hover and the chosen state', () => {
  const sheet = read('src/components/transactions/CategoryTreeSheet.jsx');
  for (const fragment of [
    'px-3 py-2 rounded-lg border',
    'border-slate-200 bg-white',
    'hover:border-emerald-400',
    'hover:bg-emerald-50/80',
    'hover:shadow-sm',
    'hover:-translate-y-0.5',
    'cursor-pointer',
    'border-emerald-500 bg-emerald-500/10',
    'ring-1 ring-emerald-500',
  ]) {
    assert.ok(
      sheet.includes(fragment),
      `the pill has no "${fragment}"`
    );
  }
});

check('the name of a sub-category is never cut short', () => {
  const sheet = read('src/components/transactions/CategoryTreeSheet.jsx');
  assert.ok(
    /whitespace-normal/.test(sheet),
    'the name of a sub-category is cut short'
  );
  assert.ok(
    !/truncate/.test(sheet.split('subs.map')[1]?.split('})')[0] || ''),
    'the name of a sub-category is truncated'
  );
});

check('the sheet filters the categories by the kind of transaction', () => {
  const sheet = read('src/components/transactions/CategoryTreeSheet.jsx');
  assert.ok(
    /type === 'income'/.test(sheet),
    'the sheet offers income categories for an expense'
  );
});
