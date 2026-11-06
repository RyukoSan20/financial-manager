/**
 * The four widgets that answer a question straight away.
 *
 * Four things were asked for, and they are not four features so much
 * as four answers:
 *
 * - how much can be spent today without trouble;
 * - which way the reader wants to run their money;
 * - where the money went;
 * - whether the figures agree with the bank.
 *
 * These checks are about the arithmetic, because that is the part that
 * has to be right. A widget that shows the wrong number confidently is
 * worse than no widget at all.
 *
 * The numbers here are worked out by hand so that the test does not
 * agree with the code just because both are wrong in the same way.
 *
 * Run with: node src/utils/__tests__/decisionWidgets.test.js
 */

import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const {
  monthlyCostOf,
  billsDueWithin30Days,
  monthlySavingsTarget,
  safeToSpendToday,
  BUDGET_METHODS,
  budgetMethodIsKnown,
  resolveBudgetMethod,
  zeroBasedState,
  flowDiagram,
  flowFromTransactions,
  reconciliationState,
  adjustmentFor,
} = await import(path.join(ROOT, 'decisionWidgets.js'));

let passed = 0;
let failed = 0;

const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}\n       ${err.message}`);
  }
};

// ---------------------------------------------------------------------------
// The bills
// ---------------------------------------------------------------------------
check('a monthly bill costs what it costs', () => {
  assert.strictEqual(monthlyCostOf({ amount: 500000, frequency: 'monthly' }), 500000);
});

check('a yearly bill costs a twelfth of what it costs', () => {
  assert.strictEqual(monthlyCostOf({ amount: 12000000, frequency: 'yearly' }), 1000000);
});

check('a quarterly bill costs a third of what it costs', () => {
  assert.strictEqual(monthlyCostOf({ amount: 3000000, frequency: 'quarterly' }), 1000000);
});

check('a weekly bill costs a little over four weeks a month', () => {
  // 52 weeks in a year, 12 months, so 4.345 weeks in a month.
  const cost = monthlyCostOf({ amount: 100000, frequency: 'weekly' });
  assert.strictEqual(cost, 434500);
});

check('a bill that comes every two weeks comes twice a month', () => {
  // 4.345 weeks in a month, so a fortnight happens 2.1726 times.
  const cost = monthlyCostOf({ amount: 100000, frequency: 'biweekly' });
  assert.strictEqual(cost, 217260);
});

check('a bill that comes every second month is worth half', () => {
  const cost = monthlyCostOf({ amount: 100000, frequency: 'monthly', interval_value: 2 });
  assert.strictEqual(cost, 50000);
});

check('a bill that comes every day costs thirty times', () => {
  assert.strictEqual(monthlyCostOf({ amount: 10000, frequency: 'daily' }), 300000);
});

check('a bill with an unknown frequency is treated as monthly', () => {
  assert.strictEqual(monthlyCostOf({ amount: 100000, frequency: 'whenever' }), 100000);
});

// ---------------------------------------------------------------------------
// The bills due in the next thirty days
// ---------------------------------------------------------------------------
check('the bills due add up', () => {
  const total = billsDueWithin30Days([
    { amount: 1500000, frequency: 'monthly', is_active: true, type: 'expense' },
    { amount: 500000, frequency: 'monthly', is_active: true, type: 'expense' },
  ]);
  assert.strictEqual(total, 2000000);
});

check('a bill that is switched off does not count', () => {
  const total = billsDueWithin30Days([
    { amount: 1500000, frequency: 'monthly', is_active: true, type: 'expense' },
    { amount: 900000, frequency: 'monthly', is_active: false, type: 'expense' },
  ]);
  assert.strictEqual(total, 1500000);
});

check('income does not count as a bill', () => {
  const total = billsDueWithin30Days([
    { amount: 5000000, frequency: 'monthly', is_active: true, type: 'income' },
    { amount: 1500000, frequency: 'monthly', is_active: true, type: 'expense' },
  ]);
  assert.strictEqual(total, 1500000);
});

// ---------------------------------------------------------------------------
// The savings promise
// ---------------------------------------------------------------------------
check('a goal with a monthly figure counts as that figure', () => {
  const result = monthlySavingsTarget([
    { target_amount: 6000000, current_amount: 0, monthly_contribution: 1000000 },
  ]);
  assert.strictEqual(result.target, 1000000);
});

check('a goal without a monthly figure is spread over the time left', () => {
  // Two million to go, six months left, so 333,334 a month.
  const deadline = new Date(Date.now() + 180 * 86400000).toISOString();
  const result = monthlySavingsTarget([
    { target_amount: 2000000, current_amount: 0, deadline },
  ]);
  assert.strictEqual(result.target, 333334);
});

check('a goal with no deadline and no monthly figure does not count', () => {
  // A wish is not a promise, and it should not eat into the money
  // available today.
  const result = monthlySavingsTarget([
    { target_amount: 5000000, current_amount: 0 },
  ]);
  assert.strictEqual(result.target, 0);
});

check('a goal that is already reached does not count', () => {
  const result = monthlySavingsTarget([
    { target_amount: 1000000, current_amount: 1000000, monthly_contribution: 500000 },
  ]);
  assert.strictEqual(result.target, 0);
});

check('a promise bigger than the income is capped and reported', () => {
  const result = monthlySavingsTarget(
    [{ target_amount: 6000000, current_amount: 0, monthly_contribution: 3000000 }],
    { income: 5000000 }
  );
  assert.strictEqual(result.target, 3000000);
  assert.strictEqual(result.counted, 3000000);
  assert.strictEqual(result.overIncome, false);
});

check('a promise bigger than the income says so', () => {
  const result = monthlySavingsTarget(
    [{ target_amount: 6000000, current_amount: 0, monthly_contribution: 9000000 }],
    { income: 5000000 }
  );
  assert.strictEqual(result.target, 9000000);
  assert.strictEqual(result.counted, 5000000);
  assert.strictEqual(result.shortfall, 4000000);
  assert.strictEqual(result.overIncome, true);
});

// ---------------------------------------------------------------------------
// The money safe to spend today
// ---------------------------------------------------------------------------
check('the safe-to-spend figure takes the three parts away', () => {
  // 5,000,000 held, 2,000,000 of bills, 1,000,000 to save.
  const result = safeToSpendToday({
    cash: 5000000,
    rules: [{ amount: 2000000, frequency: 'monthly', is_active: true, type: 'expense' }],
    goals: [{ target_amount: 3000000, current_amount: 0, monthly_contribution: 1000000 }],
    income: 6000000,
  });
  assert.strictEqual(result.safe, 2000000);
  assert.strictEqual(result.available, 5000000);
  assert.strictEqual(result.bills, 2000000);
  assert.strictEqual(result.savings, 1000000);
  assert.strictEqual(result.comfortable, true);
});

check('when the promise is bigger than the money there is a shortfall', () => {
  const result = safeToSpendToday({
    cash: 1000000,
    rules: [{ amount: 2000000, frequency: 'monthly', is_active: true, type: 'expense' }],
    goals: [],
  });
  assert.strictEqual(result.safe, -1000000);
  assert.strictEqual(result.shortfall, 1000000);
  assert.strictEqual(result.comfortable, false);
});

check('with nothing promised the whole balance is safe', () => {
  const result = safeToSpendToday({ cash: 750000 });
  assert.strictEqual(result.safe, 750000);
  assert.strictEqual(result.shortfall, 0);
});

// ---------------------------------------------------------------------------
// The three ways to run the money
// ---------------------------------------------------------------------------
check('there are three ways to run the money', () => {
  assert.strictEqual(BUDGET_METHODS.length, 3);
  assert.deepStrictEqual(
    BUDGET_METHODS.map((m) => m.key),
    ['flex', 'envelope', 'zero']
  );
});

check('an unknown method is not a method', () => {
  assert.strictEqual(budgetMethodIsKnown('flex'), true);
  assert.strictEqual(budgetMethodIsKnown('zero'), true);
  assert.strictEqual(budgetMethodIsKnown('envelope'), true);
  assert.strictEqual(budgetMethodIsKnown('yoga'), false);
  assert.strictEqual(budgetMethodIsKnown(''), false);
});

check('an unknown method falls back to the first one', () => {
  assert.strictEqual(resolveBudgetMethod('yoga'), 'flex');
  assert.strictEqual(resolveBudgetMethod('zero'), 'zero');
});

check('only some methods let the reader move money between categories', () => {
  const byKey = Object.fromEntries(BUDGET_METHODS.map((m) => [m.key, m]));
  assert.strictEqual(byKey.flex.canTransfer, false);
  assert.strictEqual(byKey.envelope.canTransfer, true);
  assert.strictEqual(byKey.zero.canTransfer, true);
});

check('the zero-based method is the only one that hides the three groups', () => {
  const byKey = Object.fromEntries(BUDGET_METHODS.map((m) => [m.key, m]));
  assert.strictEqual(byKey.flex.showsEnvelopes, true);
  assert.strictEqual(byKey.envelope.showsEnvelopes, true);
  assert.strictEqual(byKey.zero.showsEnvelopes, false);
});

// ---------------------------------------------------------------------------
// The zero-based state
// ---------------------------------------------------------------------------
check('when everything has a job the books balance', () => {
  const result = zeroBasedState({ income: 5000000, allocated: 5000000, cash: 5000000 });
  assert.strictEqual(result.unassigned, 0);
  assert.strictEqual(result.balanced, true);
  assert.strictEqual(result.overAllocated, false);
});

check('money with nowhere to go is reported', () => {
  const result = zeroBasedState({ income: 5000000, allocated: 3000000, cash: 5000000 });
  assert.strictEqual(result.unassigned, 2000000);
  assert.strictEqual(result.balanced, false);
  assert.strictEqual(result.underAllocated, true);
  assert.strictEqual(result.overAllocated, false);
});

check('a promise beyond the income is reported', () => {
  const result = zeroBasedState({ income: 5000000, allocated: 7000000, cash: 5000000 });
  assert.strictEqual(result.unassigned, -2000000);
  assert.strictEqual(result.overAllocated, true);
});

// ---------------------------------------------------------------------------
// The flow diagram
// ---------------------------------------------------------------------------
check('the flow adds up on both sides', () => {
  const flow = flowDiagram({
    income: [{ key: 'gaji', label: 'Gaji', value: 5000000 }],
    expense: [
      { key: 'makan', label: 'Makan', value: 1500000 },
      { key: 'cicilan', label: 'Cicilan', value: 1000000 },
    ],
  });
  assert.strictEqual(flow.earned, 5000000);
  assert.strictEqual(flow.spent, 2500000);
  // What is left over is what was saved.
  assert.strictEqual(flow.sinks[0].value, 2500000);
  assert.strictEqual(flow.sinks[1].value, 2500000);
});

check('nothing with no value is drawn', () => {
  const flow = flowDiagram({
    income: [{ key: 'gaji', label: 'Gaji', value: 1000000 }],
    expense: [{ key: 'kos', label: 'Kos', value: 0 }],
  });
  assert.strictEqual(flow.middle.length, 0);
});

check('the flow comes from the transactions', () => {
  const flow = flowFromTransactions([
    { type: 'income', amount: 5000000, description: 'Gaji' },
    { type: 'expense', amount: 1500000, category_name: 'Makan' },
    { type: 'expense', amount: 500000, category_name: 'Makan' },
  ]);
  assert.strictEqual(flow.earned, 5000000);
  assert.strictEqual(flow.spent, 2000000);
  // The two food transactions are one group.
  assert.strictEqual(flow.middle.length, 1);
  assert.strictEqual(flow.middle[0].value, 2000000);
});

// ---------------------------------------------------------------------------
// The reconciliation
// ---------------------------------------------------------------------------
check('the figures matching is the good case', () => {
  const state = reconciliationState({ recorded: 5000000, bank: 5000000 });
  assert.strictEqual(state.matched, true);
  assert.strictEqual(state.needsReview, false);
  assert.strictEqual(state.difference, 0);
});

check('the application being higher means a transaction was entered twice', () => {
  const state = reconciliationState({ recorded: 5500000, bank: 5000000 });
  assert.strictEqual(state.higher, true);
  assert.strictEqual(state.difference, 500000);
  assert.strictEqual(state.needsReview, true);
});

check('the application being lower means a transaction is missing', () => {
  const state = reconciliationState({ recorded: 4800000, bank: 5000000 });
  assert.strictEqual(state.lower, true);
  assert.strictEqual(state.difference, -200000);
  assert.strictEqual(state.needsReview, true);
});

check('there is no adjustment to make when the figures agree', () => {
  const state = reconciliationState({ recorded: 5000000, bank: 5000000 });
  const result = adjustmentFor(state);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.entry, null);
});

check('the adjustment brings the application to what the bank says', () => {
  const state = reconciliationState({ recorded: 5500000, bank: 5000000 });
  const result = adjustmentFor(state);
  assert.strictEqual(result.ok, true);
  // The application is too high, so the entry takes money out.
  assert.strictEqual(result.entry.type, 'expense');
  assert.strictEqual(result.entry.amount, 500000);
  assert.strictEqual(result.entry.after, 5000000);
});

check('the adjustment for a missing transaction puts money in', () => {
  const state = reconciliationState({ recorded: 4800000, bank: 5000000 });
  const result = adjustmentFor(state);
  assert.strictEqual(result.entry.type, 'income');
  assert.strictEqual(result.entry.amount, 200000);
  assert.strictEqual(result.entry.after, 5000000);
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------
console.log(`\ndecision widgets: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
