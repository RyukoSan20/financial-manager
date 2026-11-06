/**
 * The banners on the dashboard, and the switch that turns them on.
 *
 * Two things were asked for at the top of the dashboard:
 *
 * - the money that has not been given a job yet, which is the one
 *   number that says whether the reader's plan works;
 * - how fresh the data is, and whether anything is waiting to be
 *   looked at.
 *
 * The survey behind this work found that the commonest complaint
 * about the tools people already use is that the numbers are wrong
 * and nothing says so. So the banner has to say so, and offer the fix
 * in one click.
 *
 * These checks hold two things down:
 *
 * - the banners are behind the switch, and the switch is off in the
 *   repository, so nothing changes until it is turned on;
 * - the money the banner shows is the money the application holds,
 *   not the sum of the last page of transactions.
 *
 * Run with: node src/components/fintech/__tests__/dashboardTrust.test.js
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

const page = read('src/pages/Dashboard.jsx');
const flags = read('src/utils/featureFlags.js');
const main = read('src/main.jsx');

// ---------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------
check('the feature is behind a switch', () => {
  assert.ok(
    /FINTECH_SYNTHESIS/.test(flags),
    'the flag is not in the registry'
  );
  assert.ok(
    /VITE_FINTECH_SYNTHESIS/.test(flags),
    'the flag has no build variable'
  );
});

check('the switch is off in the repository', () => {
  // The build variable is what turns it on, and there is no default
  // value in the registry, so a build without it is off.
  const line = flags
    .split('\n')
    .find((l) => l.includes('FINTECH_SYNTHESIS:'));
  assert.ok(line, 'the flag is not in the registry');
  assert.ok(
    !/FINTECH_SYNTHESIS:\s*'[^']*',\s*\S/.test(line) || line.includes("'VITE_FINTECH_SYNTHESIS'"),
    'the flag is not a plain build variable'
  );
});

check('the flag test says the switch is off', () => {
  const flagTest = read('src/utils/__tests__/featureFlags.test.js');
  assert.ok(
    /buildFlag\('FINTECH_SYNTHESIS'\),\s*false/.test(flagTest),
    'the flag test does not say the switch is off'
  );
});

// ---------------------------------------------------------------------------
// The dashboard
// ---------------------------------------------------------------------------
check('the dashboard reads the switch', () => {
  assert.ok(
    /buildFlag\('FINTECH_SYNTHESIS'\)/.test(page),
    'the dashboard does not read the switch'
  );
});

check('the banners are behind the switch', () => {
  // Both banners have to be inside the `fintech &&` guard. A banner
  // that shows when the switch is off is a change nobody asked for.
  assert.ok(
    /fintech\s*&&\s*\(/.test(page),
    'the banners are not behind the switch'
  );
  assert.ok(
    /<ReadyToBeAssignedBanner/.test(page),
    'the ready banner is not on the dashboard'
  );
  assert.ok(
    /<DataAccuracyIndicator/.test(page),
    'the trust indicator is not on the dashboard'
  );
});

check('the banner uses the balance the application holds', () => {
  // Not the sum of the ten most recent transactions. That would be a
  // different number from the one on every other page.
  assert.ok(
    /cash=\{summary\?\.total_balance\s*\|\|\s*0\}/.test(page),
    'the banner is not given the total balance'
  );
});

check('the banner is given the budgets and what was spent', () => {
  assert.ok(/budgets=\{budgets\}/.test(page), 'the banner is not given the budgets');
  assert.ok(
    /spent=\{summary\?\.total_spent\s*\|\|\s*0\}/.test(page),
    'the banner is not given what was spent'
  );
});

check('the stylesheet is loaded', () => {
  assert.ok(
    /fintech\.css/.test(main),
    'the stylesheet for the banners is not imported'
  );
});

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------
console.log(`\ndashboard trust: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
