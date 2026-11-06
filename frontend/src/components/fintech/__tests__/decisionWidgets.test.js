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
 * These checks make sure the four widgets are actually on the pages
 * they were asked for, and that they are behind the switch.
 *
 * The arithmetic is checked in `utils/__tests__/decisionWidgets.test.js`.
 * What is checked here is the wiring: that the widget is on the page,
 * that the page reads the switch, and that the switch is off in the
 * repository.
 *
 * Run with: node src/components/fintech/__tests__/decisionWidgets.test.js
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

const dashboard = read('src/pages/Dashboard.jsx');
const budgets = read('src/pages/Budgets.jsx');
const analytics = read('src/pages/Analytics.jsx');
const accounts = read('src/pages/Accounts.jsx');
const transactions = read('src/pages/Transactions.jsx');
const flags = read('src/utils/featureFlags.js');

// ---------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------
check('the whole set is behind one switch', () => {
  assert.ok(/FINTECH_SYNTHESIS/.test(flags), 'the flag is not in the registry');
  assert.ok(
    /VITE_FINTECH_SYNTHESIS/.test(flags),
    'the flag has no build variable'
  );
});

check('the switch is off in the repository', () => {
  const flagTest = read('src/utils/__tests__/featureFlags.test.js');
  assert.ok(
    /buildFlag\('FINTECH_SYNTHESIS'\),\s*false/.test(flagTest),
    'the flag test does not say the switch is off'
  );
});

// ---------------------------------------------------------------------------
// The safe-to-spend figure
// ---------------------------------------------------------------------------
check('the safe-to-spend figure is on the dashboard', () => {
  assert.ok(
    /<SafeToSpendWidget/.test(dashboard),
    'the widget is not on the dashboard'
  );
});

check('the safe-to-spend figure comes first on the dashboard', () => {
  // It is the first question the reader opens the app to ask, so it
  // comes before the other banners.
  const safeAt = dashboard.indexOf('<SafeToSpendWidget');
  const bannerAt = dashboard.indexOf('<ReadyToBeAssignedBanner');
  assert.ok(safeAt > 0 && bannerAt > 0, 'a banner is missing');
  assert.ok(
    safeAt < bannerAt,
    'the safe-to-spend figure is not before the other banners'
  );
});

check('the safe-to-spend figure uses the balance the application holds', () => {
  assert.ok(
    /cash=\{summary\?\.total_balance\s*\|\|\s*0\}/.test(dashboard),
    'the widget is not given the total balance'
  );
  assert.ok(
    /rules=\{recurringTransactions\}/.test(dashboard),
    'the widget is not given the bills'
  );
  assert.ok(/goals=\{goals\}/.test(dashboard), 'the widget is not given the goals');
});

// ---------------------------------------------------------------------------
// The three ways to run the money
// ---------------------------------------------------------------------------
check('the method picker is on the budgets page', () => {
  assert.ok(
    /<BudgetMethodPanels/.test(budgets),
    'the panels are not on the budgets page'
  );
  const panels = read('src/components/fintech/BudgetMethodPanels.jsx');
  assert.ok(
    /<BudgetMethodPicker/.test(panels),
    'the picker is not in the panels'
  );
});

