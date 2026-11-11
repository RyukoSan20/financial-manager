/**
 * The financial profile card.
 *
 * The card at the top of the dashboard has nine chapters, and the
 * reader moves between them by clicking or by swiping.
 *
 * What is held here:
 *
 * - the nine chapters are all there, and each has its own key;
 * - each chapter has one number that matters, and it is the number
 *   the reader came for;
 * - a chapter with nothing in it says so, rather than showing a
 *   confident zero;
 * - the thirty-day line holds the points that are coming, in order;
 * - and every chapter that has a page of its own offers it, so the
 *   card is a way into the application and not a dead end.
 */

import assert from 'node:assert/strict';

import {
  CHAPTERS,
  DEFAULT_CHAPTER,
  chapterHeadline,
  chapterDetails,
  chapterLink,
  timelinePoints,
  timelineTodayPosition,
  number,
} from '../financialProfile.js';

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

// The words the card asks for. The real card uses a translator; this
// only needs to know which word belongs to which key.
const t = (key) => key;

// ---------------------------------------------------------------------------
// The nine chapters
// ---------------------------------------------------------------------------

check('there are nine chapters', () => {
  assert.equal(CHAPTERS.length, 9, 'there are not nine chapters');
});

check('every chapter has its own key', () => {
  const keys = CHAPTERS.map((c) => c.key);
  assert.equal(new Set(keys).size, 9, 'two chapters share a key');
});

check('every chapter has an icon and a label', () => {
  for (const chapter of CHAPTERS) {
    assert.ok(chapter.icon, `${chapter.key} has no icon`);
    assert.ok(chapter.labelKey, `${chapter.key} has no label`);
  }
});

check('the card opens on this month', () => {
  assert.equal(DEFAULT_CHAPTER, 'month');
  assert.ok(
    CHAPTERS.some((c) => c.key === DEFAULT_CHAPTER),
    'the first chapter is not one of the nine'
  );
});

check('the nine chapters are the nine parts of the money', () => {
  const keys = CHAPTERS.map((c) => c.key);
  for (const key of [
    'month', 'accounts', 'portfolio', 'net_worth', 'credit',
    'debts', 'receivables', 'income', 'business',
  ]) {
    assert.ok(keys.includes(key), `the chapter ${key} is missing`);
  }
});

// ---------------------------------------------------------------------------
// The big number
// ---------------------------------------------------------------------------

check('the first chapter is the money left over this month', () => {
  const headline = chapterHeadline('month', {
    month: { income: 5000000, expense: 2000000, free_cash: 3000000 },
  });
  assert.equal(headline.value, 3000000);
  assert.equal(headline.hasData, true);
});

check('the accounts chapter is the cash', () => {
  const headline = chapterHeadline('accounts', {
    accounts: { total: 3375000, count: 3 },
  });
  assert.equal(headline.value, 3375000);
  assert.equal(headline.hasData, true);
});

check('the credit chapter is what is left of the limit', () => {
  // Not what has been used - what is left, because that is how much
  // the reader can still spend.
  const headline = chapterHeadline('credit', {
    credit: { used: 450000, limit: 5000000, remaining: 4550000 },
  });
  assert.equal(headline.value, 4550000);
  assert.equal(headline.hasData, true);
});

check('the debts chapter is what is still owed', () => {
  const headline = chapterHeadline('debts', {
    debts: { principal: 12000000, count: 1 },
  });
  assert.equal(headline.value, 12000000);
});

check('a chapter with nothing in it says so', () => {
  // Not a confident zero. A reader who sees "Rp 0" under "Rekening"
  // is told they have no accounts, which is a claim. The chapter
  // says there is no data, which is true.
  const headline = chapterHeadline('accounts', { accounts: { total: 0, count: 0 } });
  assert.equal(headline.hasData, false);
  assert.equal(headline.value, 0);
});

check('a chapter that is not there at all does not crash', () => {
  const headline = chapterHeadline('month', {});
  assert.equal(headline.hasData, false);
  assert.equal(headline.value, 0);

  const missing = chapterHeadline('month', undefined);
  assert.equal(missing.hasData, false);
});

// ---------------------------------------------------------------------------
// The detail
// ---------------------------------------------------------------------------

check('the month chapter says what came in and what is owed', () => {
  const lines = chapterDetails('month', {
    month: {
      income: 5000000,
      expense: 2000000,
      free_cash: 3000000,
      committed: 1200000,
    },
  }, t);

  const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
  assert.ok(byKey.income, 'the income is not shown');
  assert.equal(byKey.income.value, 5000000);
  assert.ok(byKey.committed, 'the committed money is not shown');
  assert.equal(byKey.committed.value, 1200000);
});

