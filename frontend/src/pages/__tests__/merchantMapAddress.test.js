/**
 * The address under the pin.
 *
 * The map draws a pin, and under it the address. Before this, the
 * address was whatever the marker carried as "address", and the
 * street and the shop next door - which the server was already
 * sending - were dropped on the floor.
 *
 * So a reader who wanted to know which shop it was, and where it
 * was, was told a district and had to guess.
 *
 * These checks are about the address being shown, and about the
 * warning being honest: a pin that stands for a whole brand says so,
 * and a pin that stands for a district says that too, rather than
 * claiming a door number it does not have.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

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

const MAP = 'src/pages/MerchantMap.jsx';

check('the page shows the street when the server sends one', () => {
  const source = read(MAP);
  assert.ok(
    /marker\.street/.test(source),
    'the street is drawn on the page',
  );
});

check('the page shows the place nearest to the pin', () => {
  const source = read(MAP);
  assert.ok(
    /marker\.nearest_place/.test(source),
    'the nearest place is drawn on the page',
  );
});

check('the address line is not the only thing the reader gets', () => {
  const source = read(MAP);
  // The old line alone is not enough. The street has to be there
  // beside it.
  assert.ok(
    /marker\.address/.test(source),
    'the address is still drawn',
  );
  assert.ok(
    /marker\.street/.test(source) && /marker\.nearest_place/.test(source),
    'and the street and the nearest place are drawn with it',
  );
});

check('a pin that is only a district says so', () => {
  const source = read(MAP);
  assert.ok(
    /precision/.test(source),
    'the precision is read on the page',
  );
  // There has to be a warning for the districts, not only for the
  // brands. A district pin that says nothing reads like a street
  // pin.
  assert.ok(
    /precision_brand/.test(source) && /precision_district/.test(source),
    'both the brand and the district are called out',
  );
});

check('the words for these warnings are in every language', () => {
  for (const language of ['id', 'en', 'ja']) {
    const source = read(`src/i18n/${language}.js`);
    // The words sit inside the merchant_map block, one level down.
    const at = source.indexOf('merchant_map:');
    assert.ok(at > -1, `the ${language} language has the merchant_map block`);
    const block = source.slice(at, at + 4000);
    assert.ok(
      block.includes('precision_district:'),
      `the ${language} language has merchant_map.precision_district`,
    );
    assert.ok(
      block.includes('precision_brand:'),
      `the ${language} language has merchant_map.precision_brand`,
    );
  }
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
