/**
 * The four widgets that answer a question straight away.
 *
 * Four things were asked for, and they are not four features so much
 * as four answers:
 *
 * - How much can I spend today without trouble? (the safe-to-spend
 *   figure on the dashboard)
 * - Which way do I want to run my money? (the three budgeting styles)
 * - Where did the money go? (the flow diagram on the analytics page)
 * - Do my figures agree with my bank? (the reconciliation bar)
 *
 * The arithmetic lives here so that the pages that draw these answers
 * all work them out the same way. A figure that two pages calculate
 * differently is a figure the reader will not trust.
 *
 * Nothing here touches the reader's records. These are readings of
 * what is already there.
 */

import { roundRupiah, DAYS_PER_MONTH } from './fintech.js';

// ---------------------------------------------------------------------------
// How much can be spent today
// ---------------------------------------------------------------------------

/**
 * What a bill costs in a month.
 *
 * The reader has bills that come every week, every month, every
 * quarter and every year. To know what the next thirty days will
 * cost, each one has to be turned into a monthly figure.
 *
 * A bill that comes every week comes a little over four times a
 * month, so a week is worth a little more than a fourth of a month.
 * A bill that comes every day comes thirty times. The yearly bill is
 * worth a twelfth.
 *
 * The rates are named rather than written out as numbers, so the
 * reason for each one can be read next to it.
 */
const MONTHLY_RATES = {
  daily: 30,
  weekly: 4.345,
  biweekly: 2.1726,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  custom: 1,
};

/**
 * What one bill costs in a month.
 *
 * A bill that comes every other week costs two weeks in a month, so
 * its rate is 2.1726 rather than 2. The number of weeks in a month
 * is 52 / 12, which is 4.345.
 */
export function monthlyCostOf(rule) {
  const amount = Number(rule?.amount) || 0;
  const frequency = String(rule?.frequency || 'monthly').toLowerCase();
  const interval = Math.max(1, Number(rule?.interval_value) || 1);
  let rate = MONTHLY_RATES[frequency];
  if (rate === undefined) rate = 1;
  // Every N days, weeks or months: the period is N times longer.
  if (interval > 1) rate = rate / interval;
  return roundRupiah(amount * rate);
}

/**
 * The bills that are coming in the next thirty days.
 *
 * Only bills that are active count. A bill that has been switched
 * off is not going to arrive, and counting it would make the figure
 * on the dashboard wrong.
 */
export function billsDueWithin30Days(rules = []) {
  const total = (rules || [])
    .filter((rule) => rule && rule.is_active !== false && rule.type !== 'income')
    .reduce((sum, rule) => sum + monthlyCostOf(rule), 0);
  return roundRupiah(total);
}

/**
 * What the reader has promised to put aside.
 *
 * The goals that have a target and a deadline are the ones that are
 * really being saved for. A goal with no deadline is a wish, not a
 * promise, and it should not eat into the money available today.
 *
 * The monthly amount is what has to be put away each month to get
 * there on time. When the deadline has passed, the goal is not
 * counted: the reader cannot save into the past.
 */
export function monthlySavingsTarget(goals = [], { income = 0 } = {}) {
  const now = new Date();
  let total = 0;
  for (const goal of goals || []) {
    if (!goal) continue;
    const target = Number(goal.target_amount) || 0;
    const saved = Number(goal.current_amount) || 0;
    const monthly = Number(goal.monthly_contribution) || 0;
    const remaining = Math.max(0, target - saved);
    if (remaining <= 0) continue;

    let needed = monthly;
    if (!needed) {
      const deadline = goal.deadline ? new Date(goal.deadline) : null;
      if (!deadline || Number.isNaN(deadline.getTime())) continue;
      const monthsLeft = Math.max(
        1,
        Math.ceil((deadline.getTime() - now.getTime()) / (DAYS_PER_MONTH * 86400000))
      );
      needed = Math.ceil(remaining / monthsLeft);
    }
    total += needed;
  }

  // A promise bigger than the income is not a promise the reader can
  // keep, so it is capped and the shortfall is reported separately.
  const cap = Number(income) || 0;
  const capped = cap > 0 ? Math.min(total, cap) : total;
  return {
    target: roundRupiah(total),
    counted: roundRupiah(capped),
    shortfall: roundRupiah(Math.max(0, total - capped)),
    overIncome: cap > 0 && total > cap,
  };
}

