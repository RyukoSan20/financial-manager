/**
 * The receipt the reader wrote on the add page must be saved.
 *
 * The editor on `/add` was complete: it took the lines of a receipt,
 * the count and the price of one, a category for each line, the
 * discount, the tax and the service charge, and it could share the
 * bill between the people at the table. It was also, entirely, a
 * drawing. The save handler took the amount, the category and the
 * description and left the receipt behind, so everything the reader
 * typed into the table was thrown away when the page was closed.
 *
 * A reader who writes down what they bought and what the tax was, and
 * then finds that only one number was kept, is right to stop trusting
 * the page.
 *
 * These checks hold the save down:
 *
 * - the lines are sent, each with its count, its price and its
 *   category;
 * - the discount, the tax and the service charge are sent, and the
 *   total that is sent is the one that was worked out on the screen;
 * - the split is sent, with who had what;
 * - a receipt with no lines on it sends no receipt at all, so the
 *   ordinary transaction is not given a receipt it never had.
 *
 * Run with: node src/components/transactions/__tests__/billSave.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;

const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}\n       ${err.message}`);
  }
};

console.log('\nthe receipt on the add page is saved\n');

const page = read('src/components/layout/AddTransactionPage.jsx');
const editor = read('src/components/transactions/ItemizedBillEditor.jsx');
const review = read('src/components/transactions/ReceiptReviewModal.jsx');
const billSource = read('src/utils/receiptBill.js');
const bill = await import(path.join(ROOT, 'src/utils/receiptBill.js'));

// The three language tables, read up front so that the checks below can
// be ordinary functions.
const languages = {};
for (const lang of ['id', 'en', 'ja']) {
  languages[lang] = (await import(path.join(ROOT, `src/i18n/${lang}.js`))).default;
}

/**
 * A key inside the `bill` section of a language table.
 */
const billKey = (table, key) =>
  key
    .split('.')
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), table.bill);

// ---------------------------------------------------------------------
// The editor has to hand the bill upwards
// ---------------------------------------------------------------------

check('the editor tells the page what the bill came to', () => {
  assert.ok(
    /onBillChange/.test(editor) && /onBillChange/.test(page),
    'the discount, the tax and the fee live inside the editor, so the page cannot save them unless the editor hands them over'
  );
});

check('the page keeps the bill it is given', () => {
  assert.ok(
    /const \[bill, setBill\] = useState/.test(page),
    'the page has to hold the bill, because the save handler is the page'
  );
});

check('the editor tells the page about the split as well', () => {
  assert.ok(/onSplitChange/.test(editor) && /onSplitChange/.test(page));
});

// ---------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------

check('the lines of the receipt are sent with the transaction', () => {
  assert.ok(/items:/.test(page) && /bill\?\.lines|bill\.lines/.test(page),
    'the lines are the receipt, and without them the receipt is lost');
});

check('each line carries its count, its price and its category', () => {
  assert.ok(/quantity/.test(page) && /unit_price/.test(page) && /category_id/.test(page));
});

check('the discount is sent', () => {
  assert.ok(/discount_total/.test(page));
});

check('the tax is sent', () => {
  assert.ok(/tax_total/.test(page));
});

check('the service charge is sent', () => {
  assert.ok(/service_charge/.test(page));
});

check('the amount that is sent is the total of the receipt, not a stale field', () => {
  assert.ok(/bill\?\.total|bill\.total/.test(page),
    'the amount on the screen and the amount that is saved must be the same number');
});

check('the receipt is written to the transaction after it is made', () => {
  assert.ok(/writeReceiptItems/.test(page),
    'the three numbers of a receipt live on the receipt, not only on the transaction');
});

check('the shared bill is made when the bill is shared', () => {
  assert.ok(/createExpense/.test(page),
    'a reader who shares a bill expects it to be in the shared bill');
});

check('a receipt with no lines sends no receipt', () => {
  assert.ok(/bill\?\.lines\.length|lines\.length > 0/.test(page),
    'a transaction that never had a receipt must not be given one');
});

// ---------------------------------------------------------------------
// The arithmetic that is sent must be the arithmetic that is shown
// ---------------------------------------------------------------------

check('the total the reader sees is the total that is computed in one place', () => {
  const computed = bill.computeBill({
    lines: [{ id: 1, quantity: 2, unitPrice: 3500 }],
    discount: 500,
    discountType: 'nominal',
    taxRuleId: 'pb1',
    fee: 1000,
  });
  // 7000 of goods, less 500 of discount, plus 650 of tax, plus 1000
  // of service charge.
  assert.strictEqual(computed.subtotal, 7000);
  assert.strictEqual(computed.taxBase, 6500);
  assert.strictEqual(computed.taxAmount, 650);
  assert.strictEqual(computed.total, 8150);
});

