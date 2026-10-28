/**
 * The money and the dates, written the same way everywhere.
 *
 * Run with: node src/utils/__tests__/idFormat.test.js
 *
 * These are the numbers a reader sees. A rupiah amount is grouped
 * with a dot and has no decimals. A yen amount has no decimals either
 * and is grouped with a comma. A dollar amount has two decimals and
 * a dot for the point.
 *
 * A chart axis gets short labels, and a small amount must not be
 * written as "0jt".
 */

import {
  formatRupiah,
  formatTanggal,
  formatAxisValue,
  formatNumber,
  currencyStyle,
  cleanNumber,
} from '../idFormat.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------------
// formatRupiah
// ---------------------------------------------------------------------------

check('rupiah groups with a dot', formatRupiah(5975000, 'IDR'), 'Rp 5.975.000');
check('rupiah has no decimals', formatRupiah(25000, 'IDR'), 'Rp 25.000');
check('rupiah of zero', formatRupiah(0, 'IDR'), 'Rp 0');
check('negative rupiah', formatRupiah(-1500, 'IDR'), '-Rp 1.500');
check('a null amount is zero', formatRupiah(null, 'IDR'), 'Rp 0');
check('a missing amount is zero', formatRupiah(undefined, 'IDR'), 'Rp 0');
check('a broken amount is zero', formatRupiah('abc', 'IDR'), 'Rp 0');

check('yen has no decimals', formatRupiah(149524, 'JPY'), '¥ 149,524');
check('yen is grouped with a comma', formatRupiah(1234567, 'JPY'), '¥ 1,234,567');
check('dollar has two decimals', formatRupiah(1234.5, 'USD'), '$ 1,234.50');
check('dollar point is a dot', formatRupiah(1234.56, 'USD'), '$ 1,234.56');
check('euro', formatRupiah(99.99, 'EUR'), '€ 99.99');
check('pound', formatRupiah(1000, 'GBP'), '£ 1,000.00');

check('an unknown currency keeps its code', formatRupiah(100, 'XYZ'), 'XYZ 100');

// The symbol is the currency's own, never the language's.
check('the symbol follows the currency, not the language', currencyStyle('JPY').symbol, '¥');
check('a currency with no decimals', currencyStyle('KRW').decimals, 0);
check('a currency with decimals', currencyStyle('USD').decimals, 2);

// ---------------------------------------------------------------------------
// formatTanggal
// ---------------------------------------------------------------------------

// A date written in the reader's timezone, not the server's.
// 2026-10-10T23:30:00Z is the 11th in Jakarta, 06:30 in the morning.
const lateEvening = '2026-10-10T23:30:00Z';

check('a late evening stays on its own day in Jakarta', formatTanggal(lateEvening, 'short', 'id'), '11 Okt 2026');
check('the same date in English', formatTanggal(lateEvening, 'short', 'en'), 'Oct 11, 2026');
check('the same date in Japanese', formatTanggal(lateEvening, 'short', 'ja'), '2026年10月11日');
check('the long form names the weekday', formatTanggal(lateEvening, 'long', 'id'), 'Minggu, 11 Oktober 2026');
check('the month form', formatTanggal(lateEvening, 'month', 'id'), 'Oktober 2026');
check('the input form', formatTanggal(lateEvening, 'input', 'id'), '11/10/2026');
check('a missing date', formatTanggal(null), '-');
check('a broken date', formatTanggal('not-a-date'), '-');

// ---------------------------------------------------------------------------
// formatAxisValue
// ---------------------------------------------------------------------------

// This is the bug the chart axis had: everything was divided by a
// million, so 25,000 rupiah was written as "0jt".
check('a small amount is not written as zero', formatAxisValue(25000, 'id'), '25rb');
check('a small amount in English', formatAxisValue(25000, 'en'), '25K');
check('a million', formatAxisValue(1500000, 'id'), '1,5jt');
check('a million in English', formatAxisValue(1500000, 'en'), '1.5M');
check('a billion', formatAxisValue(2000000000, 'id'), '2M');
check('a plain number', formatAxisValue(750, 'id'), '750');
check('zero', formatAxisValue(0, 'id'), '0');
check('a negative amount', formatAxisValue(-25000, 'id'), '-25rb');
check('a broken number', formatAxisValue('abc', 'id'), '');

// The scale must be chosen so nothing rounds away to nothing.
for (const value of [1, 999, 1000, 25000, 999999, 1000000, 1500000, 999999999, 1000000000]) {
  const label = formatAxisValue(value, 'id');
  if (label === '0' || label === '0jt' || label === '0rb') {
    failed += 1;
    failures.push(`axis value ${value} was written as "${label}"`);
  } else {
    passed += 1;
  }
}

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

check('a grouped number in rupiah', formatNumber(5975000, 'IDR'), '5.975.000');
check('a grouped number in dollars', formatNumber(1234567.89, 'USD'), '1,234,567.89');
check('a missing number', formatNumber(null, 'IDR'), '0');

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

// The bug this fixes: a subtraction of two almost equal amounts came
// out as -0.0000014397338687, and that was written on the chart.
check('a number very close to zero is zero', cleanNumber(-0.0000014397338687), 0);
check('a tiny positive number is zero', cleanNumber(0.0000014397338687), 0);
check('exactly zero is zero', cleanNumber(0), 0);
check('negative zero is zero', cleanNumber(-0), 0);

// A whole number with a floating point tail is the whole number.
//
// The tails are written as sums rather than as literals, because a
// literal that long does not survive the trip through the parser and
// the linter rightly complains about it.
check(
  'a float tail is cleaned',
  cleanNumber(250000 + 0.00000000003),
  250000
);
check(
  'a big float tail is cleaned',
  cleanNumber(1234567.89 + 0.0000000002),
  1234567.89
);

// An ordinary number is left alone.
check('an ordinary number is unchanged', cleanNumber(5996400), 5996400);
check('a negative number is unchanged', cleanNumber(-1500), -1500);
check('a fraction is kept', cleanNumber(12.5), 12.5);

// A number that is not a number is zero, not NaN.
check('NaN is zero', cleanNumber(NaN), 0);
check('undefined is zero', cleanNumber(undefined), 0);
check('null is zero', cleanNumber(null), 0);
check('a string number is read', cleanNumber('5996400'), 5996400);
check('a word is zero', cleanNumber('not a number'), 0);
check('Infinity is zero', cleanNumber(Infinity), 0);
check('negative Infinity is zero', cleanNumber(-Infinity), 0);

// The result is always a number, never a string.
check('the result is a number', typeof cleanNumber('5996400'), 'number');

// ---------------------------------------------------------------------------

console.log('');
console.log(`idFormat: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) {
    console.log('  FAIL ' + f);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// cleanNumber
