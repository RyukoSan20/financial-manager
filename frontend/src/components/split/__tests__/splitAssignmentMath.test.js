/**
 * The arithmetic of assigning the lines of a receipt to the people at
 * the table.
 *
 * A bill that is shared has to add up. Not nearly, not to within a
 * rounding error: exactly. A hundred thousand rupiah split three ways
 * is 33.334, 33.333 and 33.333, and the three of them add up to a
 * hundred thousand. A rupiah that goes missing is a rupiah somebody
 * has to find.
 *
 * The tax and the discount are charged on the whole receipt, so when
 * the receipt is looked at line by line, each line carries its share
 * of them. A person who had the expensive dish carries more of the
 * tax, because the tax was charged on the expensive dish.
 *
 * The lines of a receipt carry the tax and the discount of the
 * receipt itself, and the lines of a receipt do not carry the tax of
 * a line that was never charged with one. So there are two ways of
 * reading a line:
 *
 *   - a line that says nothing about its tax or its discount keeps
 *     the receipt's own, and the receipt's own is spread over the
 *     lines in proportion to what each line costs;
 *   - a line that says what its tax or its discount is is taken at
 *     its word, because the paper said so.
 *
 * Run with: node src/components/split/__tests__/splitAssignmentMath.test.js
 */

import assert from 'node:assert/strict';
import {
  computeShares,
  equalSplitTotal,
  withBillExtras,
} from '../splitAssignmentMath.js';

let passed = 0;
let failed = 0;
const failures = [];

/**
 * One check.
 *
 * The name is said out loud so that a person reading the output can
 * see which of the properties of the bill are being held.
 */
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed += 1;
    failures.push(`${name}\n    ${err && err.message ? err.message : err}`);
    console.log(`  FAIL ${name}`);
  }
}

/**
 * The sum of a list of numbers.
 */
function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// The bill divided equally
// ---------------------------------------------------------------------------

console.log('');
console.log('the bill divided equally');

check('a hundred thousand among three is 33334, 33333, 33333', () => {
  assert.deepEqual(equalSplitTotal(100000, 3), [33334, 33333, 33333]);
});

check('the three parts add up to the whole bill', () => {
  assert.equal(sum(equalSplitTotal(100000, 3)), 100000);
});

check('the same bill always splits the same way', () => {
  assert.deepEqual(equalSplitTotal(100000, 3), equalSplitTotal(100000, 3));
});

check('a bill with nobody in it has no parts', () => {
  assert.deepEqual(equalSplitTotal(100000, 0), []);
});

check('a bill of one is the whole bill', () => {
  assert.deepEqual(equalSplitTotal(45000, 1), [45000]);
});

// ---------------------------------------------------------------------------
// The shares of everybody, in the equal mode
// ---------------------------------------------------------------------------

const members = [
  { id: 1, name: 'Andi' },
  { id: 2, name: 'Budi' },
  { id: 3, name: 'Citra' },
];

const twoLines = [
  { id: 'a', name: 'Nasi goreng', quantity: 1, unitPrice: 25000, subtotal: 25000 },
  { id: 'b', name: 'Es teh', quantity: 2, unitPrice: 5000, subtotal: 10000 },
];

check('in the equal mode everybody pays the same, to within a rupiah', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: {},
    mode: 'equal',
  });
  assert.equal(result.shares.length, 3);
  const amounts = result.shares.map((share) => share.total);
  const highest = Math.max(...amounts);
  const lowest = Math.min(...amounts);
  assert.ok(
    highest - lowest <= 1,
    `the parts differ by ${highest - lowest}: ${amounts.join(', ')}`
  );
});

check('in the equal mode the parts add up to the total', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: {},
    mode: 'equal',
  });
  assert.equal(sum(result.shares.map((share) => share.total)), result.total);
});

check('in the equal mode the total is the total of the lines', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: {},
    mode: 'equal',
  });
  assert.equal(result.total, 35000);
});

// ---------------------------------------------------------------------------
// The lines decide who pays what
// ---------------------------------------------------------------------------

check('a line belongs to the person it was given to', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: { a: 1, b: 2 },
    mode: 'dynamic',
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[1].total, 25000);
  assert.equal(byId[2].total, 10000);
});

check('a person with no lines owes nothing', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: { a: 1, b: 1 },
    mode: 'dynamic',
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[3].total, 0);
  assert.equal(byId[3].subtotal, 0);
});

check('the shares add up to the total, with no rupiah lost', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: { a: 1, b: 2 },
    mode: 'dynamic',
  });
  assert.equal(sum(result.shares.map((share) => share.total)), result.total);
  assert.equal(result.total, 35000);
});

check('a line that nobody has is left out and counted apart', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: { a: 1 },
    mode: 'dynamic',
  });
  assert.equal(result.unassigned.count, 1);
  assert.equal(result.unassigned.total, 10000);
  assert.equal(sum(result.shares.map((share) => share.total)), 25000);
});

// ---------------------------------------------------------------------------
// The tax of the receipt, shared in proportion to what was eaten
// ---------------------------------------------------------------------------

