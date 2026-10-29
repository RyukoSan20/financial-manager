/**
 * The numbers the market page shows.
 *
 * Run with: node src/utils/__tests__/marketFormat.test.js
 *
 * The cases here are the ones where the page used to lie to the
 * reader: a missing change that read as "undefined%", a missing
 * change that read as "-%", and a table view that opened on a tab
 * the page cannot draw.
 */

import {
  TABLE_TABS,
  DEFAULT_TABLE_TAB,
  formatChangePercent,
  formatPriceValue,
  isChangeUp,
  filterQuotes,
} from '../marketFormat.js';

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

// ---------------------------------------------------------------------------
// The tab the table view opens on
// ---------------------------------------------------------------------------

check('the table opens on a tab the page can draw', TABLE_TABS.includes(DEFAULT_TABLE_TAB), true);
check('the default tab is the first tab', DEFAULT_TABLE_TAB, 'forex');
check('there is no "all" tab', TABLE_TABS.includes('all'), false);

// ---------------------------------------------------------------------------
// A change that moved
// ---------------------------------------------------------------------------

check('a change up carries a plus sign', formatChangePercent(1.234), '+1.23%');
check('a change down keeps its minus', formatChangePercent(-1.234), '-1.23%');
check('a change of zero still carries a plus', formatChangePercent(0), '+0.00%');
check('a change of zero written as a string', formatChangePercent('0'), '+0.00%');

// ---------------------------------------------------------------------------
// A change that is missing
//
// The old code wrote `value?.toFixed(2) + '%' || '-'`. A missing
// value produced the word "undefined" with a percent sign on the end,
// because a non-empty string is always true. The other old spelling,
// `(value?.toFixed(2) || '-') + '%'`, produced a dash with a percent
// sign on the end. Neither says "there is no number here".
// ---------------------------------------------------------------------------

check('a missing change reads as a dash', formatChangePercent(undefined), '-');
check('a null change reads as a dash', formatChangePercent(null), '-');
check('an empty change reads as a dash', formatChangePercent(''), '-');
check('a change that is not a number reads as a dash', formatChangePercent('abc'), '-');
check('a missing change never says undefined', formatChangePercent(undefined).includes('undefined'), false);
check('a missing change never carries a percent sign', formatChangePercent(undefined).includes('%'), false);

// ---------------------------------------------------------------------------
// A price that is missing
// ---------------------------------------------------------------------------

check('a price is written with its sign', formatPriceValue(1234.5, { decimals: 2, prefix: '$' }), '$1,234.50');
check('a price with no decimals', formatPriceValue(1234.5, { decimals: 0, prefix: 'Rp ' }), 'Rp 1,235');
check('a missing price reads as a dash', formatPriceValue(undefined), '-');
check('a price that is not a number reads as a dash', formatPriceValue('abc'), '-');
check('a missing price never says NaN', formatPriceValue(undefined).includes('NaN'), false);

// ---------------------------------------------------------------------------
// Whether a change moved up
// ---------------------------------------------------------------------------

check('a change up is up', isChangeUp(0.5), true);
check('a change of zero is up', isChangeUp(0), true);
check('a change down is not up', isChangeUp(-0.5), false);
check('a missing change is not up', isChangeUp(undefined), false);
check('a change that is not a number is not up', isChangeUp('abc'), false);

// ---------------------------------------------------------------------------
// Searching for a quote
// ---------------------------------------------------------------------------

const quotes = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'BBCA', name: 'Bank Central Asia' },
  { pair: 'USD/IDR', price: 16000 },
];

check('an empty search keeps everything', filterQuotes(quotes, '').length, 3);
check('a search that is only spaces keeps everything', filterQuotes(quotes, '   ').length, 3);
check('a search on the symbol', filterQuotes(quotes, 'aapl').length, 1);
check('a search on the name', filterQuotes(quotes, 'bank central').length, 1);
check('a search on the pair', filterQuotes(quotes, 'usd/idr').length, 1);
check('a search on the middle of a name', filterQuotes(quotes, 'appl').length, 1);
check('a search that matches nothing', filterQuotes(quotes, 'zzzz').length, 0);
check('a missing list is an empty list', filterQuotes(undefined, 'aapl').length, 0);
check('a list that is not a list is an empty list', filterQuotes('nope', 'aapl').length, 0);

// ---------------------------------------------------------------------------

console.log(`marketFormat: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
