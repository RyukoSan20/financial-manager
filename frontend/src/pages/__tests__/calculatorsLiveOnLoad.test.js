/**
 * The calculator is alive on the first paint.
 *
 * The discount calculator opened with empty boxes and a dead
 * "Masukkan nilai untuk menghitung" placeholder on the right. A
 * reader could not tell the tool worked without typing into it.
 *
 * It now opens with a worked example - price 100000, discount 20 -
 * so the right panel shows a real result the moment the page loads.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failed += 1; console.error(`not ok - ${name}`); console.error(`  ${err.message}`); }
};

const CALC = read('pages/Calculators.jsx');

check('the discount calculator opens with a worked example', () => {
  assert.ok(
    CALC.includes("useState({ price: '100000', discount: '20' })"),
    'the price and discount are pre-filled'
  );
  assert.ok(
    !CALC.includes("useState({ price: '', discount: '' })"),
    'the empty start is gone'
  );
});

check('the result is computed from the form on load', () => {
  // The effect calculates whenever the form has both values; the
  // pre-filled values mean it runs on the first render.
  assert.ok(CALC.includes('if (form.price && form.discount) calculate();'), 'the effect calculates');
});

check('the title is localised, not the raw English', () => {
  const id = read('i18n/id.js');
  const calcBlock = id.slice(id.indexOf('calculators: {'));
  const titleLine = calcBlock.slice(0, calcBlock.indexOf('\n', calcBlock.indexOf('title:')));
  assert.ok(
    !titleLine.includes('Financial Calculators'),
    'the Indonesian title is no longer the English string'
  );
  assert.ok(titleLine.includes('Kalkulator'), 'the Indonesian title is Indonesian');
});

console.log('');
console.log(`the calculators page: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
