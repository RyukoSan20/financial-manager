/**
 * The itemised receipt, and the three numbers on it.
 *
 * A receipt has a subtotal, a discount and a tax, and the net is
 * what comes out of them. The screen shows the net while the reader
 * is still typing, and the server works it out again when the
 * receipt is saved. If the two rules were different, the number on
 * the screen would change when it was saved, and the reader would
 * not trust either of them.
 *
 * So the rule is checked here, and the odd cases are the point:
 * a discount that is bigger than the subtotal, a line that counts
 * nothing, and a receipt that is empty.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const { netTotal, subtotalOf } = await import(path.join(ROOT, 'src/utils/receiptMath.js'));

/* --- the plain case ---------------------------------------------------- */

const items = [
  { name: 'AYAM PANGGANG', quantity: 2, unit_price: 35000 },
  { name: 'NASI', quantity: 1, unit_price: 25000 },
  { name: 'RED VELVET LATTE', quantity: 1, unit_price: 28000 },
];

assert.strictEqual(subtotalOf(items), 2 * 35000 + 25000 + 28000);
assert.strictEqual(netTotal(items, 0, 0), 2 * 35000 + 25000 + 28000);

/* --- the discount and the tax ------------------------------------------ */

// 10% off, and 11% tax on what is left.
const subtotal = subtotalOf(items);
assert.strictEqual(netTotal(items, 5000, 1100), subtotal - 5000 + 1100);

// The tax is added, not taken away.
assert.ok(netTotal(items, 0, 5000) > subtotal);

/* --- the odd cases ----------------------------------------------------- */

// A receipt with nothing on it.
assert.strictEqual(subtotalOf([]), 0);
assert.strictEqual(netTotal([], 0, 0), 0);
assert.strictEqual(netTotal([], 1000, 500), -500);

// A line that counts nothing is worth nothing.
assert.strictEqual(subtotalOf([{ quantity: 0, unit_price: 50000 }]), 0);

// A line with no count is one of them, not none.
assert.strictEqual(subtotalOf([{ unit_price: 5000 }]), 5000);

// A line with no price is worth nothing.
assert.strictEqual(subtotalOf([{ quantity: 3, unit_price: 0 }]), 0);

// A discount line is not part of the subtotal. The discount is a
// number of its own, and counting it twice would take it off twice.
const withDiscountLine = [...items, { name: 'DISKON', quantity: 1, unit_price: -5000, is_discount: true }];
assert.strictEqual(subtotalOf(withDiscountLine), subtotal);

/* --- the numbers are money -------------------------------------------- */

// Money is rounded to two places, and a receipt that adds up to a
// fraction of a rupiah is a receipt that has been typed by hand.
const third = [{ quantity: 1, unit_price: 33.333 }];
assert.strictEqual(subtotalOf(third), 33.33);

// Nothing becomes zero rather than NaN.
assert.strictEqual(netTotal(null, null, null), 0);
assert.strictEqual(netTotal(undefined, 'x', 'y'), 0);

console.log('receipt editor: all checks passed');