check('a line that is zero is left out', () => {
  // A card full of zeros is a card that says nothing.
  const lines = chapterDetails('receivables', {
    receivables: { total: 100000, split: 0, loans: 100000 },
  }, t);

  assert.equal(lines.length, 1, lines);
  assert.equal(lines[0].value, 100000);
});

check('the debt chapter shows the share of the month', () => {
  const lines = chapterDetails('debts', {
    debts: { principal: 12000000, monthly: 900000, dsr: 0.1125 },
  }, t);

  const dsr = lines.find((l) => l.kind === 'percent');
  assert.ok(dsr, 'the share of the month is not shown');
  assert.equal(dsr.value, 11.25);
});

check('a debt chapter with no income has no share', () => {
  // There is no share of nothing.
  const lines = chapterDetails('debts', {
    debts: { principal: 12000000, monthly: 900000, dsr: null },
  }, t);

  assert.ok(
    !lines.some((l) => l.kind === 'percent'),
    'a share was invented'
  );
});

// ---------------------------------------------------------------------------
// The thirty-day line
// ---------------------------------------------------------------------------

check('the line holds the points that are coming', () => {
  const today = new Date();
  const soon = new Date(today.getTime() + 5 * 86400000);
  const later = new Date(today.getTime() + 20 * 86400000);

  const points = timelinePoints(
    [
      { date: soon.toISOString(), kind: 'installment', label: 'Kredit', amount: 900000 },
      { date: later.toISOString(), kind: 'goal', label: 'Dana Darurat', amount: 8000000 },
    ],
    today
  );

  assert.equal(points.length, 2, points);
  // The line runs forward.
  assert.ok(points[0].days < points[1].days, points);
  assert.equal(points[0].days, 5);
  assert.equal(points[1].days, 20);
});

check('a point that is further than thirty days is not on the line', () => {
  const today = new Date();
  const far = new Date(today.getTime() + 60 * 86400000);

  const points = timelinePoints(
    [{ date: far.toISOString(), kind: 'bill', label: 'Tagihan', amount: 100 }],
    today
  );

  assert.equal(points.length, 0, points);
});

check('a point further back than the week behind is not on the line', () => {
  const today = new Date();
  const past = new Date(today.getTime() - 12 * 86400000);

  const points = timelinePoints(
    [{ date: past.toISOString(), kind: 'bill', label: 'Tagihan', amount: 100 }],
    today
  );

  assert.equal(points.length, 0, JSON.stringify(points));
});

check('a day in the week behind is on the line, to the left of today', () => {
  // A reader who has only just begun has nothing ahead; the week
  // behind is the part of the line that is always real.
  const today = new Date();
  const past = new Date(today.getTime() - 3 * 86400000);

  const points = timelinePoints(
    [{ date: past.toISOString(), kind: 'spent', label: 'Keluar', amount: 12000 }],
    today
  );

  assert.equal(points.length, 1, JSON.stringify(points));
  assert.equal(points[0].days, -3);
  assert.ok(points[0].position < timelineTodayPosition(), 'behind today');
  assert.ok(points[0].position >= 0, 'still on the line');
});

check('today sits where the week behind ends', () => {
  const todayAt = timelineTodayPosition();
  assert.ok(todayAt > 0 && todayAt < 0.5, String(todayAt));
  const points = timelinePoints(
    [{ date: new Date().toISOString(), kind: 'earned', label: 'Masuk', amount: 1 }],
    new Date()
  );
  assert.equal(points[0].days, 0);
  assert.ok(Math.abs(points[0].position - todayAt) < 1e-9);
});

check('an empty line is an empty line', () => {
  assert.deepEqual(timelinePoints([], new Date()), []);
  assert.deepEqual(timelinePoints(undefined, new Date()), []);
});

// ---------------------------------------------------------------------------
// The way into the application
// ---------------------------------------------------------------------------

check('every chapter that has a page offers it', () => {
  assert.equal(chapterLink('accounts'), '/accounts');
  assert.equal(chapterLink('portfolio'), '/market');
  assert.equal(chapterLink('debts'), '/debts');
  assert.equal(chapterLink('receivables'), '/split');
  assert.equal(chapterLink('business'), '/merchant');
});

check('a chapter with no page of its own does not offer one', () => {
  assert.equal(chapterLink('month'), null);
  assert.equal(chapterLink('income'), null);
});

// ---------------------------------------------------------------------------
// The numbers
// ---------------------------------------------------------------------------

check('a number is a number, whatever the server sends', () => {
  assert.equal(number(100), 100);
  assert.equal(number('100'), 100);
  assert.equal(number(null), 0);
  assert.equal(number(undefined), 0);
  assert.equal(number(''), 0);
  assert.equal(number('not a number'), 0);
  assert.equal(number(Number.NaN), 0);
});
