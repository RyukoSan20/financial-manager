/**
 * The arithmetic of a number that counts to its new value.
 *
 * Run with: node src/utils/__tests__/countUp.test.js
 *
 * The number on the dashboard counts when it changes. The cases that
 * matter are the ones where a wrong answer would be visible: a count
 * that arrives at the wrong number, a count that runs backwards, and
 * a count that moves when nothing changed.
 */

import {
  COUNT_UP_DURATION_MS,
  easeOutCubic,
  clampProgress,
  countUpValue,
  shouldAnimate,
  decimalsOf,
} from '../countUp.js';

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
// The easing
// ---------------------------------------------------------------------------

check('the count starts at nothing', easeOutCubic(0), 0);
check('the count ends at everything', easeOutCubic(1), 1);
check('the count is past the middle at the middle', easeOutCubic(0.5) > 0.5, true);
check('the count starts faster than it ends', easeOutCubic(0.25) > 0.25, true);

// A progress outside the range is pulled back in, because a count
// that went past its target would show a number that is not the
// number.
check('a negative progress is nothing', clampProgress(-1), 0);
check('a progress past one is one', clampProgress(2), 1);
check('a progress that is not a number is one', clampProgress('abc'), 1);
check('a progress inside the range is left alone', clampProgress(0.4), 0.4);

// ---------------------------------------------------------------------------
// The value at a point in the count
// ---------------------------------------------------------------------------

check('the count starts at the old value', countUpValue(100, 200, 0), 100);
check('the count ends at the new value', countUpValue(100, 200, 1), 200);
check('the count is between the two values', countUpValue(100, 200, 0.5) > 100, true);
check('the count is between the two values', countUpValue(100, 200, 0.5) < 200, true);

// A count down is a count too.
check('the count goes down to the new value', countUpValue(200, 100, 1), 100);
check('the count goes down through the middle', countUpValue(200, 100, 0.5) < 200, true);
check('the count goes down through the middle', countUpValue(200, 100, 0.5) > 100, true);

// The count arrives at the number it was going to, not at a number
// that is very nearly it. This is the case that showed a tail of
// "39999.999999" on the screen.
check('the count ends at exactly the number', countUpValue(0, 40000, 1), 40000);
check('the count ends at exactly the number', countUpValue(100, 100.5, 1, 2), 100.5);
check('a rupiah count has no cents', countUpValue(0, 39999.9999999999, 1, 0), 40000);
check('a count with cents keeps them', countUpValue(0, 12.5, 1, 2), 12.5);
check('a count with cents keeps them', countUpValue(12.5, 12.75, 1, 2), 12.75);
check('a count with no decimals rounds to a whole number', countUpValue(0, 12.5, 1, 0), 13);

// A count that is given a number that is not a number does not
// produce a number that is not a number.
check('a value that is not a number is zero', countUpValue(0, 'abc', 1), 0);

// ---------------------------------------------------------------------------
// Whether a change is worth counting through
// ---------------------------------------------------------------------------

check('a change is counted', shouldAnimate(100, 200), true);
check('the same number is not counted', shouldAnimate(100, 100), false);
check('a difference that is too small to see is not counted', shouldAnimate(100, 100.4, 0), false);
check('a difference of one rupiah is counted', shouldAnimate(100, 101, 0), true);
check('a difference of one cent is counted in a currency with cents', shouldAnimate(100, 100.01, 2), true);
check('a number that is not a number is not counted', shouldAnimate(100, 'abc'), false);
check('a number that is not a number is not counted', shouldAnimate('abc', 100), false);

// ---------------------------------------------------------------------------
// How many decimals
// ---------------------------------------------------------------------------

check('a whole number has no decimals', decimalsOf(100), 0);
check('a number with cents has two', decimalsOf(100.25), 2);
check('a number with one decimal has one', decimalsOf(100.5), 1);
check('a number that is not a number has none', decimalsOf('abc'), 0);
check('a whole number written as "100.00" has none', decimalsOf(100), 0);

// ---------------------------------------------------------------------------
// The duration
// ---------------------------------------------------------------------------

check('the count is long enough to see', COUNT_UP_DURATION_MS >= 300, true);
check('the count is short enough not to wait for', COUNT_UP_DURATION_MS <= 1000, true);

// ---------------------------------------------------------------------------

console.log(`countUp: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
