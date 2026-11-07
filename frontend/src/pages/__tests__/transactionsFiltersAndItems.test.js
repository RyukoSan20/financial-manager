/**
 * The transactions page has to be able to answer three questions that
 * a list of money is asked all the time: which way did the money go
 * (in or out), which category was it, and what exactly was bought.
 *
 * What was wrong:
 *
 * - The only way to separate money in from money out was a small icon
 *   that opened a dropdown. The three choices were hidden behind it,
 *   so the list looked like it had no filter at all. There was also no
 *   way to narrow the list by category.
 *
 * - A line in the breakdown could not say how many of the thing there
 *   were. The count was hard-coded to one, so "3 bottles of water at
 *   5000 each" had to be typed as a single line of 15000 and the
 *   reader could never see or change how many there were.
 *
 * - A transaction with no breakdown showed a header reading "Rincian
 *   Rp0", which looks like a broken number rather than an empty list.
 *
 * - The actions on a row were invisible until the pointer hovered over
 *   the row. On a touch screen there is no hover, so the actions were
 *   simply not there.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

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
    console.log(`FAIL  ${name}: ${err.message}`);
  }
};

console.log('transactions page');

const page = read('src/pages/Transactions.jsx');
const viewer = read('src/components/common/BreakdownViewer.jsx');

/* --- the filters are visible ------------------------------------------- */

// The three choices have to be on the page, not behind an icon.
check('the type choices are on the page, not behind an icon', () => {
  assert.ok(
    /typeOptions\.map/.test(page),
    'the choices are only reachable by opening a dropdown'
  );
  // And they are rendered outside the dropdown block.
  const filterBlock = page.slice(page.indexOf('{/* Filter Dropdown */}'));
  assert.ok(
    !/typeOptions\.map/.test(filterBlock.slice(0, 400)),
    'the choices are still drawn inside the dropdown'
  );
});

// A category can be chosen as well, because a list of money is
// usually asked about by category.
check('the list can be narrowed by category', () => {
  assert.ok(
    /filters\.category/.test(page),
    'there is no category filter'
  );
  assert.ok(
    /filters\.category/.test(page.slice(page.indexOf('const filteredTransactions'))),
    'the category filter is never applied to the list'
  );
});

// The reader has to be able to get back to everything.
check('the chosen filters can be cleared', () => {
  assert.ok(
    /clearFilters/.test(page),
    'there is no way back to the whole list once a filter is set'
  );
});

/* --- a line can say how many ------------------------------------------- */

// The count of a line is part of the line. Without it the reader
// cannot tell "3 x 5000" from "1 x 15000".
check('a breakdown line carries a count', () => {
  assert.ok(
    /quantity/.test(viewer),
    'a breakdown line has no count at all'
  );
  // A count that is only ever written as 1 is not a count the reader
  // can use. The line the reader edits has to have a box for it.
  assert.ok(
    /<input[\s\S]{0,400}quantity/iu.test(viewer) ||
      /quantity[\s\S]{0,400}<input/iu.test(viewer),
    'there is no box for the count of a line'
  );
});

check('the count can be changed', () => {
  assert.ok(
    /quantity/.test(viewer) && /updateLine|setLines/.test(viewer),
    'the count cannot be edited'
  );
  // The count has to be something other than one, or it is not a
  // choice at all.
  assert.ok(
    /quantity:\s*1\b/.test(viewer) === false ||
      /quantity[^\n]*\?[^\n]*:/.test(viewer),
    'the count is always one'
  );
});

/* --- an empty breakdown does not look like a broken number -------------- */

// "Rincian Rp0" reads as a mistake. A transaction with no lines has
// no lines, and saying so is honest.
check('an empty breakdown does not show a zero total', () => {
  assert.ok(
    /lines\.length === 0[\s\S]{0,600}money\(total\)/.test(viewer) === false ||
      /lines\.length > 0[\s\S]{0,400}money\(total\)/.test(viewer),
    'the total is shown even when there are no lines'
  );
});

/* --- the row actions can be reached without a pointer -------------------- */

check('the row actions are reachable without hovering', () => {
  assert.ok(
    !/opacity-0 group-hover:opacity-100/.test(page),
    'the actions only appear on hover, so a touch screen cannot reach them'
  );
});

if (failed) {
  console.log(`\n${failed} failing, ${passed} passing`);
  process.exit(1);
}
console.log(`\nall ${passed} passing`);