/**
 * The money that is safe to spend today.
 *
 * The figure on the dashboard, and the first thing the reader sees.
 *
 * It is the cash they hold, less what is already promised for the
 * next thirty days, less what they have promised to save.
 *
 * When the answer is below zero, the reader has promised more than
 * they hold. That is worth saying plainly rather than showing a
 * negative number on a banner, so the shortfall is reported next to
 * the figure.
 */
export function safeToSpendToday({
  cash = 0,
  rules = [],
  goals = [],
  income = 0,
} = {}) {
  const available = roundRupiah(Number(cash) || 0);
  const bills = billsDueWithin30Days(rules);
  const savings = monthlySavingsTarget(goals, { income });
  const counted = savings.counted;

  const safe = roundRupiah(available - bills - counted);
  const shortfall = roundRupiah(Math.max(0, bills + counted - available));

  return {
    available,
    bills,
    savings: counted,
    savingsPromised: savings.target,
    savingsShortfall: savings.shortfall,
    overIncome: savings.overIncome,
    safe,
    // Below zero is not a number to spend, so it is reported as a
    // shortfall instead.
    shortfall,
    comfortable: safe > 0,
    tight: safe > 0 && safe < available * 0.1,
  };
}

// ---------------------------------------------------------------------------
// Which way the reader wants to run their money
// ---------------------------------------------------------------------------

/**
 * The three ways to run a budget.
 *
 * They are three ways of looking at the same money, not three kinds
 * of money. Switching between them never changes what is recorded -
 * it changes how it is shown and what the reader can do with it.
 */
export const BUDGET_METHODS = [
  {
    key: 'flex',
    fallback: 'Sederhana',
    // What the reader gets, in one line.
    summaryKey: 'method_flex_summary',
    detailKey: 'method_flex_detail',
    // Whether the reader can move money between categories.
    canTransfer: false,
    // Whether each category can carry its leftover over.
    canRollover: false,
    // Whether the page shows the three groups.
    showsEnvelopes: true,
  },
  {
    key: 'envelope',
    fallback: 'Amplop',
    summaryKey: 'method_envelope_summary',
    detailKey: 'method_envelope_detail',
    canTransfer: true,
    canRollover: true,
    showsEnvelopes: true,
  },
  {
    key: 'zero',
    fallback: 'Zero-based',
    summaryKey: 'method_zero_summary',
    detailKey: 'method_zero_detail',
    canTransfer: true,
    canRollover: true,
    showsEnvelopes: false,
  },
];

/**
 * Is this one of the three methods?
 *
 * A method can arrive from a bookmark, an old link or a saved
 * preference that was written before a method was removed. This says
 * no rather than returning something that is not a method.
 */
export function budgetMethodIsKnown(method) {
  return BUDGET_METHODS.some((m) => m.key === method);
}

/**
 * The method, or the first one if it is not known.
 */
export function resolveBudgetMethod(method) {
  return budgetMethodIsKnown(method) ? method : BUDGET_METHODS[0].key;
}

/**
 * What the zero-based method shows.
 *
 * Every rupiah of income is given a job, so what is left over is
 * nothing. That is the whole idea: the reader either has money with
 * nowhere to go, or has promised more than they have.
 *
 * The two are told apart, because they are different problems. Money
 * with nowhere to go is a plan that is too tight. Money promised
 * beyond the income is a plan that cannot be kept.
 */
export function zeroBasedState({
  income = 0,
  allocated = 0,
  cash = 0,
} = {}) {
  const earned = roundRupiah(Number(income) || 0);
  const given = roundRupiah(Number(allocated) || 0);
  const unassigned = roundRupiah(earned - given);
  const held = roundRupiah(Number(cash) || 0);

  return {
    income: earned,
    allocated: given,
    // What is left over. In this method it should be nothing.
    unassigned,
    // What the reader actually holds, which is not the same thing:
    // it is what is left after everything already promised.
    held,
    // Whether every rupiah has been given a job.
    balanced: unassigned === 0,
    // More promised than earned.
    overAllocated: unassigned < 0,
    // Money earned and not yet given a job.
    underAllocated: unassigned > 0,
  };
}

// ---------------------------------------------------------------------------
// Where the money went
// ---------------------------------------------------------------------------

/**
 * The links in the flow diagram.
 *
 * The diagram has three columns:
 *
 * - left: where the money came from, by name;
 * - middle: what it was spent on;
 * - right: what is left over - the wealth, against what was spent.
 *
 * The links are worked out from the transactions themselves, so the
 * diagram can only ever say what the records actually say.
 */
