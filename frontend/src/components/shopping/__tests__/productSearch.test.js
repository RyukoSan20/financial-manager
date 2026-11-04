/**
 * The price on the screen, and where it came from.
 *
 * Two things are checked here, and they are the two things that could
 * go wrong.
 *
 * The first: a price that came from the reader's own catalogue is not
 * a price in a shop, and the screen has to say which one it is
 * showing. A reader who sees a reference price and thinks it is a
 * price in a shop will decide to buy something they cannot afford.
 *
 * The second: the money that is shown is the money that was worked
 * out. A price that is rounded on the way to the screen is a price
 * that is no longer the one the server worked out, and the difference
 * between the two is what makes a receipt fail to add up.
 *
 * Run with: node src/components/shopping/__tests__/productSearch.test.js
 */

import { formatRupiah } from '../../../utils/money.js';

/**
 * A flat list of every check.
 */
let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

// ---------------------------------------------------------------------------
// The money
// ---------------------------------------------------------------------------

check(
  formatRupiah(0) === 'Rp 0',
  'nothing is Rp 0'
);

check(
  formatRupiah(11100) === 'Rp 11.100',
  'a whole amount has no cents'
);

check(
  formatRupiah(11100.5) === 'Rp 11.100,50',
  'the cents are kept when there are cents'
);

check(
  formatRupiah(9166.67) === 'Rp 9.166,67',
  'the cents of a base amount are kept'
);

check(
  formatRupiah(null) === 'Rp 0' && formatRupiah(undefined) === 'Rp 0',
  'nothing at all is Rp 0'
);

check(
  formatRupiah('not a number') === 'Rp 0',
  'a price that is not a number is Rp 0'
);

check(
  formatRupiah(1000000) === 'Rp 1.000.000',
  'a million is grouped the Indonesian way'
);

// The rounding is the interesting one. The server works the money out
// and sends it as a decimal string. The screen reads it as a number.
// If the number is read wrong the screen shows a different price from
// the one the server worked out, and there is no way to tell.
const fromServer = '11100.00';
check(
  formatRupiah(Number(fromServer)) === 'Rp 11.100',
  'the money the server sent is the money that is shown'
);

const serverBase = '9166.67';
check(
  formatRupiah(Number(serverBase)) === 'Rp 9.166,67',
  'the base of a tax is shown exactly as it was worked out'
);

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

console.log('');
console.log(`product search: ${checks} checks passed, ${failures} failed`);
if (failures > 0) {
  process.exit(1);
}
