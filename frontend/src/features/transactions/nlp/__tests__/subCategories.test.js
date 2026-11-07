/**
 * The sub-categories.
 *
 * The words a reader uses point at the thing they bought: "Kopi Jago"
 * is coffee, "Pertamax" is fuel. A reader who wants to say "Kopi &
 * Kafe" has to be able to, and the words they type have to be
 * enough to get them there.
 */

import { suggestSubCategory, subCategoriesFor, subCategoryName } from '../subCategories.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what || 'value'}: expected ${expected}, got ${actual}`);
  }
}

console.log('the sub-categories');

check('coffee is coffee and tea', () => {
  const sub = suggestSubCategory('Kopi Jago 10rb', 'food_drink');
  eq(sub && sub.key, 'coffee_tea', 'the sub-category');
});

check('petrol is fuel', () => {
  const sub = suggestSubCategory('isi bensin pertamax', 'transportation');
  eq(sub && sub.key, 'fuel', 'the sub-category');
});

check('a shirt is clothing', () => {
  const sub = suggestSubCategory('baju kaos', 'shopping');
  eq(sub && sub.key, 'clothing', 'the sub-category');
});

check('a clinic is a clinic', () => {
  const sub = suggestSubCategory('k dokter', 'health');
  eq(sub && sub.key, 'clinic', 'the sub-category');
});

check('the words that mean nothing point at nothing', () => {
  // A null is an honest answer. The reader is asked, rather than the
  // application guessing.
  const sub = suggestSubCategory('zzzqqq', 'food_drink');
  eq(sub, null, 'the sub-category');
});

check('the category with nothing under it has no sub-categories', () => {
  eq(subCategoriesFor('other_income').length, 0, 'the number of sub-categories');
});

check('the name of a sub-category can be found', () => {
  eq(subCategoryName('food_drink', 'coffee_tea'), 'Kopi & Teh', 'the name');
  eq(subCategoryName('food_drink', 'nope'), null, 'the name');
});

check('every sub-category has words to find it by', () => {
  for (const [parent, list] of Object.entries({
    food_drink: subCategoriesFor('food_drink'),
    transportation: subCategoriesFor('transportation'),
    shopping: subCategoriesFor('shopping'),
    health: subCategoriesFor('health'),
  })) {
    for (const sub of list) {
      if (!sub.words || !sub.words.length) {
        throw new Error(`${parent}/${sub.key} has no words`);
      }
      if (!sub.name) {
        throw new Error(`${parent}/${sub.key} has no name`);
      }
    }
  }
});

console.log(`\nsub-categories: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
