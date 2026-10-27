/**
 * The grouped sidebar, and the pages behind the advanced features.
 *
 * Run with: node src/components/layout/__tests__/navGrouping.test.js
 *
 * The grouped sidebar is a second copy of the menu, and a second copy
 * drifts. These checks are the ones that would catch the drift:
 *
 * - every item the groups name has to exist in the map that holds
 *   them, or that link silently disappears from the menu;
 * - every item the map holds has to be in some group, or it is
 *   unreachable;
 * - the pages that need the advanced features are the pages the
 *   route table actually protects.
 */

import { NAV_GROUPS, ADVANCED_PAGES, isAdvancedPage, buildNavMap } from '../navGroups.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// The translation function stands in for the real one: the keys are
// what matters here, not the words behind them.
const t = (key) => key;

// ---------------------------------------------------------------------------
// The groups and the map
// ---------------------------------------------------------------------------

const navMap = buildNavMap(t);

// Every key the groups name must be a key the map holds. A key that is
// not in the map is filtered out, and the link is simply not there any
// more — which is how a menu entry goes missing without a word of
// warning.
for (const group of NAV_GROUPS) {
  for (const key of group.items) {
    check(
      `group "${group.key}" names a key the map holds: ${key}`,
      Boolean(navMap[key]),
      true
    );
  }
}

// Every key the map holds must be in a group, or the reader cannot
// reach that page from the menu.
//
// The settings link is the one exception: it sits at the bottom of
// the sidebar, below the groups, and is drawn there rather than as
// part of a group.
const UNGROUPED = ['settings'];
const groupedKeys = new Set(NAV_GROUPS.flatMap((group) => group.items));
for (const key of Object.keys(navMap)) {
  if (UNGROUPED.includes(key)) continue;
  check(
    `the map holds a key that some group names: ${key}`,
    groupedKeys.has(key),
    true
  );
}

check(
  'settings is the one page that is not in a group',
  groupedKeys.has('settings'),
  false
);

// ---------------------------------------------------------------------------
// The advanced pages
// ---------------------------------------------------------------------------

check('the merchant page needs the advanced features', isAdvancedPage('/merchant'), true);
check('the map page needs the advanced features', isAdvancedPage('/map'), true);
check('the dashboard does not need the advanced features', isAdvancedPage('/'), false);
check('the transactions page does not need the advanced features', isAdvancedPage('/transactions'), false);

// A path inside an advanced page is still an advanced page.
check('a path under the merchant page needs the advanced features', isAdvancedPage('/merchant/42'), true);

// The two lists must agree about which pages are advanced.
check(
  'the advanced pages are all in the advanced group',
  ADVANCED_PAGES.every((path) => {
    const key = Object.keys(navMap).find((k) => navMap[k].href === path);
    const group = NAV_GROUPS.find((g) => g.items.includes(key));
    return group ? group.advanced === true : false;
  }),
  true
);

// ---------------------------------------------------------------------------

console.log(`navGrouping: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
