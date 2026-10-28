/**
 * The budget recipes add up, and the money they work out is right.
 *
 * The three parts of a budget must add up to a hundred, and the money
 * they work out must add up to the money in the budget. A budget
 * whose parts do not add up cannot be spent, and a recipe with a
 * mistake in it is worse than no recipe at all.
 *
 * Run with: node src/utils/__tests__/budgetRecipes.test.js
 */

import {
  DAYS_PER_MONTH,
  PARTS,
  RECIPES,
  amountsFromSplit,
  dailyFromSplit,
  dailyLabel,
  recipeById,
  shortAmount,
  splitAddsUp,
  splitOf,
  totalFromSplit,
} from '../budgetRecipes.js';

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

function checkEqual(actual, expected, message) {
  checks += 1;
  if (actual !== expected) {
    failures += 1;
    console.error(`  FAIL ${message}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// --- Every recipe adds up to a hundred -----------------------------------

{
  check(RECIPES.length === 4, `there are ${RECIPES.length} recipes, not 4`);
  for (const recipe of RECIPES) {
    check(
      splitAddsUp(recipe.split),
      `the recipe ${recipe.id} does not add up to a hundred: ${JSON.stringify(recipe.split)}`
    );
  }
}

// --- The recipes are the ones that were asked for ------------------------

{
  const balanced = recipeById('balanced');
  check(balanced !== null, 'the balanced recipe is missing');
  checkEqual(balanced.split.needs, 50, 'the balanced recipe needs the wrong share');
  checkEqual(balanced.split.wants, 30, 'the balanced recipe wants the wrong share');
  checkEqual(balanced.split.savings, 20, 'the balanced recipe saves the wrong share');

  const fighter = recipeById('fighter');
  checkEqual(fighter.split.needs, 40, 'the fighter recipe needs the wrong share');
  checkEqual(fighter.split.wants, 20, 'the fighter recipe wants the wrong share');
  checkEqual(fighter.split.savings, 40, 'the fighter recipe saves the wrong share');

  const city = recipeById('city');
  checkEqual(city.split.needs, 60, 'the city recipe needs the wrong share');
  checkEqual(city.split.wants, 20, 'the city recipe wants the wrong share');
  checkEqual(city.split.savings, 20, 'the city recipe saves the wrong share');

  const payer = recipeById('payer');
  checkEqual(payer.split.needs, 50, 'the payer recipe needs the wrong share');
  checkEqual(payer.split.wants, 20, 'the payer recipe wants the wrong share');
  checkEqual(payer.split.savings, 30, 'the payer recipe saves the wrong share');
}

{
  check(recipeById('nonsense') === null, 'an unknown recipe was found');
}

// --- A copy, so moving a slider does not move the recipe -----------------

{
  const recipe = recipeById('balanced');
  const split = splitOf(recipe);
  split.needs = 10;
  checkEqual(recipe.split.needs, 50, 'moving the slider moved the recipe itself');
}

// --- The money adds up ---------------------------------------------------

{
  const amounts = amountsFromSplit(3_000_000, { needs: 50, wants: 30, savings: 20 });
  checkEqual(amounts.needs, 1_500_000, 'the needs amount is wrong');
  checkEqual(amounts.wants, 900_000, 'the wants amount is wrong');
  checkEqual(amounts.savings, 600_000, 'the savings amount is wrong');
  const total = amounts.needs + amounts.wants + amounts.savings;
  checkEqual(total, 3_000_000, 'the three parts do not add up to the money');
}

{
  // A total that does not divide evenly. The parts must still add up.
  const amounts = amountsFromSplit(1_000_001, { needs: 50, wants: 30, savings: 20 });
  const total = amounts.needs + amounts.wants + amounts.savings;
  checkEqual(total, 1_000_001, 'the parts do not add up to the money');
}

{
  // Every whole rupiah, for a range of totals.
  for (let money = 0; money < 5000; money += 7) {
    const amounts = amountsFromSplit(money, { needs: 50, wants: 30, savings: 20 });
    const total = amounts.needs + amounts.wants + amounts.savings;
    if (total !== money) {
      check(false, `the parts for ${money} add up to ${total}`);
      break;
    }
  }
  check(true, 'the parts add up for every total tried');
}

{
  // No money, no amounts.
  const amounts = amountsFromSplit(0, { needs: 50, wants: 30, savings: 20 });
  checkEqual(amounts.needs, 0, 'there is money in a budget of nothing');
  checkEqual(amounts.wants, 0, 'there is money in a budget of nothing');
  checkEqual(amounts.savings, 0, 'there is money in a budget of nothing');
}

{
  // Money that is not a number.
  const amounts = amountsFromSplit('abc', { needs: 50, wants: 30, savings: 20 });
  checkEqual(amounts.needs, 0, 'there is money in a budget of nothing');
}

// --- The amount per day --------------------------------------------------

{
  const daily = dailyFromSplit(3_000_000, { needs: 50, wants: 30, savings: 20 });
  checkEqual(daily.needs, 50_000, 'the needs amount per day is wrong');
  checkEqual(daily.wants, 30_000, 'the wants amount per day is wrong');
  checkEqual(daily.savings, 20_000, 'the savings amount per day is wrong');
}

{
  const daily = dailyFromSplit(900_000, { needs: 100, wants: 0, savings: 0 });
  checkEqual(daily.needs, 900_000 / DAYS_PER_MONTH, 'the amount per day is wrong');
}

// --- The short form ------------------------------------------------------

{
  checkEqual(shortAmount(0), '0', 'nothing is written as something');
  checkEqual(shortAmount(500), '500', 'a small amount is shortened');
  checkEqual(shortAmount(2500, 'id'), '3K', 'a thousand is shortened');
  checkEqual(shortAmount(2_500_000, 'id'), '2,5jt', 'a million is shortened');
  checkEqual(shortAmount(2_500_000, 'en'), '2,5M', 'a million is shortened in English');
  checkEqual(shortAmount(1_500_000_000, 'id'), '1,5M', 'a billion is shortened');
}

{
  // A negative amount keeps its sign.
  check(shortAmount(-2500).startsWith('-'), 'the sign was lost');
}

// --- The per day label ---------------------------------------------------

{
  // The argument is the amount per day.
  checkEqual(dailyLabel(500_000, 'id'), 'Rp 500K/hari', 'the per day label is wrong');
  checkEqual(dailyLabel(500_000, 'en'), 'Rp 500K/day', 'the per day label is wrong in English');
}

// --- The parts -----------------------------------------------------------

{
  checkEqual(PARTS.length, 3, 'a budget has the wrong number of parts');
  checkEqual(PARTS[0].key, 'needs', 'the parts are in the wrong order');
  checkEqual(PARTS[1].key, 'wants', 'the parts are in the wrong order');
  checkEqual(PARTS[2].key, 'savings', 'the parts are in the wrong order');
}

{
  // The sum of the parts is what the split adds up to.
  checkEqual(
    totalFromSplit({ needs: 50, wants: 30, savings: 20 }),
    100,
    'the total of the parts is wrong'
  );
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
