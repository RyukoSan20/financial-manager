/**
 * The money that works out.
 *
 * Seventeen features were asked for and they all add up money
 * somewhere. If each one did its own arithmetic there would be
 * seventeen ways to add up a rupiah and no way to check any of them.
 *
 * So the sums are checked here, once, and every feature calls them.
 *
 * The things that matter:
 *
 * - A sum either adds up exactly or it says so.
 * - A function that is given the wrong thing says no instead of
 *   guessing.
 * - A percentage is applied and the result is rounded at the end, not
 *   in the middle.
 *
 * Run with: node src/utils/__tests__/fintech.test.js
 */

import {
  DAYS_PER_MONTH,
  DEBT_STRATEGIES,
  EMERGENCY_MONTHS,
  ENVELOPE_KINDS,
  cashFlowLinks,
  dataFreshness,
  debtStrategyIsKnown,
  emergencyFund,
  moveBetweenEnvelopes,
  netWorth,
  orderDebts,
  payoffWithExtra,
  readyToBeAssigned,
  reconcileBalance,
  rolloverFor,
  roundRupiah,
  savingScenario,
  spendingRows,
  splitIntoEnvelopes,
  splitToCategories,
  unusedSubscriptions,
} from '../fintech.js';

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
    console.error(`  FAIL ${message}: got ${actual}, expected ${expected}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
}

// ---------------------------------------------------------------------------
// The money itself
// ---------------------------------------------------------------------------
section('rounding');

checkEqual(roundRupiah(1234.4), 1234, 'a fraction under a half rounds down');
checkEqual(roundRupiah(1234.5), 1235, 'a half rounds up');
checkEqual(roundRupiah(-1234.5), -1235, 'a negative half rounds away from zero');
checkEqual(roundRupiah(0), 0, 'nothing rounds to nothing');
checkEqual(roundRupiah(NaN), 0, 'not a number is treated as nothing');
checkEqual(roundRupiah(Infinity), 0, 'infinity is treated as nothing');

// ---------------------------------------------------------------------------
// The money that has not been given a job yet
// ---------------------------------------------------------------------------
section('ready to be assigned');

const free = readyToBeAssigned({ cashBalance: 5000000, allocated: 2000000, spent: 1000000 });
checkEqual(free.free, 2000000, 'the money with no job is the cash minus the promises');
checkEqual(free.state, 'free', 'money left over means there is money to give a job to');
checkEqual(free.overcommitted, false, 'money left over is not overcommitted');

const over = readyToBeAssigned({ cashBalance: 1000000, allocated: 2000000, spent: 0 });
checkEqual(over.free, -1000000, 'more promised than there is shows as negative');
checkEqual(over.state, 'over', 'more promised than there is says so');
checkEqual(over.overcommitted, true, 'overcommitted is flagged');

const exact = readyToBeAssigned({ cashBalance: 3000000, allocated: 2000000, spent: 1000000 });
checkEqual(exact.state, 'exact', 'everything given a job says so');

const nothing = readyToBeAssigned();
checkEqual(nothing.free, 0, 'no numbers means no money with no job');
checkEqual(nothing.state, 'exact', 'no numbers means nothing left over');

// ---------------------------------------------------------------------------
// The envelopes
// ---------------------------------------------------------------------------
section('envelopes');

checkEqual(ENVELOPE_KINDS.length, 3, 'there are three kinds of envelope');
checkEqual(
  ENVELOPE_KINDS.map((k) => k.key).join(','),
  'fixed,sinking,flexible',
  'the envelopes are named the way Monarch names them'
);

const envelopes = splitIntoEnvelopes(5000000, { fixed: 2000000, sinking: 1000000 });
checkEqual(envelopes.fixed, 2000000, 'the fixed envelope holds what was put in it');
checkEqual(envelopes.sinking, 1000000, 'the sinking envelope holds what was put in it');
checkEqual(envelopes.flexible, 2000000, 'what is left over goes to the flexible envelope');
check(
  envelopes.fixed + envelopes.sinking + envelopes.flexible === envelopes.total,
  'the three envelopes add up to the total'
);
checkEqual(
  envelopes.balanced,
  false,
  'the reader only gave two of the three, so it is not balanced yet'
);
checkEqual(envelopes.remainder, 2000000, 'the leftover that went in by itself is reported');

const balanced = splitIntoEnvelopes(5000000, { fixed: 2000000, sinking: 1000000, flexible: 2000000 });
checkEqual(balanced.balanced, true, 'when the amounts add up it is balanced');
checkEqual(balanced.remainder, 0, 'when the amounts add up there is no leftover');
check(
  balanced.fixed + balanced.sinking + balanced.flexible === balanced.total,
  'the balanced envelopes add up to the total'
);

// ---------------------------------------------------------------------------
// Moving money between envelopes
// ---------------------------------------------------------------------------
section('moving money between envelopes');

const envelopesForMove = [
  { id: 1, remaining: 500000 },
  { id: 2, remaining: 100000 },
  { id: 3, remaining: 0 },
];

const moved = moveBetweenEnvelopes(envelopesForMove, 1, 2, 200000);
checkEqual(moved.ok, true, 'a move that has the money is allowed');
checkEqual(moved.moved, 200000, 'the amount that moved is the amount asked for');
checkEqual(moved.envelopes[0].remaining, 300000, 'the source envelope has less');
checkEqual(moved.envelopes[1].remaining, 300000, 'the target envelope has more');

const tooMuch = moveBetweenEnvelopes(envelopesForMove, 3, 2, 100000);
checkEqual(tooMuch.ok, false, 'a move without the money is refused');
checkEqual(tooMuch.reason, 'short', 'the refusal says the money is short');
checkEqual(tooMuch.available, 0, 'the refusal says how much there was');

const same = moveBetweenEnvelopes(envelopesForMove, 1, 1, 1000);
checkEqual(same.reason, 'same', 'moving money to itself is refused');

const nowhere = moveBetweenEnvelopes(envelopesForMove, 1, 99, 1000);
checkEqual(nowhere.reason, 'envelope', 'moving money to an envelope that is not there is refused');

const movingNothing = moveBetweenEnvelopes(envelopesForMove, 1, 2, 0);
checkEqual(movingNothing.reason, 'amount', 'moving nothing is refused');

const negative = moveBetweenEnvelopes(envelopesForMove, 1, 2, -500);
checkEqual(negative.reason, 'amount', 'moving a negative amount is refused');

const afterMove = moved.envelopes.reduce((sum, e) => sum + e.remaining, 0);
const beforeMove = envelopesForMove.reduce((sum, e) => sum + e.remaining, 0);
checkEqual(afterMove, beforeMove, 'a move does not create or destroy money');

// ---------------------------------------------------------------------------
// The rollover
// ---------------------------------------------------------------------------
section('rollover');

const budgets = [
  { id: 1, name: 'Sewa', amount: 2000000, spent: 2000000 },
  { id: 2, name: 'Belanja', amount: 1000000, spent: 400000 },
  { id: 3, name: 'Kelebihan', amount: 500000, spent: 700000 },
];

const rolled = rolloverFor(budgets, { 2: true });
checkEqual(rolled.rows[0].leftover, 0, 'a budget that was spent exactly has nothing left');
checkEqual(rolled.rows[0].rollover, 0, 'a budget with the rollover off carries nothing');
checkEqual(rolled.rows[1].leftover, 600000, 'a budget that was not spent has the rest left');
checkEqual(rolled.rows[1].rollover, 600000, 'the budget with the rollover on carries the rest');
checkEqual(rolled.rows[2].leftover, -200000, 'a budget that was overspent has less than nothing');
checkEqual(rolled.rows[2].overspent, true, 'a budget that was overspent says so');
checkEqual(rolled.rows[2].rollover, 0, 'a budget that was overspent carries nothing');
checkEqual(rolled.carried, 600000, 'the total that carries over is added up');

// ---------------------------------------------------------------------------
// The order to pay the debts in
// ---------------------------------------------------------------------------
section('debt order');

const debts = [
  { id: 1, name: 'Besar', current_balance: 5000000, interest_rate: 0.1 },
  { id: 2, name: 'Kecil', current_balance: 500000, interest_rate: 0.02 },
  { id: 3, name: 'Bunga tinggi', current_balance: 3000000, interest_rate: 0.24 },
  { id: 4, name: 'Lunas', current_balance: 0, interest_rate: 0.2 },
];

const snowball = orderDebts(debts, 'snowball');
checkEqual(snowball.length, 3, 'a debt that is cleared is not in the order');
checkEqual(snowball[0].name, 'Kecil', 'the snowball starts with the smallest balance');
checkEqual(snowball[0].order, 1, 'the first debt is number one');
checkEqual(snowball[2].name, 'Besar', 'the snowball ends with the largest balance');

const avalanche = orderDebts(debts, 'avalanche');
checkEqual(avalanche[0].name, 'Bunga tinggi', 'the avalanche starts with the highest interest');
checkEqual(avalanche[2].name, 'Kecil', 'the avalanche ends with the lowest interest');

checkEqual(DEBT_STRATEGIES.length, 2, 'there are two ways to order the debts');
checkEqual(
  DEBT_STRATEGIES.map((s) => s.key).join(','),
  'snowball,avalanche',
  'the two ways are named the way Goodbudget names them'
);

// ---------------------------------------------------------------------------
// The payoff simulator
// ---------------------------------------------------------------------------
section('the payoff simulator');

const debt = {
  current_balance: 12000000,
  interest_rate: 0.12,
  monthly_payment: 1000000,
};

const noExtra = payoffWithExtra(debt, 0);
checkEqual(noExtra.ok, true, 'a debt with a payment can be worked out');
check(noExtra.baseline.cleared, 'the debt is cleared without the extra');
checkEqual(noExtra.monthsSaved, 0, 'with no extra there are no months saved');

const withExtra = payoffWithExtra(debt, 500000);
check(withExtra.withExtra.months < noExtra.baseline.months, 'the extra clears it sooner');
check(withExtra.interestSaved > 0, 'the extra saves interest');
check(withExtra.monthsSaved > 0, 'the extra saves months');
check(
  withExtra.withExtra.interest < noExtra.baseline.interest,
  'paying more means less interest in total'
);

const paid = payoffWithExtra({ current_balance: 0, monthly_payment: 1000 }, 0);
checkEqual(paid.ok, false, 'a debt that is cleared cannot be worked out');
checkEqual(paid.reason, 'paid', 'the refusal says the debt is paid');

const noPayment = payoffWithExtra({ current_balance: 1000, monthly_payment: 0 }, 0);
checkEqual(noPayment.ok, false, 'a debt with no payment cannot be worked out');
checkEqual(noPayment.reason, 'no-payment', 'the refusal says there is no payment');

// The interest must be worked out on the balance that is left, the way
// a bank works it out. A flat amount would not match the statement.
const manual = (() => {
  let remaining = 12000000;
  let interestPaid = 0;
  for (let month = 0; month < noExtra.baseline.months; month += 1) {
    const interest = Math.round(remaining * (0.12 / 12));
    interestPaid += interest;
    remaining = remaining + interest - 1000000;
    if (remaining < 0) remaining = 0;
  }
  return interestPaid;
})();
checkEqual(noExtra.baseline.interest, manual, 'the interest matches the month by month working');

// ---------------------------------------------------------------------------
// The whole picture
// ---------------------------------------------------------------------------
section('net worth');

const worth = netWorth({
  accounts: [
    { id: 1, balance: 5000000, account_type: 'bank' },
    { id: 2, balance: 2000000, account_type: 'savings' },
    { id: 3, balance: 1000000, account_type: 'credit_card', is_credit: true },
  ],
  debts: [{ id: 1, current_balance: 3000000 }],
});
checkEqual(worth.assets, 7000000, 'the credit card is not counted as something held');
checkEqual(worth.liabilities, 3000000, 'what is owed is what is owed');
checkEqual(worth.net, 4000000, 'what is held minus what is owed');
checkEqual(worth.positive, true, 'the reader is ahead');

const behind = netWorth({
  accounts: [{ id: 1, balance: 1000000, account_type: 'bank' }],
  debts: [{ id: 1, current_balance: 5000000 }],
});
checkEqual(behind.net, -4000000, 'owing more than held shows as negative');
checkEqual(behind.positive, false, 'owing more than held says so');

// ---------------------------------------------------------------------------
// The rainy day
// ---------------------------------------------------------------------------
section('the rainy day');

const fund = emergencyFund({ months: 6, savings: 4000000, monthlyEssentials: 1000000 });
checkEqual(fund.target, 6000000, 'six months of essentials is the target');
checkEqual(fund.gap, 2000000, 'the gap is what is missing');
checkEqual(fund.covered, false, 'not enough saved says so');
checkEqual(fund.coveredMonths, 4, 'the money covers four months');

const covered = emergencyFund({ months: 3, savings: 5000000, monthlyEssentials: 1000000 });
checkEqual(covered.covered, true, 'enough saved says so');
checkEqual(covered.gap, 0, 'no gap when it is covered');

checkEqual(EMERGENCY_MONTHS.map((m) => m.key).join(','), '3,6,12', 'the three horizons');

// ---------------------------------------------------------------------------
// What if
// ---------------------------------------------------------------------------
section('what if');

const scenario = savingScenario({
  currentSavings: 1000000,
  monthlySaving: 500000,
  extraMonthly: 100000,
  months: 12,
});
checkEqual(scenario.monthly, 600000, 'the extra is added to the monthly saving');
checkEqual(scenario.after, 8200000, 'a year of 600 thousand on one million');
checkEqual(scenario.withoutExtra, 7000000, 'a year of 500 thousand on one million');
checkEqual(scenario.difference, 1200000, 'the extra is worth 1.2 million over a year');

const plainScenario = savingScenario({
  currentSavings: 1000000,
  monthlySaving: 500000,
  months: 12,
});
checkEqual(plainScenario.difference, 0, 'with no extra there is no difference');
checkEqual(plainScenario.after, 7000000, 'a year of 500 thousand on one million');

// ---------------------------------------------------------------------------
// The flow of the money
// ---------------------------------------------------------------------------
section('the flow of the money');

const flow = cashFlowLinks({
  income: [{ id: 1, label: 'Gaji', value: 5000000 }],
  expense: [
    { id: 2, label: 'Makan', value: 1000000 },
    { id: 3, label: 'Sewa', value: 2000000 },
  ],
});
checkEqual(flow.inTotal, 5000000, 'the money that came in is added up');
checkEqual(flow.outTotal, 3000000, 'the money that went out is added up');
checkEqual(flow.difference, 2000000, 'the difference is what is left');
checkEqual(flow.sources.length, 1, 'one source');
checkEqual(flow.sinks.length, 2, 'two sinks');
check(
  flow.links.reduce((sum, link) => sum + link.value, 0) === flow.inTotal + flow.outTotal,
  'the links carry the money that moved'
);

// ---------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------
section('the rows');

const rows = spendingRows(
  [
    { amount: 100000, date: '2026-11-01' },
    { amount: 60000, date: '2026-11-01' },
    { amount: 400000, date: '2026-11-02' },
    { amount: -50000, date: '2026-11-03' },
  ],
  { dailyLimit: 200000 }
);
checkEqual(rows.rows.length, 2, 'the days that had spending are the rows');
checkEqual(rows.rows[0].total, 160000, 'the same day is added up');
checkEqual(rows.rows[0].over, false, 'a day under the limit is not marked');
checkEqual(rows.rows[1].total, 400000, 'the second day');
checkEqual(rows.rows[1].over, true, 'a day over the limit is marked');
checkEqual(rows.total, 560000, 'the total of the rows');
checkEqual(rows.overCount, 1, 'one day went over');

// ---------------------------------------------------------------------------
// One transaction, several categories
// ---------------------------------------------------------------------------
section('one transaction, several categories');

const split = splitToCategories(100000, [
  { categoryId: 1, ratio: 60 },
  { categoryId: 2, ratio: 40 },
]);
checkEqual(split.length, 2, 'the purchase is in two categories');
checkEqual(split[0].amount, 60000, 'the first part');
checkEqual(split[1].amount, 40000, 'the second part');
checkEqual(
  split.reduce((sum, part) => sum + part.amount, 0),
  100000,
  'the parts add up to the transaction'
);

const lumpy = splitToCategories(100000, [
  { categoryId: 1, ratio: 1 },
  { categoryId: 2, ratio: 1 },
  { categoryId: 3, ratio: 1 },
]);
checkEqual(
  lumpy.reduce((sum, part) => sum + part.amount, 0),
  100000,
  'three parts add up to the transaction exactly, even when they cannot be divided'
);

checkEqual(splitToCategories(100000, []).length, 0, 'with no parts there is no split');
checkEqual(
  splitToCategories(100000, [{ categoryId: null, ratio: 1 }]).length,
  0,
  'a part with no category is not a part'
);

// ---------------------------------------------------------------------------
// The subscriptions that are not used
// ---------------------------------------------------------------------------
section('the subscriptions that are not used');

const now = new Date();
const longAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

const unused = unusedSubscriptions(
  [
    { id: 1, name: 'Netflix', amount: 54000, last_run_at: longAgo },
    { id: 2, name: 'Spotify', amount: 54000, last_run_at: lastMonth },
    { id: 3, name: 'Gym', amount: 150000 },
  ],
  { monthsIdle: 3 }
);
checkEqual(unused.length, 2, 'the one that ran recently and the one never ran');
checkEqual(unused[0].id, 1, 'the one that stopped running is first');
checkEqual(unused[0].idle, true, 'the one that stopped running is idle');
checkEqual(unused[1].neverUsed, true, 'the one that never ran says so');
checkEqual(unused[1].idle, false, 'the one that never ran is not idle, it is unknown');

// ---------------------------------------------------------------------------
// The reading of an account
// ---------------------------------------------------------------------------
section('the reading of an account');

checkEqual(reconcileBalance({ recorded: 5000000, bank: 5000000 }).matched, true, 'the same is matched');
checkEqual(reconcileBalance({ recorded: 5000000, bank: 5000000 }).state, 'matched', 'and says so');
const higher = reconcileBalance({ recorded: 5200000, bank: 5000000 });
checkEqual(higher.difference, 200000, 'the difference is the difference');
checkEqual(higher.state, 'higher', 'the application is higher than the bank');
const lower = reconcileBalance({ recorded: 4800000, bank: 5000000 });
checkEqual(lower.state, 'lower', 'the application is lower than the bank');

// ---------------------------------------------------------------------------
// How fresh the data is
// ---------------------------------------------------------------------------
section('how fresh the data is');

const fresh = dataFreshness({ updatedAt: new Date().toISOString(), pendingReview: 0 });
checkEqual(fresh.accurate, true, 'nothing waiting means the data is accurate');
checkEqual(fresh.updated, true, 'the time of the last update is known');
checkEqual(fresh.state, 'just-now', 'updated a moment ago says so');

const waiting = dataFreshness({ updatedAt: new Date().toISOString(), pendingReview: 3 });
checkEqual(waiting.accurate, false, 'something waiting means it needs a look');
checkEqual(waiting.state, 'review', 'something waiting says so');

const unknown = dataFreshness({});
checkEqual(unknown.updated, false, 'with no time there is no claim about freshness');

checkEqual(DAYS_PER_MONTH, 30, 'a month is thirty days for the daily figure');

// ---------------------------------------------------------------------------
// The strategies that are known
// ---------------------------------------------------------------------------
section('the strategies that are known');

checkEqual(debtStrategyIsKnown('snowball'), true, 'snowball is a strategy');
checkEqual(debtStrategyIsKnown('avalanche'), true, 'avalanche is a strategy');
checkEqual(debtStrategyIsKnown('whatever'), false, 'anything else is not a strategy');

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------
console.log(`\nfintech: ${checks} checks, ${failures} failed`);
if (failures > 0) {
  process.exit(1);
}