export function flowDiagram({ income = [], expense = [] } = {}) {
  const sources = [];
  const middle = [];
  const sinks = [];

  for (const item of income || []) {
    sources.push({
      key: item.key,
      label: item.label,
      value: roundRupiah(Number(item.value) || 0),
    });
  }
  for (const item of expense || []) {
    middle.push({
      key: item.key,
      label: item.label,
      value: roundRupiah(Number(item.value) || 0),
    });
  }

  const earned = sources.reduce((sum, s) => sum + s.value, 0);
  const spent = middle.reduce((sum, m) => sum + m.value, 0);

  sinks.push({ key: 'saved', label: 'saved', value: roundRupiah(Math.max(0, earned - spent)) });
  sinks.push({ key: 'spent', label: 'spent', value: roundRupiah(spent) });

  return {
    sources: sources.filter((s) => s.value > 0),
    middle: middle.filter((m) => m.value > 0),
    sinks,
    earned: roundRupiah(earned),
    spent: roundRupiah(spent),
  };
}

/**
 * The income and the spending, grouped by name.
 *
 * The diagram is only as good as the grouping, so the names come
 * from the records: the category name for spending, and the payer's
 * name for income.
 */
export function flowFromTransactions(transactions = [], { categoryName } = {}) {
  const income = new Map();
  const expense = new Map();

  for (const t of transactions || []) {
    if (!t) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    if (!amount) continue;
    const isIncome = t.type === 'income';

    let key = t.category_name || t.category || '';
    let label = key;
    if (isIncome) {
      key = t.description || t.source || 'income';
      label = key;
    } else if (typeof categoryName === 'function' && t.category_id) {
      label = categoryName(t.category_id) || label;
    }

    const bucket = isIncome ? income : expense;
    const existing = bucket.get(key);
    if (existing) {
      existing.value = roundRupiah(existing.value + amount);
    } else {
      bucket.set(key, { key, label: label || 'other', value: amount });
    }
  }

  return flowDiagram({
    income: [...income.values()].sort((a, b) => b.value - a.value),
    expense: [...expense.values()].sort((a, b) => b.value - a.value),
  });
}

// ---------------------------------------------------------------------------
// Do the figures agree with the bank
// ---------------------------------------------------------------------------

/**
 * What the reconciliation bar says.
 *
 * The reader types in what their bank says. There are three answers:
 *
 * - it matches, and nothing needs doing;
 * - the application is higher than the bank, which usually means a
 *   transaction was entered twice;
 * - the application is lower, which usually means a transaction is
 *   missing.
 *
 * The bar is the one place the reader looks to find out whether the
 * numbers can be trusted, so it says which of the two it is and what
 * to do about it.
 */
export function reconciliationState({ recorded = 0, bank = 0 } = {}) {
  const app = roundRupiah(Number(recorded) || 0);
  const statement = roundRupiah(Number(bank) || 0);
  const difference = roundRupiah(app - statement);

  return {
    recorded: app,
    bank: statement,
    difference,
    matched: difference === 0,
    // The application says more than the bank does.
    higher: difference > 0,
    // The application says less than the bank does.
    lower: difference < 0,
    // A difference the reader has to look at.
    needsReview: difference !== 0,
    state: difference === 0 ? 'matched' : difference > 0 ? 'higher' : 'lower',
  };
}

/**
 * The adjustment entry, when there is one to make.
 *
 * The reader is not asked to fix the difference by hand. They are
 * asked to say what it is, and the application writes the entry that
 * closes the gap. The entry is a suggestion: it is shown before it is
 * written, so nothing changes until the reader says so.
 */
export function adjustmentFor(state, { reason = 'reconciliation' } = {}) {
  if (!state || state.matched) {
    return { ok: false, reason: 'matched', entry: null };
  }
  const amount = Math.abs(state.difference);
  // The application is higher than the bank, so the entry takes money
  // out. The application is lower, so the entry puts money in.
  const type = state.higher ? 'expense' : 'income';
  return {
    ok: true,
    entry: {
      type,
      amount,
      description: reason,
      // The entry brings the application to what the bank says.
      after: state.bank,
    },
  };
}


/**
 * What the application holds.
 *
 * The sum of the balances of the accounts. It is the figure the
 * accounts page shows, so the reconciliation bar on the transactions
 * page and the one on the accounts page can be compared with each
 * other - which they have to be, or the reader is shown two different
 * answers to the same question.
 */
export function heldCash(accounts = []) {
  const total = (accounts || []).reduce(
    (sum, account) => sum + (Number(account.balance) || 0),
    0
  );
  return roundRupiah(total);
}

export default {
  heldCash,
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
};
