/**
 * The capture panel.
 *
 * The flow has one rule that matters: reading a photograph gives a
 * draft, and the draft is not a product until the owner presses the
 * button. The checks here are about that rule and about the ways the
 * reading can be wrong.
 *
 * - A draft with no price is not saved. The price is what the product
 *   is sold at, and a draft without one would be saved and sold at
 *   nothing.
 *
 * - The picture is shown next to the draft, so the owner can check the
 *   reading against the label it came from.
 *
 * - The panel says how sure the reading is, because a reading that is
 *   a guess and a reading that is sure need to look different.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');

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

const PANEL = 'frontend/src/components/merchant/MerchantCapturePanel.jsx';

check('the panel exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, PANEL)), 'the panel is there');
});

check('the picture is shown next to the draft', () => {
  const src = read(PANEL);
  assert.ok(
    /merchant-capture__preview/.test(src),
    'the picture the owner took is shown',
  );
  assert.ok(
    /merchant-capture__draft/.test(src),
    'the draft is shown',
  );
});

check('the draft says how sure the reading is', () => {
  const src = read(PANEL);
  assert.ok(
    /confidence/.test(src),
    'the certainty of the reading is shown',
  );
  assert.ok(
    /is-high|is-medium|is-low/.test(src),
    'the certainty is shown in three steps',
  );
});

check('a draft with no price is not saved', () => {
  const src = read(PANEL);
  // The check comes before the save, and it stops the save.
  const save = src.indexOf('const save');
  assert.ok(save > 0, 'there is a save');
  const guard = src.indexOf('noPrice', save);
  assert.ok(guard > 0, 'the save checks the price');
  assert.ok(
    guard < src.indexOf('createProduct', save),
    'the price is checked before the product is made',
  );
});

check('the panel writes nothing by itself', () => {
  const src = read(PANEL);
  // The product is made by one call, and it is inside the save, which
  // only runs when the owner presses the button.
  const calls = src.match(/createProduct/g) || [];
  assert.equal(calls.length, 1, 'the product is made in one place');
  assert.ok(
    /onClick=\{save\}/.test(src),
    'and that place is the button the owner presses',
  );
});

check('the panel is on the catalogue page', () => {
  const src = read('frontend/src/components/merchant/MerchantProductCatalog.jsx');
  assert.ok(
    /MerchantCapturePanel/.test(src),
    'the catalogue carries the capture panel',
  );
});

check('the browser talks to the capture route', () => {
  const src = read('frontend/src/services/merchantApi.js');
  assert.ok(
    /captureProduct/.test(src),
    'there is a call for the capture',
  );
  assert.ok(
    /\/capture/.test(src),
    'and it goes to the capture route',
  );
});

check('the panel has a style of its own', () => {
  const css = read('frontend/src/styles/merchant.css');
  assert.ok(
    /\.merchant-capture\b/.test(css),
    'the panel is styled',
  );
  assert.ok(
    /\.merchant-capture__preview/.test(css),
    'the picture is styled',
  );
});

check('the words for the capture are in all three languages', () => {
  const src = read('frontend/src/i18n/keys_batch12.js');
  const blocks = ['id', 'en', 'ja'];
  for (const language of blocks) {
    const at = src.indexOf(`  ${language}: {`);
    assert.ok(at > 0, `the ${language} block is there`);
    const capture = src.indexOf('capture: {', at);
    assert.ok(capture > 0, `the ${language} capture block is there`);
  }
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
