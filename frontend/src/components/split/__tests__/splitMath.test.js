/**
 * The arithmetic of a shared bill, and the reading of a receipt.
 *
 * These are the checks that the parts of a bill add up to the whole
 * bill, and that a transfer receipt is read the way a bank writes
 * it.
 *
 * Run with: node src/components/split/__tests__/splitMath.test.js
 */

import {
  readAmountFromProof,
  parseIndonesianAmount,
  compareProof,
  equalShares,
  proportionalShares,
  inviteLink,
} from '../splitMath.js';

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

function checkClose(name, actual, expected) {
  if (Math.abs(actual - expected) < 0.01) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: about ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// The money on a transfer receipt
// ---------------------------------------------------------------------------

check(
  'the amount, read the way a bank writes it',
  readAmountFromProof(
    ['Transfer Berhasil', 'Nominal: Rp150.000', 'Rekening Tujuan: 1234567890 BCA'].join('\n'),
  ),
  150000,
);

check(
  'the amount, with a decimal part',
  readAmountFromProof('Total Transfer: Rp150.000,50'),
  150000.5,
);

check('the amount, written the English way', readAmountFromProof('Total: $1,500.25'), 1500.25);

check(
  'the account number is not read as the amount',
  readAmountFromProof(
    ['Transfer Berhasil', 'Rekening Tujuan: 1234567890', 'Nominal: Rp75.000'].join('\n'),
  ),
  75000,
);

check('a plain rupiah number', parseIndonesianAmount('150.000'), 150000);
check('a plain number', parseIndonesianAmount('150000'), 150000);
check('a number with a thousands mark', parseIndonesianAmount('1.500.000'), 1500000);
check('a number with a decimal comma', parseIndonesianAmount('54,50'), 54.5);

check('the proof says what it should', compareProof(150000, 150000).matches, true);
check('the proof does not say what it should', compareProof(150000, 150001).matches, false);
check('a proof with no amount in it', compareProof(null, 150000).matches, false);

// ---------------------------------------------------------------------------
// The bill divided equally
// ---------------------------------------------------------------------------

const three = equalShares(100000, 3, 0);
checkClose(
  'three ways of a hundred thousand add up to a hundred thousand',
  three.reduce((sum, value) => sum + value, 0),
  100000,
);
check('one of them gets the extra rupiah', three.includes(33334), true);
check('the other two get the rest', three.filter((value) => value === 33333).length, 2);

const cents = equalShares(100, 3, 2);
checkClose(
  'three ways of a hundred with cents add up to a hundred',
  cents.reduce((sum, value) => sum + value, 0),
  100,
);

check('a bill with nobody in it', equalShares(100000, 0, 0).length, 0);

// ---------------------------------------------------------------------------
// The tax shared in proportion to what was eaten
// ---------------------------------------------------------------------------

const proportional = proportionalShares(
  [
    { id: 1, quantity: 1, total_price: 50000 },
    { id: 2, quantity: 1, total_price: 150000 },
  ],
  { 1: { a: 1 }, 2: { b: 1 } },
  { tax: 20000, service_charge: 0, discount: 40000, grand_total: 180000 },
);
checkClose('the one who ate the small dish', proportional.a, 45000);
checkClose('the one who ate the big one', proportional.b, 135000);

// ---------------------------------------------------------------------------
// The link a friend opens
// ---------------------------------------------------------------------------

check(
  'the link points at the claim page for the group',
  inviteLink('https://example.test', 'ABCD2345'),
  'https://example.test/split/claim/ABCD2345',
);
check('no link without a code', inviteLink('https://example.test', ''), '');
check('no link without an address', inviteLink('', 'ABCD2345'), '');

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

console.log('');
console.log(`splitMath: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) {
    console.log('  FAIL ' + f);
  }
  process.exit(1);
}
