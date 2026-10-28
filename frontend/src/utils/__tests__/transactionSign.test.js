/**
 * The sign a transaction is shown with.
 *
 * Run with: node src/utils/__tests__/transactionSign.test.js
 *
 * A transfer has two halves, and the credit half used to be shown with
 * a minus, so one transfer looked like two expenses. These are the
 * cases where getting the sign wrong misreads the reader's own money.
 */

import {
  isIncoming,
  isOutgoing,
  amountSign,
} from '../transactionSign.js';

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
// Money coming in
// ---------------------------------------------------------------------------

check('an income brings money in', isIncoming('income'), true);
check('the credit half of a transfer brings money in', isIncoming('transfer_in'), true);

// ---------------------------------------------------------------------------
// Money going out
// ---------------------------------------------------------------------------

check('an expense takes money out', isOutgoing('expense'), true);
check('the debit half of a transfer takes money out', isOutgoing('transfer_out'), true);

// ---------------------------------------------------------------------------
// The two halves of a transfer are not the same thing
// ---------------------------------------------------------------------------

check('the debit half is not incoming', isIncoming('transfer_out'), false);
check('the credit half is not outgoing', isOutgoing('transfer_in'), false);

// ---------------------------------------------------------------------------
// The sign that is written
// ---------------------------------------------------------------------------

check('an income is written with a plus', amountSign('income'), '+');
check('an expense is written with a minus', amountSign('expense'), '-');
check(
  'the debit half of a transfer is written with a minus',
  amountSign('transfer_out'),
  '-'
);
check(
  'the credit half of a transfer is written with a plus',
  amountSign('transfer_in'),
  '+'
);

// ---------------------------------------------------------------------------
// A type nobody knows
// ---------------------------------------------------------------------------

check('an unknown type is neither', isIncoming('mystery'), false);
check('an unknown type is not outgoing either', isOutgoing('mystery'), false);
check('an unknown type has no sign at all', amountSign('mystery'), '');
check('no type at all has no sign', amountSign(undefined), '');

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

if (failed > 0) {
  console.error(`${failed} check(s) failed:\n`);
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}

console.log(`All ${passed} checks passed.`);