check('the tax of the receipt is charged on what is left after the discount', () => {
  const computed = bill.computeBill({
    lines: [{ id: 1, quantity: 1, unitPrice: 100000 }],
    discount: 10000,
    taxRuleId: 'pb1',
  });
  assert.strictEqual(computed.taxBase, 90000);
  assert.strictEqual(computed.taxAmount, 9000);
});

// ---------------------------------------------------------------------
// The labels on the buttons have to be words, not keys
// ---------------------------------------------------------------------

check('every label the editor asks for exists in every language', () => {
  // The keys themselves are written down in the arithmetic, and the
  // editor asks for them by name.
  const asks = [...billSource.matchAll(/labelKey:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(asks.length > 0, 'the rules are asked for by key');
  assert.ok(
    asks.every((key) => editor.includes(`\${rule.labelKey}`) || editor.includes('labelKey')),
    'the editor reads the key from the rule'
  );

  for (const lang of ['id', 'en', 'ja']) {
    for (const key of asks) {
      // The editor asks for `bill.tax.none`, so the file has to hold
      // `bill.tax.none`. A key that is asked for by the wrong name
      // shows the reader the key itself.
      const value = billKey(languages[lang], key);
      assert.ok(
        typeof value === 'string' && value.length > 0,
        `${lang}.bill.${key} is missing, so the reader would see the key`
      );
    }
  }
});

check('the units of measure are named in every language', () => {
  const asks = [...billSource.matchAll(/labelKey:\s*'([^']+)'/g)].map((m) => m[1]);
  const units = asks.filter((key) => key.startsWith('units.'));
  assert.ok(units.length > 0, 'the units of measure are asked for by key');

  for (const lang of ['id', 'en', 'ja']) {
    for (const key of units) {
      const value = billKey(languages[lang], key);
      assert.ok(
        typeof value === 'string' && value.length > 0,
        `${lang}.bill.${key} is missing, so the reader would see the key`
      );
    }
  }
});

check('the split bill is sent with the numbers that were worked out', () => {
  // The subtotal, the tax, the service charge and the discount of the
  // bill must all reach the split expense. A bill that is saved with a
  // zero subtotal and a zero tax is a bill that cannot be settled,
  // because the shares were worked out from the total alone.
  // The split expense is written with these names, and the server
  // reads them by these names.
  for (const field of ['subtotal', 'tax', 'service_charge', 'discount', 'grand_total']) {
    assert.ok(
      new RegExp(`\\b${field}:`).test(page),
      `the split expense is sent without ${field}`
    );
  }

  // The bill report the editor hands over must carry the numbers, so
  // that the split expense is not written with zeroes.
  for (const field of ['subtotal', 'taxAmount', 'feeAmount', 'discountAmount']) {
    assert.ok(
      new RegExp(`\\b${field}:`).test(editor),
      `the bill report does not carry ${field}`
    );
  }

  // The bill must be tied to the transaction it was made for, so that
  // the two are the same thing and not two halves of one purchase.
  assert.ok(
    /transaction_id:\s*transactionId/.test(page) ||
    page.includes('transactionId'),
    'the split bill is not tied to the transaction'
  );
});

check('a transaction that is already written down still gets its bill', () => {
  /**
   * When the reader shares a transaction that is already on record,
   * the transaction is not made again - only the bill is made, and it
   * points at the transaction that is already there.
   *
   * But the bill has to be made. A reader who opens the receipt of a
   * purchase, shares it, and presses save, expects the people to owe
   * what they owe. If the bill is quietly dropped, the sharing is
   * lost with nothing to show that it ever happened.
   */
  const branch = review.slice(
    review.indexOf('if (reading?.transaction_id)'),
    review.indexOf('const created = await api.transactions.create')
  );
  assert.ok(branch.length > 0, 'the branch for a transaction that is already there was not found');
  assert.ok(
    /makeSplitBill\s*\(/.test(branch),
    'the shared bill is not made when the transaction is already written down'
  );

  // The bill must point at the transaction it belongs to.
  assert.ok(
    /transaction_id:\s*transactionId/.test(review) ||
    /transaction_id:\s*reading\.transaction_id/.test(review),
    'the bill is not tied to the transaction'
  );
});

check('a reading with no lines still shows what was read', () => {
  /**
   * A spoken transaction is one amount and one description. It has no
   * lines, because nothing was read off a list of items.
   *
   * But the reader still has to be able to look at it. A review form
   * with an empty table and a total of zero says nothing about what
   * was heard, and saving it is refused because the total is nothing.
   * So the amount that was read becomes one line, which the reader
   * can then change.
   */
  assert.ok(
    /reading\.amount/.test(review),
    'the review does not use the amount that was read'
  );
  assert.ok(
    /merchant_name/.test(review),
    'the review does not use the name that was read'
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
