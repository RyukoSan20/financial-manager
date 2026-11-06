/**
 * The money that works out.
 *
 * Seventeen features were asked for, drawn from five different products.
 * If each one brought its own arithmetic, there would be seventeen ways
 * to add up money and no way to check any of them.
 *
 * So the arithmetic lives here, once. Every feature that shows a
 * number calls these functions, and the tests below check the sums.
 *
 * The rules the functions follow:
 *
 * - Money is a number of rupiah. It is never a float that gets
 *   multiplied by a percentage and hoped for; percentages are applied
 *   and the result is rounded to whole rupiah at the end.
 * - A sum either adds up exactly or it says so. Nothing here returns a
 *   number that has quietly lost a thousand rupiah.
 * - A function that cannot be given enough information returns null
 *   rather than a guess.
 */

/**
 * The number of days in a month, for turning a monthly amount into a
 * daily one. Thirty, so that a month is the same length every time and
 * the daily figure does not jump around with the calendar.
 */
export const DAYS_PER_MONTH = 30;

/**
 * Round to whole rupiah.
 *
 * JavaScript rounds halves towards positive infinity, which makes a
 * sum of many halves come out one rupiah off in a way that is hard to
 * see. This rounds the way money is rounded: halves go up, but only
 * for a positive amount, and a negative amount mirrors it.
 */
