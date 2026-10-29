/**
 * The quick entry box.
 *
 * Run with: node src/features/transactions/nlp/__tests__/quickEntry.test.js
 *
 * The reader types one line ("makan 45000", "kopi 25000+15000") and
 * expects the amount to be read out of it, and the page to stay up.
 * These are the cases where getting it wrong costs money or breaks
 * the page:
 *
 * - a plain amount written after words is still an amount;
 * - a grouped amount ("1.500.000") is a million, not a thousand and
 *   a half;
 * - a date is a date, not an amount;
 * - a sum is a sum, and the page does not fall over;
 * - a division by zero is not a number, so there is no amount;
 * - a word with a typo is still the word the reader meant.
 */

import { parseAmount, evalMath } from '../parseAmount.js';
import { parseQuickEntry } from '../parseQuickEntry.js';
import { suggestCategory, buildCategoryMap, learnFromCorrection } from '../suggestCategory.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ---------------------------------------------------------------------------
// The amount in a line of words
// ---------------------------------------------------------------------------

check('an amount on its own', parseAmount('45000')?.value, 45000);
check('an amount after words', parseAmount('makan 45000')?.value, 45000);
check('an amount after words, grouped', parseAmount('makan 45.000')?.value, 45000);
check('an amount after words, long', parseAmount('bayar 150000')?.value, 150000);
check('a grouped amount of a million', parseAmount('1.500.000')?.value, 1500000);
check('a grouped amount after words', parseAmount('transfer 1.500.000')?.value, 1500000);
check('an amount with a unit', parseAmount('45rb')?.value, 45000);
check('an amount with a unit and a point', parseAmount('1,5jt')?.value, 1500000);
check('a number too small to be money', parseAmount('kopi 2'), null);
check('a date is not an amount', parseAmount('2026-10-28'), null);
check('a date in a line of words is not an amount', parseAmount('makan 2026-10-28'), null);

// ---------------------------------------------------------------------------
// The sum a reader writes
// ---------------------------------------------------------------------------

check('two numbers added', evalMath('25000+15000'), 40000);
check('a number times a number', evalMath('45000*2'), 90000);
check('a division by zero is not a number', evalMath('100/0'), null);
check('a zero over a zero is not a number', evalMath('0/0'), null);
check('a date is not a sum', evalMath('2026-10-28'), null);

// ---------------------------------------------------------------------------
// The box itself
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 1, name: 'Makanan & Minuman', system_key: 'food' },
  { id: 2, name: 'Belanja', system_key: 'shopping' },
];

function parse(text) {
  try {
    return parseQuickEntry(text, { categories: CATEGORIES });
  } catch (err) {
    return { threw: err.message };
  }
}

check('a sum does not break the box', parse('kopi 25000+15000').threw, undefined);
check('a sum is read as the amount', parse('kopi 25000+15000').amount, 40000);
check('a division by zero does not break the box', parse('kopi 100/0').threw, undefined);
check('a division by zero leaves no amount', parse('kopi 100/0').amount, null);
check('an amount after words is read', parse('makan 45000').amount, 45000);
check('a sum keeps the words around it', parse('kopi 25000+15000').categorySuggestion, 'Makanan & Minuman');

// ---------------------------------------------------------------------------
// A word with a typo
// ---------------------------------------------------------------------------

const map = buildCategoryMap(CATEGORIES);
const typo = suggestCategory(['kopii'], {}, map);
check('a word with a typo is still the word', typo.cat, 'food');

// A word is counted once. When the layers each found the same word,
// the reader would be shown a confidence that is higher than the
// evidence supports.
const doubled = suggestCategory(['makaaan'], {}, buildCategoryMap([
  { id: 1, name: 'Makanan & Minuman', system_key: 'food' },
]));
check('a word is only counted once', doubled.matches.length, 1);
check('a word that is doubled is not more certain', doubled.score <= 0.7, true);

// The hints the reader taught the app are not changed by a correction.
// The correction is returned as a new set, and the old one is left
// as it was, so a correction that is taken back does not leave the
// app remembering it.
const taught = { grab: { transport: { hits: 1 } } };
const corrected = learnFromCorrection(taught, 'grab', 'food', 'transport');
check('the correction is returned', corrected.grab.food.hits, 2);
check('the wrong suggestion is penalised', corrected.grab.transport.hits, 0);
check('the hints the reader taught are left alone', taught.grab.transport.hits, 1);
check('the hints the reader taught do not gain the correction', taught.grab.food, undefined);

console.log(`quickEntry: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
