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

check('coffee is coffee and cafe', () => {
  const sub = suggestSubCategory('Kopi Jago 10rb', 'food_drink');
  eq(sub && sub.key, 'coffee_cafe', 'the sub-category');
});

check('petrol is fuel', () => {
  const sub = suggestSubCategory('isi bensin pertamax', 'transportation');
  eq(sub && sub.key, 'fuel', 'the sub-category');
});

check('a ride is a ride', () => {
  const sub = suggestSubCategory('ojol ke kantor', 'transportation');
  eq(sub && sub.key, 'ride_hailing', 'the sub-category');
});

check('a shirt is fashion', () => {
  const sub = suggestSubCategory('baju kaos', 'shopping');
  eq(sub && sub.key, 'fashion', 'the sub-category');
});

check('a clinic is a doctor', () => {
  const sub = suggestSubCategory('k dokter', 'health');
  eq(sub && sub.key, 'doctor', 'the sub-category');
});

check('the words that mean nothing point at nothing', () => {
  // A null is an honest answer. The reader is asked, rather than the
  // application guessing.
  const sub = suggestSubCategory('zzzqqq', 'food_drink');
  eq(sub, null, 'the sub-category');
});

check('the income categories have their own sub-categories', () => {
  // Each kind of transaction has its own tree, and an income is not
  // an expense.
  const salary = subCategoriesFor('salary');
  eq(salary.length > 0, true, 'the number of sub-categories');
  eq(
    salary.some((sub) => sub.key === 'monthly_salary'),
    true,
    'the monthly salary sub-category'
  );
});

check('the name of a sub-category can be found', () => {
  eq(subCategoryName('food_drink', 'coffee_cafe'), 'Kopi & Kafe', 'the name');
  eq(subCategoryName('food_drink', 'nope'), null, 'the name');
});

check('every sub-category has words to find it by', () => {
  for (const [parent, list] of Object.entries({
    food_drink: subCategoriesFor('food_drink'),
    transportation: subCategoriesFor('transportation'),
    shopping: subCategoriesFor('shopping'),
    health: subCategoriesFor('health'),
    bills_utilities: subCategoriesFor('bills_utilities'),
    education: subCategoriesFor('education'),
    entertainment: subCategoriesFor('entertainment'),
    other_expense: subCategoriesFor('other_expense'),
    salary: subCategoriesFor('salary'),
    freelance: subCategoriesFor('freelance'),
    investment_income: subCategoriesFor('investment_income'),
    other_income: subCategoriesFor('other_income'),
    transfer: subCategoriesFor('transfer'),
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
