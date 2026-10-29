/**
 * The sidebar shows a little at a time.
 *
 * Run with: node src/components/layout/__tests__/navDisclosure.test.js
 *
 * A group with four items is fine. A group with ten is not: the
 * reader scrolls past the whole menu to find the one page they
 * wanted, and everything below the fold looks like more of the same.
 *
 * So a long group shows the first few and keeps the rest behind one
 * line that says there are more.
 *
 * The rule that matters most: **the page the reader is on is always
 * visible.** A reader who is on the analytics page and cannot see
 * the analytics link has to hunt for it, and they will think the page
 * they are on is not in the menu at all.
 */

import {
  ITEMS_BEFORE_THE_REST,
  splitGroupItems,
  moreLabel,
  groupOfPage,
} from '../navDisclosure.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

const items = (hrefs) => hrefs.map((href) => ({ href, name: href }));

// ---------------------------------------------------------------------------
// A short group is left alone
// ---------------------------------------------------------------------------

{
  const result = splitGroupItems(items(['/a', '/b', '/c']));
  check('a short group shows everything', result.shown.length, 3);
  check('a short group hides nothing', result.hidden.length, 0);
  check('a short group has no more line', result.hasMore, false);
}

{
  const result = splitGroupItems(items(['/a', '/b']));
  check('a very short group shows everything', result.shown.length, 2);
  check('a very short group hides nothing', result.hidden.length, 0);
}

// ---------------------------------------------------------------------------
// A long group
// ---------------------------------------------------------------------------

{
  const result = splitGroupItems(items(['/a', '/b', '/c', '/d', '/e']));
  check('a long group shows the first few', result.shown.length, ITEMS_BEFORE_THE_REST);
  check('a long group hides the rest', result.hidden.length, 2);
  check('a long group has a more line', result.hasMore, true);
  check('the more line says how many', result.moreCount, 2);
  check('the first shown is the first item', result.shown[0].href, '/a');
  check('the first hidden is the fourth item', result.hidden[0].href, '/d');
}

// ---------------------------------------------------------------------------
// The page the reader is on is always visible
// ---------------------------------------------------------------------------

{
  // The reader is on the fifth item. It has to be shown.
  const result = splitGroupItems(items(['/a', '/b', '/c', '/d', '/e']), {
    activeHref: '/e',
  });
  const shownHrefs = result.shown.map((i) => i.href);
  check('the page the reader is on is shown', shownHrefs.includes('/e'), true);
  check('the shown list is still the right length', result.shown.length, ITEMS_BEFORE_THE_REST);
}

{
  // The reader is on the fourth item, which is just past the line.
  const result = splitGroupItems(items(['/a', '/b', '/c', '/d', '/e']), {
    activeHref: '/d',
  });
  const shownHrefs = result.shown.map((i) => i.href);
  check('the page just past the line is shown', shownHrefs.includes('/d'), true);
}

{
  // The reader is on something that is not in the group.
  const result = splitGroupItems(items(['/a', '/b', '/c', '/d']), {
    activeHref: '/somewhere-else',
  });
  check('a page that is not in the group changes nothing', result.shown.length, ITEMS_BEFORE_THE_REST);
  check('and hides the same number', result.hidden.length, 1);
}

{
  // The reader is on the first item, which is already shown.
  const result = splitGroupItems(items(['/a', '/b', '/c', '/d']), {
    activeHref: '/a',
  });
  check('a page that is already shown is left alone', result.shown.length, ITEMS_BEFORE_THE_REST);
  check('and the order is unchanged', result.shown[0].href, '/a');
}

// ---------------------------------------------------------------------------
// The more line
// ---------------------------------------------------------------------------

check('the more line says how many', moreLabel(2, 'id'), '2 lainnya');
check('the more line in English', moreLabel(2, 'en'), '2 more');
check('the more line in Japanese', moreLabel(2, 'ja'), 'ほか 2 件表示');
check('no more line when there is nothing more', moreLabel(0, 'id'), '');
check('no more line for a negative number', moreLabel(-1, 'id'), '');

// ---------------------------------------------------------------------------
// Which group a page belongs to
// ---------------------------------------------------------------------------

const groups = [
  { key: 'money', items: items(['/', '/transactions', '/accounts']) },
  { key: 'plan', items: items(['/budgets', '/goals']) },
];

check('the group of an exact page', groupOfPage(groups, '/budgets'), 'plan');
check('the group of the first page', groupOfPage(groups, '/'), 'money');
check('the group of a page below one', groupOfPage(groups, '/budgets/2026'), 'plan');
check('no group for a page that is not in the menu', groupOfPage(groups, '/nowhere'), null);
check('no group for no page', groupOfPage(groups, ''), null);

// ---------------------------------------------------------------------------

console.log(`navDisclosure: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
