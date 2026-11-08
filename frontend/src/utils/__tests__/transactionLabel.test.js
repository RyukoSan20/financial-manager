/**
 * A salary is not a kind of lunch.
 *
 * A reader was shown "Gaji" under their "Makan Siang". The
 * transaction was an expense of Rp 25.000 for a meal, and it carried
 * the id of the salary category - an income category - so the line
 * under the description said that their lunch was salary.
 *
 * Two things let it happen, and both are now shut.
 *
 * The server took whatever category id it was given, without asking
 * whether the category was the right kind for the transaction. An
 * expense could be filed under an income, and a transfer under
 * either.
 *
 * And the browser drew the line under the description from whatever
 * was in the tag, without asking whether the tag belonged to the
 * category it was shown beside. So even a transaction that had the
 * right category could be shown with the wrong sub-label.
 */

import assert from 'node:assert/strict';

import { transactionSubCategory, transactionLabel } from '../transactionLabel.js';

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

const FOOD = {
  id: 6,
  name: 'Makanan & Minuman',
  system_key: 'food_drink',
  type: 'expense',
};
const SALARY = {
  id: 1,
  name: 'Gaji',
  system_key: 'salary',
  type: 'income',
};

// ---------------------------------------------------------------------------
// The browser
// ---------------------------------------------------------------------------

check('a salary is not the sub-label of a meal', () => {
  // The exact case from the report: the transaction is an expense
  // under the salary category, and the tag says "meals".
  const sub = transactionSubCategory(
    { type: 'expense', tags: 'meals' },
    SALARY
  );
  assert.equal(sub, null, 'the salary was used as the sub-label');
});

check('a sub-label that belongs to the category is shown', () => {
  const sub = transactionSubCategory(
    { type: 'expense', tags: 'meals' },
    FOOD
  );
  assert.equal(sub, 'Makan Pagi/Siang/Malam');
});

check('the line under the description is the category and its sub-category', () => {
  const label = transactionLabel({
    tx: { type: 'expense', tags: 'meals' },
    category: FOOD,
    account: { name: 'BCA' },
    language: 'id',
  });
  assert.ok(label.includes('Makanan & Minuman'), label);
  assert.ok(label.includes('Makan Pagi/Siang/Malam'), label);
});

check('the line is the category alone when there is no sub-category', () => {
  const label = transactionLabel({
    tx: { type: 'expense', tags: '' },
    category: FOOD,
    account: { name: 'BCA' },
    language: 'id',
  });
  assert.equal(label, 'Makanan & Minuman');
});

check('a tag from another category is left out', () => {
  // "coffee_cafe" is a sub-category of food, not of transport. It
  // must not be shown under a bus fare.
  const label = transactionLabel({
    tx: { type: 'expense', tags: 'coffee_cafe' },
    category: {
      id: 7,
      name: 'Transportasi',
      system_key: 'transportation',
      type: 'expense',
    },
    account: { name: 'BCA' },
    language: 'id',
  });
  assert.equal(label, 'Transportasi');
});

check('a tag that is nothing is left out', () => {
  const label = transactionLabel({
    tx: { type: 'expense', tags: 'urgent,important' },
    category: FOOD,
    account: { name: 'BCA' },
    language: 'id',
  });
  assert.equal(label, 'Makanan & Minuman');
});

check('a transaction with no category falls back to the account', () => {
  const label = transactionLabel({
    tx: { type: 'expense', tags: 'meals' },
    category: null,
    account: { name: 'BCA' },
    language: 'id',
    unknown: '-',
  });
  assert.equal(label, 'BCA');
});

check('a transaction with no category and no account says so', () => {
  const label = transactionLabel({
    tx: { type: 'expense' },
    category: null,
    account: null,
    language: 'id',
    unknown: 'Tidak diketahui',
  });
  assert.equal(label, 'Tidak diketahui');
});
