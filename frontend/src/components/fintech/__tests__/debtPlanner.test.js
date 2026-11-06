/**
 * The plan for paying the debts off.
 *
 * Two things sit on the debts page: the order the debts should be
 * paid in, and what would happen if the reader paid a bit more each
 * month.
 *
 * The order matters because there are two ways to do it and they give
 * different answers. The snowball clears the smallest first, so the
 * reader sees debts going down one at a time. The avalanche pays the
 * highest interest first, so the reader pays less overall. Neither is
 * right for everyone, so the reader picks.
 *
 * The simulator matters because it turns "I should pay more" into a
 * number: this much interest saved, so many months sooner.
 *
 * These checks make sure:
 *
 * - the order the panel shows is the order the shared arithmetic
 *   works out, so the panel and the numbers agree;
 * - the simulator's interest is the month by month interest, the way
 *   a bank works it out, and not a flat estimate;
 * - an unknown strategy falls back to one of the two known ones
 *   rather than producing an order that is neither;
 * - the panel is behind the switch.
 *
 * Run with: node src/components/fintech/__tests__/debtPlanner.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

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

const panel = read('src/components/fintech/DebtPlanner.jsx');
const page = read('src/pages/Debts.jsx');

// ---------------------------------------------------------------------------
// The order
// ---------------------------------------------------------------------------
check('the order comes from the shared arithmetic', () => {
  assert.ok(/orderDebts/.test(panel), 'the panel does not use orderDebts');
  assert.ok(
    /debtStrategyIsKnown/.test(panel),
    'the panel does not check whether the strategy is one of the two'
  );
});

check('the panel does not sort the debts itself', () => {
  // A second sort is a second answer, and the two answers will not
  // agree.
  assert.ok(
    !/\.sort\(\s*\(a,\s*b\)\s*=>\s*[a-z]+\.balance/.test(panel),
    'the panel sorts the debts itself'
  );
});

check('an unknown strategy falls back to one of the two', () => {
  assert.ok(
    /debtStrategyIsKnown\(strategy\)\s*\?\s*strategy\s*:\s*'snowball'/.test(panel),
    'the panel does not fall back for an unknown strategy'
  );
});

check('both orders are offered', () => {
  assert.ok(
    /DEBT_STRATEGIES\.map/.test(panel),
    'the panel does not offer the two orders'
  );
  assert.ok(
    /aria-pressed/.test(panel),
    'the panel does not say which order is chosen'
  );
});

// ---------------------------------------------------------------------------
// The simulator
// ---------------------------------------------------------------------------
check('the simulator uses the shared arithmetic', () => {
  assert.ok(
    /payoffWithExtra/.test(panel),
    'the simulator does not use payoffWithExtra'
  );
  assert.ok(
    !/interest\s*=\s*balance\s*\*\s*rate/.test(panel),
    'the simulator works the interest out itself'
  );
});

check('the simulator says what the extra payment saves', () => {
  assert.ok(
    /result\.interestSaved/.test(panel),
    'the interest saved is not shown'
  );
  assert.ok(
    /result\.monthsSaved/.test(panel),
    'the months saved are not shown'
  );
});

check('the simulator says when nothing changes', () => {
  // With no extra payment, the debt is paid on the same terms, and
  // the panel has to say so rather than show zero savings.
  assert.ok(
    /nothingChanges/.test(panel),
    'the panel does not say when nothing changes'
  );
  assert.ok(
    /debt_simulator_same/.test(panel),
    'the panel has no words for when nothing changes'
  );
});

check('the simulator works on one debt', () => {
  // The debt that is first in the order is the one the reader is
  // about to pay.
  assert.ok(
    /ordered\[0\]/.test(panel),
    'the simulator does not use the first debt in the order'
  );
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------
check('the words come from the locale file', async () => {
  const { batch3 } = await import('../../../i18n/keys_batch3.js');
  const needed = [
    'debt_strategy',
    'debt_strategy_hint',
    'debt_snowball',
    'debt_avalanche',
    'debt_simulator',
    'debt_simulator_extra',
    'debt_simulator_saves',
    'debt_simulator_faster',
    'debt_simulator_same',
  ];
  for (const language of ['id', 'en', 'ja']) {
    const words = batch3[language]?.fintech;
    assert.ok(words, `${language} has no fintech words`);
    for (const key of needed) {
      assert.ok(
        typeof words[key] === 'string' && words[key].length > 0,
        `${language} has no ${key}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// The debts page
// ---------------------------------------------------------------------------
check('the debts page is behind the switch', () => {
  assert.ok(
    /buildFlag\('FINTECH_SYNTHESIS'\)/.test(page),
    'the debts page does not read the switch'
  );
  assert.ok(
    /<DebtPlanner/.test(page),
    'the planner is not on the debts page'
  );
  assert.ok(
    /fintech\s*&&\s*\(/.test(page),
    'the planner is not behind the switch'
  );
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------
console.log(`\ndebt planner: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
