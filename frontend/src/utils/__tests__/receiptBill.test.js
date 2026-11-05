/**
 * The arithmetic of a receipt must be right to the rupiah.
 *
 * A receipt is a list of things, a discount, a tax and a service
 * charge. What the reader finally pays is worked out from those
 * pieces, and it has to be right, because this is the number that
 * leaves their account.
 *
 * The tax rules are Indonesian, and they are not one rule but
 * several: PB1 Resto at ten percent, the PMK 131/2024 rule where the
 * effective rate is eleven rather than twelve, and the plain twelve
 * percent. Whether the tax is inside the price or on top of it
 * changes what it is charged on.
 *
 * When the bill is shared, the shares must add back up to exactly
 * the whole. The largest remainder method is what guarantees that: no
 * rupiah is invented and none is lost.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const M = await import(path.join(ROOT, 'src/utils/receiptBill.js'));

const rupiah = (n) => `Rp ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

console.log('\nreceiptBill — the arithmetic of a receipt\n');

// ---- the lines of the receipt -----------------------------------------

test('a line is worth the count times the price of one', () => {
  const subtotal = M.lineSubtotal({ quantity: 2, unitPrice: 3500 });
  assert.strictEqual(subtotal, 7000);
});

test('a line with a missing number is worth nothing, not NaN', () => {
  assert.strictEqual(M.lineSubtotal({ quantity: 2 }), 0);
  assert.strictEqual(M.lineSubtotal({ unitPrice: 3500 }), 0);
  assert.strictEqual(M.lineSubtotal({ quantity: 'x', unitPrice: 'y' }), 0);
});

test('the subtotal is the sum of the lines', () => {
  const lines = [
    { quantity: 2, unitPrice: 3500 },
    { quantity: 2, unitPrice: 15000 },
  ];
  assert.strictEqual(M.sumLines(lines), 37000);
});

test('no lines is a subtotal of nothing', () => {
  assert.strictEqual(M.sumLines([]), 0);
  assert.strictEqual(M.sumLines(), 0);
});

// ---- the discount -----------------------------------------------------

test('a discount given in rupiah comes off as it is', () => {
  const amount = M.discountAmount(37000, 5000, 'nominal');
  assert.strictEqual(amount, 5000);
});

test('a discount given as a percent is taken off the subtotal', () => {
  const amount = M.discountAmount(37000, 10, 'percent');
  assert.strictEqual(amount, 3700);
});

test('a discount of nothing is nothing', () => {
  assert.strictEqual(M.discountAmount(37000, 0, 'nominal'), 0);
  assert.strictEqual(M.discountAmount(37000, '', 'nominal'), 0);
});

// ---- the tax ----------------------------------------------------------

test('no tax means no tax', () => {
  const tax = M.computeTax({ subtotal: 37000, taxRuleId: 'none' });
  assert.strictEqual(tax.amount, 0);
  assert.strictEqual(tax.base, 37000);
});

test('PB1 Resto is ten percent of the gross', () => {
  const tax = M.computeTax({ subtotal: 37000, taxRuleId: 'pb1' });
  assert.strictEqual(tax.amount, 3700);
  assert.strictEqual(tax.base, 37000);
});

test('PPN 12% is twelve percent of the gross', () => {
  const tax = M.computeTax({ subtotal: 37000, taxRuleId: 'ppn12' });
  assert.strictEqual(tax.amount, 4440);
});

test('PPN PMK 131/2024 is eleven percent in the end, not twelve', () => {
  const tax = M.computeTax({ subtotal: 37000, taxRuleId: 'ppn131' });
  // The base is 11/12 of the value.
  assert.strictEqual(tax.base, 33917);
  // And the rate that comes out is eleven percent.
  assert.ok(Math.abs(tax.effectiveRate - 11) < 0.001, `effective rate was ${tax.effectiveRate}`);
});

test('a tax that is inside the price is not added on top of it', () => {
  const exclusive = M.computeTax({ subtotal: 37000, taxRuleId: 'ppn12', inclusive: false });
  const inclusive = M.computeTax({ subtotal: 37000, taxRuleId: 'ppn12', inclusive: true });

  assert.strictEqual(exclusive.amount, 4440);
  // Inside the price, the tax is 12/112 of it.
  assert.strictEqual(inclusive.base, 33036);
  assert.strictEqual(inclusive.amount, 3964);
});

test('the tax is charged on what is left after the discount', () => {
  const tax = M.computeTax({ subtotal: 37000, discount: 5000, taxRuleId: 'pb1' });
  assert.strictEqual(tax.base, 32000);
  assert.strictEqual(tax.amount, 3200);
});

// ---- the total --------------------------------------------------------

test('the total is the subtotal, less the discount, plus the tax and the fee', () => {
  const total = M.computeTotal({
    subtotal: 37000,
    discount: 5000,
    taxAmount: 3520,
    fee: 0,
  });
  assert.strictEqual(total, 35520);
});

test('a service charge is added on top', () => {
  const total = M.computeTotal({
    subtotal: 37000,
    discount: 5000,
    taxAmount: 3520,
    fee: 2500,
  });
  assert.strictEqual(total, 38020);
});

test('an inclusive tax is not added again', () => {
  const total = M.computeTotal({
    subtotal: 37000,
    discount: 0,
    taxAmount: 4440,
    fee: 0,
    inclusive: true,
  });
  assert.strictEqual(total, 37000);
});

// ---- the whole bill ---------------------------------------------------

test('the whole bill adds up the way the reader expects', () => {
  const bill = M.computeBill({
    lines: [
      { id: 1, quantity: 2, unitPrice: 3500 },
      { id: 2, quantity: 2, unitPrice: 15000 },
    ],
    discount: 5000,
    discountType: 'nominal',
    taxRuleId: 'pb1',
    fee: 0,
  });

  assert.strictEqual(bill.subtotal, 37000);
  assert.strictEqual(bill.discount, 5000);
  assert.strictEqual(bill.taxBase, 32000);
  assert.strictEqual(bill.taxAmount, 3200);
  assert.strictEqual(bill.total, 35200);
});

test('the discount is taken as a percent when that is how it was given', () => {
  const bill = M.computeBill({
    lines: [{ id: 1, quantity: 1, unitPrice: 100000 }],
    discount: 10,
    discountType: 'percent',
    taxRuleId: 'none',
  });
  assert.strictEqual(bill.discount, 10000);
  assert.strictEqual(bill.total, 90000);
});

// ---- the largest remainder method -------------------------------------

test('splitting a hundred thousand three ways loses nothing', () => {
  const shares = M.largestRemainderSplit(100000, [1, 1, 1]);
  assert.deepStrictEqual(shares, [33334, 33333, 33333]);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 100000);
});

test('splitting in unequal parts still adds back up to the whole', () => {
  const shares = M.largestRemainderSplit(10000, [3, 1]);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 10000);
  assert.strictEqual(shares[0] + shares[1], 10000);
});

test('the share that gets the extra rupiah is the biggest remainder', () => {
  const shares = M.largestRemainderSplit(10, [1, 1, 1]);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 10);
  assert.strictEqual(shares[0], 4);
});

test('splitting nothing is nothing', () => {
  const shares = M.largestRemainderSplit(0, [1, 1, 1]);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 0);
});

// ---- sharing the bill -------------------------------------------------

test('an equal split gives everyone the same, to the rupiah', () => {
  const bill = M.computeBill({
    lines: [{ id: 1, quantity: 1, unitPrice: 100000 }],
    taxRuleId: 'none',
  });
  const split = M.computeSplit({
    bill,
    participants: ['Saya', 'Orang X', 'Orang Y'],
    mode: 'equal',
  });

  assert.strictEqual(split.shares.length, 3);
  assert.strictEqual(
    split.shares.reduce((sum, s) => sum + s.amount, 0),
    100000
  );
  assert.strictEqual(split.owedToHost, split.shares[1].amount + split.shares[2].amount);
});

test('a split by item follows the items to the people they were given to', () => {
  const lines = [
    { id: 1, quantity: 1, unitPrice: 60000 },
    { id: 2, quantity: 1, unitPrice: 40000 },
  ];
  const bill = M.computeBill({ lines, taxRuleId: 'none' });
  const split = M.computeSplit({
    bill: { ...bill, lines },
    participants: ['Saya', 'Orang X'],
    mode: 'byItem',
    assignments: { 1: 'Saya', 2: 'Orang X' },
  });

  const host = split.shares.find((s) => s.name === 'Saya');
  const other = split.shares.find((s) => s.name === 'Orang X');
  assert.strictEqual(host.amount, 60000);
  assert.strictEqual(other.amount, 40000);
  assert.strictEqual(split.owedToHost, 40000);
});

test('a split by item carries the discount and the tax with the items', () => {
  const lines = [
    { id: 1, quantity: 1, unitPrice: 80000 },
    { id: 2, quantity: 1, unitPrice: 20000 },
  ];
  const bill = M.computeBill({
    lines,
    discount: 5000,
    taxRuleId: 'pb1',
  });
  const split = M.computeSplit({
    bill: { ...bill, lines },
    participants: ['Saya', 'Orang X'],
    mode: 'byItem',
    assignments: { 1: 'Orang X', 2: 'Saya' },
  });

  // Every rupiah of the total is somebody's share.
  assert.strictEqual(
    split.shares.reduce((sum, s) => sum + s.amount, 0),
    bill.total
  );
  // The person who was given the bigger item owes more.
  const host = split.shares.find((s) => s.name === 'Saya');
  const other = split.shares.find((s) => s.name === 'Orang X');
  assert.ok(other.amount > host.amount, 'the bigger item should cost more');
});

test('a split with nobody in it is nothing', () => {
  const split = M.computeSplit({ bill: { total: 1000 }, participants: [] });
  assert.strictEqual(split.shares.length, 0);
  assert.strictEqual(split.hostShare, 0);
});

// ---- the price memory -------------------------------------------------

test('the price that was paid before is remembered', () => {
  const memory = M.buildPriceMemory([
    { description: 'Indomie Goreng', amount: 3500, category_id: 6 },
    { description: 'Kopi Susu', amount: 15000, category_id: 9 },
  ]);
  const found = memory.get('indomie goreng');
  assert.strictEqual(found.amount, 3500);
  assert.strictEqual(found.categoryId, 6);
});

test('typing the start of a name brings the price back', () => {
  const memory = M.buildPriceMemory([
    { description: 'Indomie Goreng', amount: 3500 },
    { description: 'Indomie Kuah', amount: 4000 },
  ]);
  const found = M.suggestFromMemory(memory, 'indo');
  assert.strictEqual(found.length, 2);
  assert.strictEqual(M.suggestFromMemory(memory, 'kop')[0]?.name, undefined);
});

test('the memory knows the price of a line inside a receipt', () => {
  // A receipt of two things has no "Indomie" in its description. The
  // line is where the price of the Indomie is written down, so the
  // memory has to look there too, or the reader types "Indomie" and
  // gets nothing back.
  const memory = M.buildPriceMemory([
    {
      description: 'Belanja di Warung',
      amount: 12000,
      items: [
        { name: 'Indomie Goreng', quantity: 2, unit_price: 3500 },
        { name: 'Es Teh', quantity: 1, unit_price: 5000 },
      ],
    },
  ]);
  const found = memory.get('indomie goreng');
  assert.ok(found, 'the line should be remembered');
  assert.strictEqual(found.amount, 3500);
  assert.strictEqual(found.unit, 'pcs');
});

test('a line without a price is not remembered', () => {
  const memory = M.buildPriceMemory([
    {
      description: 'Kosong',
      amount: 100,
      items: [{ name: 'Tanpa Harga', quantity: 1, unit_price: 0 }],
    },
  ]);
  assert.strictEqual(memory.get('tanpa harga'), undefined);
});

test('the memory does not keep a price of nothing', () => {
  const memory = M.buildPriceMemory([
    { description: 'Gratis', amount: 0 },
    { description: '', amount: 5000 },
  ]);
  assert.strictEqual(memory.size, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
