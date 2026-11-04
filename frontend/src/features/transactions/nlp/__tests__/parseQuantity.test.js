/**
 * Quantity times unit price.
 *
 * The reader writes what they bought: "2 indomie 3500" means two
 * packets at three thousand five hundred each, which is seven
 * thousand. The old reader took the first money it found and called it
 * the whole thing, so the reader had to do the multiplication in their
 * head, or write the total, or make three transactions.
 *
 * These tests are about the multiplication being done in the right
 * place, and about the times it must NOT be done.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NLP = path.resolve(HERE, '..');

const { parseQuantity } = await import(path.join(NLP, 'parseQuantity.js'));

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
};

console.log('quantity times unit price');

// --- the reader writes the count before the thing ---------------------------

check('two packets at three thousand five hundred is seven thousand', () => {
  const found = parseQuantity('2 indomie 3500');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 2);
  assert.equal(found.unitPrice, 3500);
  assert.equal(found.total, 7000);
});

check('the same thing written the other way round', () => {
  const found = parseQuantity('indomie 2x 3500');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 2);
  assert.equal(found.unitPrice, 3500);
  assert.equal(found.total, 7000);
});

check('chicken at thirty five thousand each, four of them', () => {
  const found = parseQuantity('ayam 4 @ 35rb');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 4);
  assert.equal(found.unitPrice, 35000);
  assert.equal(found.total, 140000);
});

check('a dot in the price is a thousands separator', () => {
  const found = parseQuantity('indomie 2x 3.500');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 2);
  assert.equal(found.unitPrice, 3500);
  assert.equal(found.total, 7000);
});

check('the words for the price are understood', () => {
  const found = parseQuantity('2 kopi 15rb');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 2);
  assert.equal(found.unitPrice, 15000);
  assert.equal(found.total, 30000);
});

check('when the price is said to be the price of one', () => {
  const found = parseQuantity('indomie 2 bungkus harga satuan 3500');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 2);
  assert.equal(found.unitPrice, 3500);
  assert.equal(found.total, 7000);
});

// --- when it must not be done -------------------------------------------------

check('one thing is one thing', () => {
  const found = parseQuantity('kopi 45rb');
  assert.equal(found, null, 'one packet at a price is not a multiplication');
});

check('a count of people is not a multiplication', () => {
  /**
   * "kopi 2 orang 50k" is two coffees for fifty thousand. The
   * fifty thousand is the whole thing, not the price of each. There is
   * no sign that it is a unit price, so it is left alone.
   */
  const found = parseQuantity('kopi 2 orang 50k');
  assert.equal(found, null, 'the price of the whole, not of each');
});

check('a sentence with no count is left alone', () => {
  assert.equal(parseQuantity('makan siang'), null);
});

check('an empty sentence is left alone', () => {
  assert.equal(parseQuantity(''), null);
  assert.equal(parseQuantity(null), null);
});

check('a count with no price is not a multiplication', () => {
  const found = parseQuantity('2 indomie');
  assert.equal(found, null, 'there is no price to multiply');
});

check('a price with no count is not a multiplication', () => {
  const found = parseQuantity('indomie 3500');
  assert.equal(found, null, 'there is no count to multiply');
});

// --- what is left of the sentence --------------------------------------------

check('the count and the price are taken out of the words', () => {
  const found = parseQuantity('2 indomie 3500');
  assert.equal(found.description, 'indomie');
});

check('the words in between are kept', () => {
  const found = parseQuantity('ayam 4 @ 35rb di pasar');
  assert.ok(found);
  assert.equal(found.description, 'ayam di pasar');
});

check('the count is not read out of a year', () => {
  const found = parseQuantity('2026 indomie 3500');
  assert.equal(found, null, 'a year is not a count of packets');
});

// --- the total is the sum ----------------------------------------------------

check('the total is the count times the price', () => {
  const found = parseQuantity('2 indomie 3500');
  assert.equal(found.total, found.quantity * found.unitPrice);
});

check('the total is a whole number of rupiah', () => {
  const found = parseQuantity('3 kopi 4.500');
  assert.ok(found);
  assert.equal(found.total, 13500);
  assert.equal(Number.isInteger(found.total), true);
});

check('a count of one is still one', () => {
  const found = parseQuantity('1 indomie 3500');
  assert.ok(found, 'the sentence should have been read');
  assert.equal(found.quantity, 1);
  assert.equal(found.total, 3500);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
