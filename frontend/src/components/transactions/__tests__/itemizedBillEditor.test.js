/**
 * The editor of the itemised receipt.
 *
 * The editor is where a receipt stops being one number and becomes
 * the things that were actually bought. It has to hold:
 *
 * - the lines, each with a name, a quantity, a unit, a unit price and
 *   a category of its own, because one receipt can be food and drink
 *   at the same time;
 * - the discount, in rupiah or in percent, shared out over the lines
 *   in proportion to what they are worth;
 * - the tax, on the Indonesian rules, showing the base it is charged
 *   on and the amount of it;
 * - the service charge;
 * - the sharing, either equal or by item, with the discount and the
 *   tax carried along with the items.
 *
 * The arithmetic itself lives in receiptBill.js and is checked there.
 * What is checked here is that the editor is wired to that arithmetic
 * and not to a second, looser version of it.
 */

import assert from 'node:assert/strict';
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
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message.split('\n')[0]}`);
  }
};

const EDITOR = 'src/components/transactions/ItemizedBillEditor.jsx';

check('the editor is there', () => {
  assert.ok(fs.existsSync(path.join(ROOT, EDITOR)), 'the editor does not exist');
});

check('the editor uses the one arithmetic, not its own', () => {
  const source = read(EDITOR);
  assert.ok(
    source.includes("from '../../utils/receiptBill'"),
    'the editor does not use the shared arithmetic'
  );
});

check('the editor does not do its own multiplication', () => {
  const source = read(EDITOR);
  // The subtotal of a line is the line's own business and belongs to
  // the arithmetic module. A second copy of it in the component is
  // how the two drift apart.
  const own = source.match(/quantity\s*\*\s*unitPrice/g);
  assert.strictEqual(own, null, 'the editor multiplies on its own');
});

check('the editor shows the tax base and the tax amount', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('bill.taxBase'), 'the taxable base is not shown');
  assert.ok(source.includes('bill.taxAmount'), 'the tax amount is not shown');
});

check('the editor offers every tax rule', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('TAX_RULES'), 'the tax rules are not used');
  // The rules themselves live in the arithmetic module, so that the
  // editor and the calculation can never disagree about what a rule
  // means.
  const rules = read('src/utils/receiptBill.js');
  for (const rule of ['none', 'pb1', 'ppn131', 'ppn12']) {
    assert.ok(rules.includes(rule), `the tax rule ${rule} is missing`);
  }
  assert.ok(source.includes('Object.values(TAX_RULES)'), 'the rules are not offered');
});

check('the editor offers both ways of reading the tax', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('bill.taxInclusive'), 'the inclusive tax is not offered');
  assert.ok(source.includes('bill.taxExclusive'), 'the exclusive tax is not offered');
});

check('the editor offers the discount in rupiah and in percent', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('value="nominal"'), 'the rupiah discount is not offered');
  assert.ok(source.includes('value="percent"'), 'the percent discount is not offered');
});

check('the editor offers both ways of sharing the bill', () => {
  const source = read(EDITOR);
  assert.ok(source.includes("splitMode === 'equal'"), 'the equal split is not offered');
  assert.ok(source.includes("splitMode === 'byItem'"), 'the split by item is not offered');
});

check('the editor lets each line have a category of its own', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('row.categoryId'), 'the category of the line is not used');
});

check('the editor remembers the price of a thing', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('buildPriceMemory'), 'the price memory is not built');
  assert.ok(source.includes('suggestFromMemory'), 'the price memory is not used');
});

check('the editor tells the page the whole bill', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('onBillChange'), 'the editor does not tell the page the bill');
});

check('the editor tells the page who the shares are', () => {
  const source = read(EDITOR);
  assert.ok(source.includes('onSplitChange'), 'the editor does not tell the page the shares');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
