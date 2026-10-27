/**
 * The amount a reader types.
 *
 * Run with: node src/utils/__tests__/amountInput.test.js
 *
 * The amount has to survive the currency, the grouping and the
 * keyboard. These are the cases where getting it wrong loses money:
 *
 * - a dollar amount of 12.50 has to stay 12.50, not become 12;
 * - a rupiah amount of 12.50 is 1250, not 12, because rupiah has no
 *   cents and the old code threw the digits away;
 * - the reader may type a comma, which is a grouping mark;
 * - pressing a quick amount twice is twice that amount.
 */

import {
  sanitizeAmount,
  formatAmountInput,
  parseAmount,
  addAmount,
  amountDecimals,
} from '../amountInput.js';

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
// How many decimals each currency has
// ---------------------------------------------------------------------------

check('rupiah has no cents', amountDecimals('IDR'), 0);
check('yen has no cents', amountDecimals('JPY'), 0);
check('dollars have two cents', amountDecimals('USD'), 2);
check('an unknown currency falls back to rupiah', amountDecimals('XYZ'), 0);

// ---------------------------------------------------------------------------
// sanitizeAmount: what survives being typed
// ---------------------------------------------------------------------------

check('digits survive', sanitizeAmount('12000', 'IDR'), '12000');
check('a grouping mark is removed', sanitizeAmount('12.000', 'IDR'), '12000');
check('letters are removed', sanitizeAmount('12abc', 'IDR'), '12');

// A rupiah amount has no cents, so the digits after the point are
// the ones the reader typed, not a fraction.
check('rupiah keeps the digits after the point', sanitizeAmount('12.50', 'IDR'), '1250');
check('rupiah drops a trailing point', sanitizeAmount('12.', 'IDR'), '12');

// A currency with cents keeps the point.
check('dollars keep the point', sanitizeAmount('12.50', 'USD'), '12.50');
check('dollars keep one point only', sanitizeAmount('12.5.6', 'USD'), '12.56');
check('dollars keep no more than two decimals', sanitizeAmount('12.567', 'USD'), '12.56');
check('dollars keep a trailing point', sanitizeAmount('12.', 'USD'), '12.');
check('dollars drop a comma', sanitizeAmount('1,234.50', 'USD'), '1234.50');

// ---------------------------------------------------------------------------
// formatAmountInput: how it is shown
// ---------------------------------------------------------------------------

check('rupiah is grouped with a dot', formatAmountInput('1250000', 'IDR'), '1.250.000');
check('dollars are grouped with a comma', formatAmountInput('1250000', 'USD'), '1,250,000');
check('an empty amount stays empty', formatAmountInput('', 'IDR'), '');
check('dollars show the point when it is typed', formatAmountInput('12.', 'USD'), '12.');
check('a whole dollar amount shows no point', formatAmountInput('12', 'USD'), '12');
check('rupiah shows no point', formatAmountInput('12', 'IDR'), '12');

// ---------------------------------------------------------------------------
// parseAmount: how it is read back
// ---------------------------------------------------------------------------

check('a plain number is read', parseAmount('12000', 'IDR'), 12000);
check('a grouped rupiah number is read', parseAmount('1.250.000', 'IDR'), 1250000);
check('a grouped dollar number is read', parseAmount('1,250,000.25', 'USD'), 1250000.25);
check('an empty amount is zero', parseAmount('', 'IDR'), 0);
check('a dollar amount keeps its cents', parseAmount('12.50', 'USD'), 12.5);
check('a rupiah amount is a whole number', parseAmount('1250', 'IDR'), 1250);

// ---------------------------------------------------------------------------
// addAmount: the quick amount buttons
// ---------------------------------------------------------------------------

check('a quick amount adds to what is there', addAmount('10000', 5000, 'IDR'), '15000');
check('a quick amount on an empty field is the amount itself', addAmount('', 5000, 'IDR'), '5000');
check('two quick amounts add up', addAmount('5000', 5000, 'IDR'), '10000');
check('dollars keep their cents when adding', addAmount('12.50', 0.25, 'USD'), '12.75');
check('the sum is not left with a floating point tail', addAmount('0.10', 0.20, 'USD'), '0.3');

// ---------------------------------------------------------------------------

console.log(`amountInput: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