const taxedLines = [
  { id: 'a', name: 'Steak', quantity: 1, unitPrice: 60000, subtotal: 60000 },
  { id: 'b', name: 'Salad', quantity: 1, unitPrice: 40000, subtotal: 40000 },
];

check('the tax of the receipt is shared in proportion to the lines', () => {
  const result = computeShares({
    items: taxedLines,
    members,
    assignments: { a: 1, b: 2 },
    mode: 'dynamic',
    tax: 2000,
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[1].tax, 1200);
  assert.equal(byId[2].tax, 800);
});

check('the tax and the lines add up to the whole bill', () => {
  const result = computeShares({
    items: taxedLines,
    members,
    assignments: { a: 1, b: 2 },
    mode: 'dynamic',
    tax: 2000,
  });
  assert.equal(sum(result.shares.map((share) => share.total)), 102000);
});

check('a bill with a tax and a discount still adds up', () => {
  const result = computeShares({
    items: taxedLines,
    members,
    assignments: { a: 1, b: 2 },
    mode: 'dynamic',
    tax: 2000,
    discount: 1000,
  });
  assert.equal(result.total, 101000);
  assert.equal(sum(result.shares.map((share) => share.total)), 101000);
});

check('the tax of the receipt is spread over the lines themselves', () => {
  const lines = withBillExtras(taxedLines, 2000, 0);
  assert.equal(lines[0].tax, 1200);
  assert.equal(lines[1].tax, 800);
});

check('the discount of the receipt is spread over the lines themselves', () => {
  const lines = withBillExtras(taxedLines, 0, 3000);
  assert.equal(lines[0].discount, 1800);
  assert.equal(lines[1].discount, 1200);
});

check('the lines with the tax and the discount add up to the bill', () => {
  const lines = withBillExtras(taxedLines, 2000, 3000);
  assert.equal(sum(lines.map((line) => line.total)), 99000);
});

check('a receipt with no lines has no lines to put the tax on', () => {
  assert.deepEqual(withBillExtras([], 2000, 0), []);
});

// ---------------------------------------------------------------------------
// A line that says what its own tax is
// ---------------------------------------------------------------------------

check('a line that names its own tax is taken at its word', () => {
  const result = computeShares({
    items: [
      { id: 'a', name: 'Paket', quantity: 1, unitPrice: 10000, subtotal: 10000, tax: 500 },
    ],
    members,
    assignments: { a: 1 },
    mode: 'dynamic',
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[1].tax, 500);
  assert.equal(byId[1].total, 10500);
});

check('a discount of two thousand on a line of ten thousand comes off that line', () => {
  const result = computeShares({
    items: [
      { id: 'a', name: 'Paket', quantity: 1, unitPrice: 10000, subtotal: 10000, discount: 2000 },
    ],
    members,
    assignments: { a: 1 },
    mode: 'dynamic',
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[1].subtotal, 10000);
  assert.equal(byId[1].discount, 2000);
  assert.equal(byId[1].total, 8000);
});

check('the discount of the bill is spread over the lines in proportion', () => {
  const result = computeShares({
    items: taxedLines,
    members,
    assignments: { a: 1, b: 2 },
    mode: 'dynamic',
    discount: 2000,
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[1].discount, 1200);
  assert.equal(byId[2].discount, 800);
});

check('the discount of the bill comes off the total of the bill', () => {
  const result = computeShares({
    items: [
      { id: 'a', name: 'Paket', quantity: 1, unitPrice: 10000, subtotal: 10000, discount: 2000 },
    ],
    members,
    assignments: { a: 1 },
    mode: 'dynamic',
  });
  assert.equal(result.total, 8000);
  assert.equal(result.bill.discount, 2000);
});

// ---------------------------------------------------------------------------
// A bill that does not divide
// ---------------------------------------------------------------------------

check('a bill of one rupiah among three is not lost', () => {
  const result = computeShares({
    items: [{ id: 'a', name: 'Kopi', quantity: 1, unitPrice: 1, subtotal: 1 }],
    members,
    assignments: { a: 1 },
    mode: 'dynamic',
  });
  assert.equal(sum(result.shares.map((share) => share.total)), 1);
});

check('a bill of a hundred and one among three adds up exactly', () => {
  const result = computeShares({
    items: [{ id: 'a', name: 'Kopi', quantity: 1, unitPrice: 101, subtotal: 101 }],
    members: members.slice(0, 2),
    assignments: { a: 1 },
    mode: 'dynamic',
  });
  assert.equal(sum(result.shares.map((share) => share.total)), 101);
});

check('a member can be given a line by the name of the id as text', () => {
  const result = computeShares({
    items: twoLines,
    members,
    assignments: { a: '1', b: '2' },
    mode: 'dynamic',
  });
  const byId = {};
  for (const share of result.shares) byId[share.memberId] = share;
  assert.equal(byId[1].total, 25000);
  assert.equal(byId[2].total, 10000);
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

console.log('');
console.log(`splitAssignmentMath: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('');
  for (const failure of failures) {
    console.log('  FAIL ' + failure);
  }
}

process.exit(failed ? 1 : 0);
