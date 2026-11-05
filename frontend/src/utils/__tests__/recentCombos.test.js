/**
 * The chips of recent things must not be the same thing three times.
 *
 * The chips under the quick entry are the reader's own history: the
 * things they bought before, with the price they paid. They are the
 * shortcuts back to a transaction that is already done.
 *
 * When the reader buys the same kind of thing three times, the chips
 * that used to be there were three copies of one thing: the same
 * category, the same account, the same price, and a description that
 * was the name of the category rather than the name of the thing.
 *
 * The fix has two parts. The chips are deduplicated by what they
 * actually are, and the chip says what was bought rather than the
 * name of the category it was filed under.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const { dedupeRecentCombos, describeCombo, comboKey } = await import(
  path.join(ROOT, 'src/utils/recentCombos.js')
);

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
  }
}

check('the same thing three times is one chip', () => {
  const combos = [
    { category_id: 1, account_id: 2, amount: 42000, description: 'Makanan & Minuman' },
    { category_id: 1, account_id: 2, amount: 42000, description: 'Makanan & Minuman' },
    { category_id: 1, account_id: 2, amount: 42000, description: 'Makanan & Minuman' },
  ];
  const deduped = dedupeRecentCombos(combos);
  assert.strictEqual(deduped.length, 1);
});

check('the same thing with a different price is still one chip', () => {
  // The history is written newest first, so the first of a kind is
  // the one that was paid for last.
  const combos = [
    { category_id: 1, account_id: 2, amount: 35000, description: 'Makanan' },
    { category_id: 1, account_id: 2, amount: 42000, description: 'Makanan' },
  ];
  const deduped = dedupeRecentCombos(combos);
  assert.strictEqual(deduped.length, 1);
  // The newest one wins, because that is the price that was paid last.
  assert.strictEqual(deduped[0].amount, 35000);
});

check('different things are different chips', () => {
  const combos = [
    { category_id: 1, account_id: 2, amount: 42000, description: 'Makanan' },
    { category_id: 3, account_id: 2, amount: 42000, description: 'Transport' },
    { category_id: 1, account_id: 4, amount: 42000, description: 'Makanan' },
  ];
  const deduped = dedupeRecentCombos(combos);
  assert.strictEqual(deduped.length, 3);
});

check('the chip says what was bought, not the category it was filed under', () => {
  const combo = { category_id: 1, account_id: 2, amount: 42000, description: 'Indomie Goreng' };
  assert.strictEqual(describeCombo(combo, { name: 'Makanan & Minuman' }), 'Indomie Goreng');
});

check('the chip falls back to the category when there is nothing else', () => {
  const combo = { category_id: 1, account_id: 2, amount: 42000, description: '' };
  assert.strictEqual(describeCombo(combo, { name: 'Makanan & Minuman' }), 'Makanan & Minuman');
});

check('the chip does not show the name of the category twice', () => {
  const combo = { category_id: 1, account_id: 2, amount: 42000, description: 'Makanan & Minuman' };
  // The description happens to be the name of the category. It is
  // still the description, and it is shown once.
  assert.strictEqual(describeCombo(combo, { name: 'Makanan & Minuman' }), 'Makanan & Minuman');
});

check('the key of a chip is what makes it the same chip', () => {
  const a = { category_id: 1, account_id: 2, amount: 42000, description: 'Indomie' };
  const b = { category_id: 1, account_id: 2, amount: 99000, description: 'Indomie' };
  assert.strictEqual(comboKey(a), comboKey(b));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
