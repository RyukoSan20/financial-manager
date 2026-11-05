/**
 * The product a photograph produced has to land on the shelf.
 *
 * The catalogue and the till read their goods from one table, the
 * shelf table. There is an older table too, one that the shop keeps
 * its own catalogue in, and the two do not talk to each other.
 *
 * The capture panel was writing to the older table while the
 * catalogue was reading from the newer one. So the owner took a
 * picture, the AI read the label, the owner pressed save, the answer
 * was "saved" - and the shelf was still empty. The product was in
 * the books and nowhere a reader could see it.
 *
 * So the panel has to write to the same place the shelf reads from,
 * with the field names that place expects. A thing on the shelf is
 * priced in unit_price and counted in stock_quantity, not in price
 * and stock.
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

const PANEL = 'src/components/merchant/MerchantCapturePanel.jsx';
const API = 'src/services/merchantApi.js';

check('the panel writes to the shelf, not to the older table', () => {
  const source = read(PANEL);

  // The old way is the one that wrote to the table nobody reads.
  assert.ok(
    !/merchantApi\.addProduct/.test(source),
    'the panel does not write to the older catalogue table',
  );

  assert.ok(
    /merchantApi\.createProduct/.test(source),
    'the panel writes to the shelf the catalogue reads from',
  );
});

check('the panel sends the names the shelf expects', () => {
  const source = read(PANEL);

  // The shelf counts in unit_price and stock_quantity.
  assert.ok(
    /unit_price/.test(source),
    'the price is sent as unit_price',
  );
  assert.ok(
    /stock_quantity/.test(source),
    'the stock is sent as stock_quantity',
  );
  assert.ok(
    /unit_of_measure/.test(source),
    'the unit is sent as unit_of_measure',
  );

  // And it does not send the old names as well.
  assert.ok(
    !/^\s*price:\s*draft\.price/m.test(source),
    'the old price field is not sent',
  );
  assert.ok(
    !/^\s*stock:\s*\d/m.test(source),
    'the old stock field is not sent',
  );
});

check('the panel keeps the picture it was given', () => {
  const source = read(PANEL);
  assert.ok(
    /image_url/.test(source),
    'the picture is carried over to the product',
  );
});

check('the older way of writing is gone from the api too', () => {
  const source = read(API);
  assert.ok(
    !/addProduct:/.test(source),
    'the older write is not offered any more',
  );
});

check('the catalogue and the panel write to the same place', () => {
  const catalog = read('src/components/merchant/MerchantProductCatalog.jsx');
  const panel = read(PANEL);
  assert.ok(
    /merchantApi\.createProduct/.test(catalog) &&
      /merchantApi\.createProduct/.test(panel),
    'both write the same way',
  );
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