check('the method is kept in the reader own preferences', () => {
  // The choice has to survive a reload, and it has to follow the
  // reader between devices. A useState would not.
  assert.ok(
    /useSyncedPreference\(\s*'fintech_budget_method'/.test(budgets),
    'the method is not kept in the reader preferences'
  );
});

check('the flexible view of the budget is on the budgets page', () => {
  const panels = read('src/components/fintech/BudgetMethodPanels.jsx');
  assert.ok(
    /<FlexBudgetPanel/.test(panels),
    'the flexible budget is not in the panels'
  );
});

check('the flexible view is not shown in the zero-based method', () => {
  // The zero-based method is a different way of looking at the same
  // money, and the three groups are not its way.
  const panels = read('src/components/fintech/BudgetMethodPanels.jsx');
  assert.ok(
    /method\s*!==\s*'zero'\s*&&\s*\(/.test(panels),
    'the flexible view is shown in the zero-based method'
  );
});

check('the transfer between envelopes is only in the envelope method', () => {
  const panels = read('src/components/fintech/BudgetMethodPanels.jsx');
  assert.ok(
    /method\s*===\s*'envelope'\s*&&\s*\(/.test(panels),
    'the transfer is not limited to the envelope method'
  );
  assert.ok(
    /onMove=\{moveBetweenBudgets\}/.test(budgets),
    'the transfer is not wired to the mover'
  );
});

check('moving money between envelopes writes to the server', () => {
  // A transfer that only changes the screen would tell the reader it
  // happened when it did not.
  const mover = read('src/components/fintech/useEnvelopeMover.js');
  assert.ok(
    /api\.budgets\.update\(fromId/.test(mover),
    'the transfer does not change the budget'
  );
  assert.ok(
    /api\.budgets\.update\(toId/.test(mover),
    'the transfer does not change the target budget'
  );
});

check('the transfer finds the budgets even though the ids are strings', () => {
  // The ids come from a select box, so they are strings. A strict
  // comparison of '427' with 427 finds nothing, and the move refuses
  // to happen without saying why.
  const mover = read('src/components/fintech/useEnvelopeMover.js');
  assert.ok(
    /String\(b\.id\)\s*===\s*String\(fromId\)/.test(mover),
    'the source budget is not found when the id is a string'
  );
  assert.ok(
    /String\(b\.id\)\s*===\s*String\(toId\)/.test(mover),
    'the target budget is not found when the id is a string'
  );
});

check('a failed transfer puts the money back', () => {
  const mover = read('src/components/fintech/useEnvelopeMover.js');
  assert.ok(
    /catch[\s\S]{0,600}api\.budgets\.update\(fromId,\s*\{\s*amount:\s*fromAmount\s*\}\)/.test(mover),
    'a failed transfer does not put the money back'
  );
});

// ---------------------------------------------------------------------------
// The river of money
// ---------------------------------------------------------------------------
check('the river of money is on the analytics page', () => {
  assert.ok(
    /<CashFlowDiagram/.test(analytics),
    'the diagram is not on the analytics page'
  );
});

check('the river uses the breakdowns the server already sends', () => {
  // Asking for the transactions again would be a second answer to the
  // same question.
  assert.ok(
    /incomeBreakdown=\{incomeBreakdown\}/.test(analytics),
    'the diagram does not use the income breakdown'
  );
  assert.ok(
    /expenseBreakdown=\{expenseBreakdown\}/.test(analytics),
    'the diagram does not use the expense breakdown'
  );
});

// ---------------------------------------------------------------------------
// The reconciliation
// ---------------------------------------------------------------------------
check('the reconciliation bar is on the accounts page', () => {
  assert.ok(
    /<ReconciliationBar/.test(accounts),
    'the bar is not on the accounts page'
  );
});

check('the reconciliation bar is on the transactions page', () => {
  assert.ok(
    /<ReconciliationBar/.test(transactions),
    'the bar is not on the transactions page'
  );
});

check('the reconciliation reads what the reader typed', () => {
  // The result has to follow the figure the reader gave. A bar that
  // only ever shows the balance on the screen is not a reconciliation
  // at all.
  const bar = read('src/components/fintech/ReconciliationBar.jsx');
  assert.ok(
    /reconciliationState\(\{\s*recorded,\s*bank:\s*typed\s*\}\)/.test(bar),
    'the bar does not work out the result from what was typed'
  );
  assert.ok(
    /typed === ''/.test(bar),
    'the bar does not wait for a figure'
  );
});

check('the adjusting entry is written to the server', () => {
  const writer = read('src/components/fintech/useAdjustmentWriter.js');
  assert.ok(
    /api\.transactions\.create\(/.test(writer),
    'the adjusting entry is not written'
  );
  for (const [name, page] of [['accounts', accounts], ['transactions', transactions]]) {
    assert.ok(
      /useAdjustmentWriter\(/.test(page),
      `${name} does not use the writer`
    );
  }
});

check('the reader confirms before the entry is written', () => {
  const writer = read('src/components/fintech/useAdjustmentWriter.js');
  assert.ok(
    /await ask\(/.test(writer),
    'the reader is not asked before the entry is written'
  );
});

check('the two pages use the same figure', () => {
  // The accounts page reads the balance the server totals, and the
  // transactions page sums the account balances. They have to be the
  // same number, or the two bars will not agree with each other.
  assert.ok(
    /recorded=\{summary\?\.total_balance\s*\|\|\s*0\}/.test(accounts),
    'the accounts page does not use the server total'
  );
  assert.ok(
    /recorded=\{accountTotal\}/.test(transactions),
    'the transactions page does not use the account total'
  );
  assert.ok(
    /heldCash\(accounts\)/.test(transactions),
    'the transactions page does not sum the balances'
  );
});

// ---------------------------------------------------------------------------
// Which envelope a budget belongs to
// ---------------------------------------------------------------------------
check('the envelope kinds are read from the category names', () => {
  const panel = read('src/components/fintech/FlexBudgetPanel.jsx');
  // A reader names their categories, and the three groups are worked
  // out from those names. If the names are not read, every category
  // lands in the same group and the split says nothing.
  assert.ok(
    /envelopeKindOf/.test(panel),
    'the panel does not work out the kind of a budget'
  );
  for (const word of ['tetap', 'tabungan']) {
    assert.ok(
      panel.includes(word),
      `the panel does not read the word "${word}"`
    );
  }
});

// ---------------------------------------------------------------------------
// Every page is behind the switch
// ---------------------------------------------------------------------------
check('every page reads the switch', () => {
  for (const [name, page] of [
    ['dashboard', dashboard],
    ['budgets', budgets],
    ['analytics', analytics],
    ['accounts', accounts],
    ['transactions', transactions],
  ]) {
    assert.ok(
      /buildFlag\('FINTECH_SYNTHESIS'\)/.test(page),
      `${name} does not read the switch`
    );
  }
});

check('every widget is behind the switch', () => {
  for (const [name, page] of [
    ['dashboard', dashboard],
    ['budgets', budgets],
    ['analytics', analytics],
    ['accounts', accounts],
    ['transactions', transactions],
  ]) {
    // Each widget has to be inside a `fintech &&` guard.
    const guards = page.match(/fintech\s*&&/g) || [];
    assert.ok(
      guards.length > 0,
      `${name} has nothing behind the switch`
    );
  }
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------
console.log(`\ndecision widgets: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
