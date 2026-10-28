/**
 * The analytics page does not contradict itself.
 *
 * The bug: the strip of four numbers at the top of the analytics page
 * read the balance from the top level of the health answer, and the
 * card further down read it from `metrics`. The server puts it under
 * `metrics`, so the strip said the balance was zero while the card
 * said it was the real amount.
 *
 * The second bug: a reader with one transaction was shown a score of
 * 0 out of 100, in a large number, with the words "needs work". One
 * transaction is not a verdict, it is not enough to measure with.
 *
 * Run with: node src/utils/__tests__/healthMetrics.test.js
 */

import {
  MIN_TRANSACTIONS_FOR_SCORE,
  canShowHealthScore,
  healthMetrics,
  transactionCount,
} from '../healthMetrics.js';

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

// --- The numbers are read from where the server puts them ---------------

{
  const health = {
    overall_score: 72,
    metrics: {
      total_balance: 5996400,
      saving_rate: 18.5,
      total_debt: 1200000,
      active_goals: 3,
    },
  };
  const m = healthMetrics(health);
  check(m.totalBalance === 5996400, 'the balance was not read');
  check(m.savingRate === 18.5, 'the saving rate was not read');
  check(m.totalDebt === 1200000, 'the debt was not read');
  check(m.activeGoals === 3, 'the goal count was not read');
}

{
  // The old reading: the top level, where there is nothing.
  const health = { metrics: { total_balance: 5996400 } };
  const wrong = health.total_balance || 0;
  check(wrong === 0, 'the old reading was not zero, so the test proves nothing');
  const right = healthMetrics(health).totalBalance;
  check(right === 5996400, 'the new reading did not find the balance');
}

// --- A missing answer is not a crash ------------------------------------

{
  const m = healthMetrics(null);
  check(m.totalBalance === 0, 'no answer gives no balance');
  check(m.savingRate === 0, 'no answer gives no saving rate');
  check(m.totalDebt === 0, 'no answer gives no debt');
  check(m.activeGoals === 0, 'no answer gives no goals');
}

{
  const m = healthMetrics({});
  check(m.totalBalance === 0, 'an empty answer gives no balance');
}

{
  const m = healthMetrics({ metrics: { total_balance: null } });
  check(m.totalBalance === 0, 'a null balance is zero');
}

// --- The score is not shown on too little data -------------------------

{
  // The server says it could not measure enough.
  check(
    canShowHealthScore({ has_enough_data: false }, 0) === false,
    'the score is shown even though the server said it had too little data'
  );
}

{
  // The server says it could.
  check(
    canShowHealthScore({ has_enough_data: true }, 0) === true,
    'the score is hidden even though the server said it had enough data'
  );
}

{
  // The server is quiet about it, and the reader has enough recorded.
  check(
    canShowHealthScore({}, MIN_TRANSACTIONS_FOR_SCORE) === true,
    'the score is hidden even though there are enough transactions'
  );
  check(
    canShowHealthScore({}, MIN_TRANSACTIONS_FOR_SCORE - 1) === false,
    'the score is shown with fewer than the needed transactions'
  );
}

{
  // Nothing known at all: the score stays hidden, because a zero on
  // its own is not a measurement.
  check(
    canShowHealthScore({}, null) === false,
    'the score is shown when nothing is known'
  );
  check(
    canShowHealthScore(null, null) === false,
    'the score is shown when there is no answer at all'
  );
}

// --- The transaction count is read, and its absence is honest ----------

{
  check(
    transactionCount({ metrics: { transaction_count: 12 } }) === 12,
    'the transaction count was not read'
  );
  check(
    transactionCount({ metrics: {} }) === null,
    'a missing transaction count is not zero'
  );
  check(transactionCount(null) === null, 'no answer has no transaction count');
  check(
    transactionCount({ metrics: { transaction_count: '7' } }) === 7,
    'a count written as text was not read'
  );
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
