/**
 * The panel that adds a receipt.
 *
 * The reading of a dish is the part that can be wrong quietly. A
 * reader types "40.000" and means forty thousand rupiah, and a
 * program that reads it as forty would make the bill wrong in a way
 * nobody would notice until the money was asked for.
 *
 * The arithmetic of a dish is also worth writing down: a line of two
 * coffees at 8.000 costs 16.000, and a line where the reader gave
 * the total of the line costs what they said it costs.
 *
 * Run with: node src/components/split/__tests__/addReceipt.test.js
 */

import { parseIndonesianAmount } from '../splitMath.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * The number the reader typed, as a number.
 *
 * This mirrors what the panel does. The panel and this file are
 * kept in step by the panel reading the same helper the rest of the
 * feature uses.
 */
function readAmount(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/k$/i, '000');
  if (!cleaned) return 0;

  const parsed = parseIndonesianAmount(cleaned);
  if (parsed !== null && Number.isFinite(parsed)) return parsed;

  const value = Number(cleaned.replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

/**
 * What the dish costs in all.
 */
function dishTotal(dish) {
  const given = readAmount(dish.totalPrice);
  if (given > 0) return given;
  return readAmount(dish.unitPrice) * (readAmount(dish.quantity) || 1);
}

// --- a number, the way a reader writes it ----------------------------

check('forty thousand, written with a dot', readAmount('40.000'), 40000);
check('forty thousand, written plainly', readAmount('40000'), 40000);
check('forty thousand, in rupiah', readAmount('Rp 40.000'), 40000);
check('eight thousand, with a k', readAmount('8k'), 8000);
check('a plain number', readAmount('15000'), 15000);
check('nothing at all', readAmount(''), 0);
check('nothing typed', readAmount(undefined), 0);
check('a number with spaces', readAmount(' 40 000 '), 40000);
check('a number with a comma and a dot', readAmount('150.000,50'), 150000.5);
check('a number with a comma and a dot, the other way', readAmount('150,000.50'), 150000.5);

// --- what a dish costs in all ----------------------------------------

check(
  'a line of two coffees',
  dishTotal({ quantity: '2', unitPrice: '8000', totalPrice: '' }),
  16000,
);

check(
  'a line where the reader gave the total of the line',
  dishTotal({ quantity: '3', unitPrice: '8000', totalPrice: '25.000' }),
  25000,
);

check(
  'a line with no price at all',
  dishTotal({ quantity: '1', unitPrice: '', totalPrice: '' }),
  0,
);

check(
  'a line where the count was left out',
  dishTotal({ quantity: '', unitPrice: '8000', totalPrice: '' }),
  8000,
);

// --- the totals of the whole receipt ---------------------------------

/**
 * The same arithmetic the panel does when it shows the totals.
 */
function totalsOf(dishes) {
  const sumOf = (kind) =>
    dishes
      .filter((dish) => dish.kind === kind)
      .reduce((sum, dish) => sum + dishTotal(dish), 0);
  const items = sumOf('item');
  const tax = sumOf('tax');
  const service = sumOf('service');
  const discount = sumOf('discount');
  return {
    subtotal: items,
    tax,
    service,
    discount,
    grandTotal: items + tax + service - discount,
  };
}

const withExtras = totalsOf([
  { kind: 'item', quantity: '1', unitPrice: '40.000', totalPrice: '' },
  { kind: 'item', quantity: '1', unitPrice: '60.000', totalPrice: '' },
  { kind: 'tax', quantity: '1', unitPrice: '10.000', totalPrice: '' },
]);

check('the dishes add up', withExtras.grandTotal, 110000);
check('the tax is set aside', withExtras.tax, 10000);
check('the dishes without the tax', withExtras.subtotal, 100000);

const withDiscount = totalsOf([
  { kind: 'item', quantity: '1', unitPrice: '40.000', totalPrice: '' },
  { kind: 'item', quantity: '1', unitPrice: '60.000', totalPrice: '' },
  { kind: 'discount', quantity: '1', unitPrice: '20.000', totalPrice: '' },
]);

check('a discount is set aside', withDiscount.discount, 20000);
check('the dishes are what they are', withDiscount.subtotal, 100000);
check('a discount comes off the total', withDiscount.grandTotal, 80000);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed:\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(`addReceipt: ${passed} checks passed`);
