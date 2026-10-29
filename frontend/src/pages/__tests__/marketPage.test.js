/**
 * The market page source.
 *
 * Run with: node src/pages/__tests__/marketPage.test.js
 *
 * These are checks on the page's own source, because the bugs they
 * guard against are in the expressions the page writes out. Reading
 * the source is the only way to see them without a browser.
 *
 * Each rule below was a bug that shipped:
 *
 * - the table view opened on a tab the page cannot draw, so the
 *   first thing the reader saw was an empty table;
 * - a missing change was written as `value + '%'`, which produces
 *   the word "undefined" with a percent sign on the end;
 * - a change that is missing was given a dash and then had a percent
 *   sign put on the end of the dash;
 * - a state and a variable were left over from an older version of
 *   the page and were never read.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'MarketPage.jsx'), 'utf8');

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

check(
  'the table tab state starts on a tab the page can draw',
  /useState\('all'\)/.test(source),
  false
);

// ---------------------------------------------------------------------------
// A change that is missing
// ---------------------------------------------------------------------------

check(
  'no change is written as a number with a percent sign put on the end',
  /change_percent\?\.toFixed\(2\)\s*\+\s*'%'\s*\|\|\s*'-'/.test(source),
  false
);

check(
  'no change is written as a dash with a percent sign put on the end',
  /\(\s*[\w?.]*change[\w?.]*\?\.toFixed\(2\)\s*\|\|\s*'-'\s*\)\s*\+\s*'%'/.test(source),
  false
);

check(
  'no change is written as a number with a percent sign and no fallback',
  /change[^\n]*\?\.toFixed\(2\)\s*\+\s*'%'/.test(source),
  false
);

// ---------------------------------------------------------------------------
// State and variables that are never read
// ---------------------------------------------------------------------------

check(
  'the market page has no leftover market tab state',
  /activeMarketTab/.test(source),
  false
);

check(
  'the market page has no leftover border hover variable',
  /borderHover/.test(source),
  false
);

// ---------------------------------------------------------------------------
// The helper the page uses
// ---------------------------------------------------------------------------

check(
  'the page uses the shared market formatter',
  /from '\.\.\/utils\/marketFormat'/.test(source),
  true
);

check(
  'the page filters quotes through the shared filter',
  /filterQuotes\(/.test(source),
  true
);

// ---------------------------------------------------------------------------

console.log(`marketPage: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
