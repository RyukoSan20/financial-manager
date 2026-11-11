/**
 * The dashboard profile card reads the profile, not the calendar.
 *
 * The dashboard fetches ten things at once, names them, and reads
 * each by its place in the list. The profile and the spending
 * calendar were in the wrong order: the profile card was handed the
 * calendar, saw no chapters, and said "Belum ada data" to a reader
 * with a month of transactions.
 *
 * This holds the order: the name `profileData` and the call
 * `financialProfile(...)` are at the same index, and the calendar is
 * after it.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DASH = readFileSync(join(HERE, '..', 'Dashboard.jsx'), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failed += 1; console.error(`not ok - ${name}`); console.error(`  ${err.message}`); }
};

// The two lists: the names being destructured, and the promises.
const namesBlock = DASH.slice(DASH.indexOf('const [\n'), DASH.indexOf('] = await Promise.allSettled'));
const promisesBlock = DASH.slice(
  DASH.indexOf('await Promise.allSettled(['),
  DASH.indexOf(']);', DASH.indexOf('await Promise.allSettled(['))
);

check('the profile name and the profile call are at the same place', () => {
  const names = namesBlock
    .split('\n')
    .map((l) => l.trim().replace(/,$/, ''))
    .filter((l) => l && !l.startsWith('const'));
  const profileIndex = names.indexOf('profileData');
  const calendarIndex = names.indexOf('dailySpendingData');
  assert.ok(profileIndex >= 0, 'profileData is one of the names');
  assert.ok(calendarIndex >= 0, 'dailySpendingData is one of the names');

  // The promises, in order, as the call each line makes.
  const promiseLines = promisesBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('api.'));

  assert.ok(
    promiseLines[profileIndex].includes('financialProfile'),
    `the promise at the profile's place is the profile, not: ${promiseLines[profileIndex]}`
  );
  assert.ok(
    promiseLines[calendarIndex].includes('spending/daily'),
    `the promise at the calendar's place is the calendar, not: ${promiseLines[calendarIndex]}`
  );
});

check('the profile still fills the profile state', () => {
  assert.ok(
    DASH.includes("if (profileData.status === 'fulfilled' && profileData.value) setFinancialProfile(profileData.value)"),
    'profileData feeds the financial profile'
  );
});

console.log('');
console.log(`the dashboard wiring: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