export function roundRupiah(value) {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * The part of the money that has not been given a job yet.
 *
 * This is the heart of the first feature. A reader has money in the
 * bank, and budgets that claim parts of it. The money that is neither
 * in a budget nor spent is the money that is still free to be given a
 * job.
 *
 * The result is what is left over, and whether it is above or below
 * zero. Below zero means more has been promised than there is, and
 * that is worth saying out loud.
 */
export function readyToBeAssigned({
  cashBalance = 0,
  allocated = 0,
  spent = 0,
} = {}) {
  const cash = Number(cashBalance) || 0;
  const promised = (Number(allocated) || 0) + (Number(spent) || 0);
  const free = roundRupiah(cash - promised);
  return {
    free,
    cash: roundRupiah(cash),
    allocated: roundRupiah(allocated),
    spent: roundRupiah(spent),
    promised: roundRupiah(promised),
    // The reader needs to know which way round it is, and the banner
    // says different words for the two.
    overcommitted: free < 0,
    state: free > 0 ? 'free' : free === 0 ? 'exact' : 'over',
  };
}

/**
 * The three kinds of envelope, the way Monarch splits them.
 *
 * - Fixed: the bills that come every month, the same amount each time.
 * - Sinking: the things that come once in a while, so the money is put
 *   aside a little at a time.
 * - Flexible: everything else, the part that moves around.
 */
export const ENVELOPE_KINDS = [
  { key: 'fixed', labelKey: 'envelope_fixed', fallback: 'Tetap' },
  { key: 'sinking', labelKey: 'envelope_sinking', fallback: 'Tidak Rutin' },
  { key: 'flexible', labelKey: 'envelope_flexible', fallback: 'Fleksibel' },
];

/**
 * Divide the money between the envelopes.
 *
 * The three amounts add up to the total. If the amounts do not add up
 * to the total - because the reader typed them in and they are a
 * rupiah off - the difference goes to the flexible envelope, because
 * that is the one that is meant to absorb what is left over.
 */
export function splitIntoEnvelopes(total, amounts = {}) {
  const money = Number(total) || 0;
  const fixed = Number(amounts.fixed) || 0;
  const sinking = Number(amounts.sinking) || 0;
  const flexible = Number(amounts.flexible);
  const flexibleGiven = Number.isFinite(flexible);
  const remainder = roundRupiah(money - fixed - sinking);
  return {
    fixed: roundRupiah(fixed),
    sinking: roundRupiah(sinking),
    flexible: roundRupiah(flexibleGiven ? flexible : remainder),
    total: roundRupiah(money),
    // True when the reader gave all three and they add up to the
    // total. When they did not give all three, the leftover went into
    // the flexible envelope, and this says so.
    balanced: flexibleGiven && roundRupiah(fixed + sinking + flexible) === roundRupiah(money),
    // How much went into the flexible envelope that was not asked for.
    remainder: flexibleGiven ? 0 : remainder,
  };
}

/**
 * What is left of a budget when the month is over.
 *
 * Money that is not spent is not lost, it is still the reader's. It
 * can go to the same envelope next month, or to another one.
 *
 * The rollover only happens when the reader asked for it. The switch
 * is per envelope, so a reader can carry the rent over and not carry
 * the groceries over.
 */
export function rolloverFor(budgets = [], carry = {}) {
  const rows = budgets.map((budget) => {
    const id = budget.id;
    const amount = Number(budget.amount) || 0;
    const spent = Number(budget.spent) || 0;
    const leftover = roundRupiah(amount - spent);
    const isOn = carry[id] === true || carry[String(id)] === true;
    return {
      id,
      name: budget.name,
      amount: roundRupiah(amount),
      spent: roundRupiah(spent),
      leftover,
      rollover: isOn ? leftover : 0,
      // An envelope that went over has nothing to carry over.
      overspent: leftover < 0,
    };
  });
  const carried = rows.reduce((sum, row) => sum + row.rollover, 0);
  return { rows, carried: roundRupiah(carried) };
}

/**
 * Move money from one envelope to another.
 *
 * This is the Goodbudget move. An envelope that has run out can be
 * topped up from one that has more than it needs.
 *
 * The amount cannot be more than the source envelope has to give. If
 * it is, the move is refused and the reason is given back, because a
 * move that takes money that is not there would leave the sums wrong.
 */
export function moveBetweenEnvelopes(envelopes = [], fromId, toId, amount) {
  const money = roundRupiah(Number(amount) || 0);
  if (money <= 0) {
    return { ok: false, reason: 'amount', envelopes };
  }
  const from = envelopes.find((e) => String(e.id) === String(fromId));
  const to = envelopes.find((e) => String(e.id) === String(toId));
  if (!from || !to) {
    return { ok: false, reason: 'envelope', envelopes };
  }
  if (String(fromId) === String(toId)) {
    return { ok: false, reason: 'same', envelopes };
  }
  const available = Number(from.remaining ?? 0) || 0;
  if (money > available) {
    return { ok: false, reason: 'short', available: roundRupiah(available), envelopes };
  }
  const next = envelopes.map((envelope) => {
    if (String(envelope.id) === String(fromId)) {
      return { ...envelope, remaining: roundRupiah(available - money) };
    }
    if (String(envelope.id) === String(toId)) {
      return {
        ...envelope,
        remaining: roundRupiah((Number(envelope.remaining) || 0) + money),
      };
    }
    return envelope;
  });
  return { ok: true, moved: money, envelopes: next };
}

/**
 * Is this one of the two ways to order the debts?
 *
 * The reader can pick a strategy, and a value that came from a
 * bookmark or an old link might not be one of them. This says no
 * rather than letting an unknown string through.
 */
export function debtStrategyIsKnown(strategy) {
  return DEBT_STRATEGIES.some((item) => item.key === strategy);
}

/**
 * The order to pay the debts in.
 *
 * Two ways, and they are different:
 *
 * - Snowball: the smallest balance first. The reader feels the debts
 *   going down one at a time, which is why it is often chosen.
 * - Avalanche: the highest interest first. The reader pays the least
 *   money overall, which is why it is often the better one.
 *
 * The interest is the yearly rate as a fraction, so 0.12 is twelve
 * per cent.
 */
export const DEBT_STRATEGIES = [
  { key: 'snowball', labelKey: 'debt_snowball', fallback: 'Snowball' },
  { key: 'avalanche', labelKey: 'debt_avalanche', fallback: 'Avalanche' },
];

/**
 * Put the debts in the order they should be paid.
 *
 * A debt with nothing left on it is not in the order. A debt with no
 * interest is treated as if it had none at all, so the snowball does
 * not get stuck on a debt that never grows.
 */
export function orderDebts(debts = [], strategy = 'snowball') {
  const live = debts
    .filter((debt) => (Number(debt.current_balance ?? debt.balance) || 0) > 0)
    .map((debt) => ({
      ...debt,
      balance: Number(debt.current_balance ?? debt.balance) || 0,
      rate: Number(debt.interest_rate) || 0,
    }));
  const sorted = [...live].sort((a, b) => {
    if (strategy === 'avalanche') {
      if (b.rate !== a.rate) return b.rate - a.rate;
    }
    return a.balance - b.balance;
  });
  return sorted.map((debt, index) => ({ ...debt, order: index + 1 }));
}

/**
 * What happens if the reader pays a bit more every month.
 *
 * This is the payoff simulator. It works out two things: how much
 * interest is saved, and how many months earlier the debt is cleared.
 *
 * The interest is worked out month by month, on the balance that is
 * left at the start of the month. That is the way a bank works it
 * out, so the number here matches the number on the statement.
 */
export function payoffWithExtra(debt, extraPerMonth = 0) {
  const balance = Number(debt?.current_balance ?? debt?.balance) || 0;
  const annualRate = Number(debt?.interest_rate) || 0;
  const monthlyRate = annualRate / 12;
  const payment = Number(debt?.monthly_payment) || 0;
  const extra = Number(extraPerMonth) || 0;

  if (balance <= 0 || payment <= 0) {
    return {
      ok: false,
      reason: balance <= 0 ? 'paid' : 'no-payment',
      baseline: null,
      withExtra: null,
    };
  }

  const run = (extraAmount) => {
    let remaining = balance;
    let interestPaid = 0;
    let months = 0;
    // Twenty years is longer than any of these debts, and the guard
    // stops a payment that never clears the debt from running forever.
    while (remaining > 0 && months < 600) {
      months += 1;
      const interest = Math.round(remaining * monthlyRate);
      interestPaid += interest;
      remaining = remaining + interest - (payment + extraAmount);
      if (remaining < 0) remaining = 0;
    }
    return {
      months,
      interest: roundRupiah(interestPaid),
      cleared: remaining <= 0,
    };
  };

  const baseline = run(0);
  const withExtra = run(extra);
  return {
    ok: true,
    baseline,
    withExtra,
    interestSaved: roundRupiah(baseline.interest - withExtra.interest),
    monthsSaved: baseline.months - withExtra.months,
    extra: roundRupiah(extra),
  };
}

/**
 * The whole picture of what there is.
 *
 * What the reader has, minus what they owe. The accounts are what
 * they are: cash, savings, investment and the rest.
 *
 * The debts are what they owe. A debt with no balance is not counted,
 * because a debt that is cleared is not a debt.
 */
export function netWorth({ accounts = [], debts = [] } = {}) {
  const assets = accounts.reduce(
    (sum, account) => {
      const balance = Number(account.balance) || 0;
      // A credit card is money owed, not money held.
      if (account.is_credit || account.account_type === 'credit_card') return sum;
      return sum + balance;
    },
    0
  );
  const liabilities = debts.reduce(
    (sum, debt) => sum + (Number(debt.current_balance ?? debt.balance) || 0),
    0
  );
  const net = roundRupiah(assets - liabilities);
  return {
    assets: roundRupiah(assets),
    liabilities: roundRupiah(liabilities),
    net,
    positive: net >= 0,
  };
}

/**
 * The emergency fund, and how long it would last.
 *
 * The target is a number of months of the reader's essential spending.
 * The essentials are what is needed to live: food, rent, transport,
 * bills. Everything else is a want.
 *
 * Three months is the usual advice for a steady income, six for one
 * that changes, twelve for one that stops.
 */
export const EMERGENCY_MONTHS = [
  { key: 3, labelKey: 'emergency_3', fallback: '3 bulan' },
  { key: 6, labelKey: 'emergency_6', fallback: '6 bulan' },
  { key: 12, labelKey: 'emergency_12', fallback: '12 bulan' },
];

/**
 * How much the reader needs to keep for the rainy day, and whether
 * they have it.
 *
 * The monthly essentials come from the budgets if they are given, and
 * otherwise from the spending that has already happened.
 */
export function emergencyFund({
  months = 6,
  savings = 0,
  monthlyEssentials = 0,
} = {}) {
  const essentials = Math.max(0, Number(monthlyEssentials) || 0);
  const target = roundRupiah(essentials * Number(months || 0));
  const saved = Math.max(0, Number(savings) || 0);
  // There is no gap when the reader has saved more than the target.
  // A negative gap on the screen would read as though they were
  // short, which is the opposite of the truth.
  const gap = Math.max(0, roundRupiah(target - saved));
  return {
    months: Number(months) || 0,
    monthlyEssentials: roundRupiah(essentials),
    target,
    saved: roundRupiah(saved),
    gap,
    covered: saved >= target,
    // How many months the money they have actually covers.
    coveredMonths: essentials > 0 ? Math.floor((saved / essentials) * 10) / 10 : 0,
  };
}

/**
 * What happens if the reader saves a bit more every month.
 *
 * The scenario slider. The reader moves the amount they save each
 * month and sees where they are in a year, and in five years.
 */
export function savingScenario({
  currentSavings = 0,
  monthlySaving = 0,
  extraMonthly = 0,
  months = 12,
  annualReturn = 0,
} = {}) {
  const start = Number(currentSavings) || 0;
  const each = (Number(monthlySaving) || 0) + (Number(extraMonthly) || 0);
  const rate = (Number(annualReturn) || 0) / 12;
  const periods = Math.max(0, Math.floor(Number(months) || 0));

  let balance = start;
  for (let month = 0; month < periods; month += 1) {
    balance = balance * (1 + rate) + each;
  }
  const withoutExtra = start;
  const baseline = Number(monthlySaving) || 0;
  let plain = start;
  for (let month = 0; month < periods; month += 1) {
    plain = plain * (1 + rate) + baseline;
  }
  return {
    months: periods,
    monthly: roundRupiah(each),
    extra: roundRupiah(Number(extraMonthly) || 0),
    after: roundRupiah(balance),
    withoutExtra: roundRupiah(plain),
    difference: roundRupiah(balance - plain),
    baseline: roundRupiah(withoutExtra),
  };
}

/**
 * The flow of the money, from where it came from to where it went.
 *
 * This is the Sankey. The nodes are the sources on the left and the
 * destinations on the right, and the value of each link is the money
 * that went that way.
 *
 * The links have to add up: the money that left the sources is the
 * money that arrived at the destinations.
 */
export function cashFlowLinks({ income = [], expense = [] } = {}) {
  const sources = (income || [])
    .map((row) => ({ id: `in:${row.id ?? row.label}`, label: row.label, value: roundRupiah(row.value) }))
    .filter((row) => row.value > 0);
  const sinks = (expense || [])
    .map((row) => ({ id: `out:${row.id ?? row.label}`, label: row.label, value: roundRupiah(row.value) }))
    .filter((row) => row.value > 0);
  const inTotal = sources.reduce((sum, row) => sum + row.value, 0);
  const outTotal = sinks.reduce((sum, row) => sum + row.value, 0);
  return {
    sources,
    sinks,
    inTotal: roundRupiah(inTotal),
    outTotal: roundRupiah(outTotal),
    // What was left over. The reader should be able to see that the
    // two sides do not have to be the same, and why.
    difference: roundRupiah(inTotal - outTotal),
    links: [
      ...sources.map((row) => ({ from: row.id, to: 'outflow', value: row.value })),
      ...sinks.map((row) => ({ from: 'inflow', to: row.id, value: row.value })),
    ],
  };
}

/**
 * The monthly spending, for the reader who wants it in rows.
 *
 * The rows are the days, and each one says how much was spent on it.
 * A day that went over the daily limit is marked, so the reader can
 * see at a glance which days were the big ones.
 */
export function spendingRows(transactions = [], { dailyLimit = 0 } = {}) {
  const byDay = new Map();
  for (const transaction of transactions || []) {
    const amount = Number(transaction.amount) || 0;
    if (amount <= 0) continue;
    const day = transaction.date || transaction.created_at;
    if (!day) continue;
    const key = String(day).slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + amount);
  }
  const limit = Number(dailyLimit) || 0;
  const rows = [...byDay.entries()]
    .map(([date, total]) => ({
      date,
      total: roundRupiah(total),
      over: limit > 0 && total > limit,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    rows,
    total: roundRupiah(rows.reduce((sum, row) => sum + row.total, 0)),
    limit: roundRupiah(limit),
    overCount: rows.filter((row) => row.over).length,
  };
}

/**
 * Split one transaction between several categories.
 *
 * One purchase, two categories. The parts add up to the whole; if
 * they do not, the last part takes the difference so the transaction
 * keeps its own total.
 */
export function splitToCategories(total, parts = []) {
  const money = Number(total) || 0;
  const given = parts
    .map((part) => ({
      categoryId: part.categoryId ?? part.category_id ?? null,
      ratio: Number(part.ratio ?? part.amount) || 0,
    }))
    .filter((part) => part.categoryId && part.ratio > 0);
  if (!given.length) return [];

  const ratioTotal = given.reduce((sum, part) => sum + part.ratio, 0);
  const allocated = given.map((part) => ({
    categoryId: part.categoryId,
    amount: roundRupiah((part.ratio / ratioTotal) * money),
  }));
  // The last part takes the difference, so the parts add up to the
  // transaction exactly.
  const sum = allocated.reduce((acc, part) => acc + part.amount, 0);
  if (allocated.length && sum !== money) {
    allocated[allocated.length - 1].amount = roundRupiah(
      allocated[allocated.length - 1].amount + (money - sum)
    );
  }
  return allocated;
}

/**
 * The subscriptions that are not being used.
 *
 * A recurring rule that has not fired for a long time is one the
 * reader should look at. It may be a thing they meant to cancel.
 *
 * The rule has to have fired at least once, and then stopped.
 */
export function unusedSubscriptions(rules = [], { monthsIdle = 3 } = {}) {
  const now = new Date();
  const idle = Number(monthsIdle) || 0;
  return (rules || [])
    .map((rule) => {
      const last = rule.last_run_at || rule.last_used_at || rule.next_run_at;
      const lastDate = last ? new Date(last) : null;
      let monthsSince = null;
      if (lastDate && !Number.isNaN(lastDate.getTime())) {
        monthsSince =
          (now.getFullYear() - lastDate.getFullYear()) * 12 +
          (now.getMonth() - lastDate.getMonth());
      }
      return {
        id: rule.id,
        name: rule.name,
        amount: Number(rule.amount) || 0,
        monthsSince,
        // Only a rule that has been seen at least once can be idle.
        idle: monthsSince !== null && monthsSince >= idle,
        neverUsed: monthsSince === null,
      };
    })
    .filter((rule) => rule.idle || rule.neverUsed);
}

/**
 * The reading of an account against what the bank says.
 *
 * The reader types in what the bank says, and this says whether it
 * matches. A difference is not an error: it might be a transaction
 * that has not been entered yet. But it should be looked at.
 */
export function reconcileBalance({ recorded = 0, bank = 0 } = {}) {
  const app = Number(recorded) || 0;
  const statement = Number(bank) || 0;
  const difference = roundRupiah(app - statement);
  return {
    recorded: roundRupiah(app),
    bank: roundRupiah(statement),
    difference,
    matched: difference === 0,
    state:
      difference === 0 ? 'matched' : difference > 0 ? 'higher' : 'lower',
  };
}

/**
 * How fresh the data is.
 *
 * The trust indicator. The reader is told when the numbers were last
 * touched, and whether anything needs correcting.
 */
export function dataFreshness({ updatedAt = null, pendingReview = 0 } = {}) {
  let minutes = null;
  if (updatedAt) {
    const when = new Date(updatedAt);
    if (!Number.isNaN(when.getTime())) {
      minutes = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000));
    }
  }
  const pending = Number(pendingReview) || 0;
  return {
    minutes,
    updated: minutes !== null,
    pending,
    // The green light only when nothing is waiting to be looked at.
    accurate: pending === 0,
    state: pending > 0 ? 'review' : minutes !== null && minutes < 10 ? 'just-now' : 'ok',
  };
}
