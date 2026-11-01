/**
 * The shared bill, and the switches that hold it back.
 *
 * A feature that is off by default has to be off in every way that a
 * reader can notice. These are the checks that the menu shows
 * nothing new, and that a bookmark to the page leads back to the
 * page the reader knows.
 *
 * Run with: node src/components/split/__tests__/splitFlags.test.js
 */

import {
  readerFlag,
  setReaderFlag,
  clearReaderFlags,
} from '../../../utils/featureFlags.js';
import {
  visibleGroups,
  flagForPage,
  NAV_GROUPS,
} from '../../layout/navGroups.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

/**
 * A check for two lists of things.
 *
 * Two lists that hold the same things in the same order are the same
 * list, even though they are two different objects. The check is
 * about what they hold, not about which object they are.
 */
function checkList(name, actual, expected) {
  const same =
    Array.isArray(actual) &&
    Array.isArray(expected) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
  check(name, same, true);
}

/**
 * A storage that holds the reader's switches.
 *
 * The switches live in the browser's own storage, and the tests run
 * outside a browser. This is the same thing, in memory: it reads and
 * writes the same way, so the switches are read and written exactly
 * as they are in the application.
 */
function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

const NAV_MAP = {
  budgets: { key: 'budgets' },
  goals: { key: 'goals' },
  recurring: { key: 'recurring' },
  debts: { key: 'debts' },
  split: { key: 'split' },
  map: { key: 'map' },
  categoryExpenses: { key: 'categoryExpenses' },
  merchant: { key: 'merchant' },
};

globalThis.window = { localStorage: makeStorage() };
clearReaderFlags();

// ---------------------------------------------------------------------------
// The shared bill is off by default
// ---------------------------------------------------------------------------

check('it is off when nobody has touched it', readerFlag('SMART_SPLIT_BILL'), false);
check('the guest claim page is off too', readerFlag('LIVE_CLAIM'), false);

const before = visibleGroups(NAV_MAP).map((group) => group.label);
check(
  'it does not show up in the menu',
  before.includes('sidebar_group_split'),
  false,
);

setReaderFlag('SMART_SPLIT_BILL', true);

const after = visibleGroups(NAV_MAP);
const splitGroup = after.find((group) => group.label === 'sidebar_group_split');
check('it shows up in the menu when it is on', Boolean(splitGroup), true);
check('and it is a group of its own', splitGroup && splitGroup.items.length, 1);
check(
  'and it holds only the shared bill',
  splitGroup && splitGroup.items[0].key,
  'split',
);
checkList(
  'and it leaves the other groups alone',
  after.filter((group) => group.label !== 'sidebar_group_split').map((g) => g.label),
  before,
);

// ---------------------------------------------------------------------------
// The switch that says which page is behind which
// ---------------------------------------------------------------------------

check(
  'the split page is behind the shared bill switch',
  flagForPage('/split'),
  'SMART_SPLIT_BILL',
);
check(
  'and so is one of its groups',
  flagForPage('/split/12'),
  'SMART_SPLIT_BILL',
);
check('the transactions page is behind nothing', flagForPage('/transactions'), null);
check('the budgets page is behind nothing', flagForPage('/budgets'), null);

let everyFlagKnown = true;
for (const group of NAV_GROUPS) {
  if (group.flag) {
    if (!['SMART_SPLIT_BILL', 'LIVE_CLAIM'].includes(group.flag)) {
      everyFlagKnown = false;
    }
  }
}
check('every group that needs a switch names a switch that exists', everyFlagKnown, true);

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

clearReaderFlags();
delete globalThis.window;

console.log('');
console.log(`splitFlags: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) {
    console.log('  FAIL ' + f);
  }
  process.exit(1);
}
