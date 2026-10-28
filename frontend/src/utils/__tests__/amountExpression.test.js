/**
 * The amount as an expression.
 *
 * Run with: node src/utils/__tests__/amountExpression.test.js
 *
 * The amount field takes an expression, so a reader can add two
 * numbers together in the field instead of in their head. The cases
 * that matter are the ones where a wrong answer would cost money:
 *
 * - the order of operations is the one every other calculator uses;
 * - an expression that cannot be read is left as the reader typed it,
 *   and never becomes a silent zero;
 * - nothing outside the four operators and the digits is ever run.
 */

import {
  isExpression,
  evaluateExpression,
  resolveAmountText,
} from '../amountExpression.js';

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
// What counts as an expression
// ---------------------------------------------------------------------------

check('a plain number is not an expression', isExpression('25000'), false);
check('a number with a plus is an expression', isExpression('25000+15000'), true);
check('a number with a minus is an expression', isExpression('25000-5000'), true);
check('a number with a star is an expression', isExpression('45000*2'), true);
check('a number with a slash is an expression', isExpression('45000/2'), true);
check('an empty text is not an expression', isExpression(''), false);

// ---------------------------------------------------------------------------
// The value of an expression
// ---------------------------------------------------------------------------

check('two numbers added', evaluateExpression('25000+15000'), 40000);
check('a number times a number', evaluateExpression('45000*2'), 90000);
check('a number divided by a number', evaluateExpression('45000/2'), 22500);
check('a number minus a number', evaluateExpression('25000-5000'), 20000);
check('the order of operations is the usual one', evaluateExpression('2+3*4'), 14);
check('brackets are not read', evaluateExpression('2+3*4'), 14);
check('multiplication before addition on the left', evaluateExpression('3*4+2'), 14);
check('subtraction before the multiplication', evaluateExpression('10-2*3'), 4);
check('subtraction to the left', evaluateExpression('10-3-2'), 5);
check('division before subtraction', evaluateExpression('10-6/3'), 8);
check('three numbers added', evaluateExpression('1+2+3'), 6);
check('a chain of operators', evaluateExpression('10+5*2-4'), 16);
check('spaces are ignored', evaluateExpression('25000 + 15000'), 40000);
check('a decimal is read', evaluateExpression('12.5+2.5'), 15);
check('a number on its own is not an expression', evaluateExpression('25000'), null);
check('an empty text is not an expression', evaluateExpression(''), null);

// ---------------------------------------------------------------------------
// What is not read
// ---------------------------------------------------------------------------

check('a letter is not read', evaluateExpression('abc'), null);
check('a letter among the numbers is not read', evaluateExpression('25000+abc'), null);
check('a bracket is not read', evaluateExpression('(25000+15000)'), null);
check('a currency symbol is not read', evaluateExpression('Rp25000+15000'), null);
check('a percentage is not read', evaluateExpression('25000+10%'), null);
check('two operators in a row are not read', evaluateExpression('25000++15000'), null);
check('an operator with nothing after it is not read', evaluateExpression('25000+'), null);
check('an operator with nothing before it is not read', evaluateExpression('+15000'), null);
check('a number with two points is not read', evaluateExpression('2.5.0+1'), null);
check('a number that is only a point is not read', evaluateExpression('.+1'), null);
check('a division by zero is not read', evaluateExpression('25000/0'), null);
check('a division by a zero product is not read', evaluateExpression('25000/(0)'), null);
// A very long expression is worked out, and does not hang. The
// result is finite, so it is read.
check(
  'a long expression is worked out',
  evaluateExpression('9'.repeat(20) + '*9'.repeat(20)) !== null,
  true
);
// A result that has overflowed is not a number, and is refused. The
// two numbers here multiply out to more than a double can hold.
check(
  'a result that has overflowed is not read',
  evaluateExpression('1'.padEnd(200, '0') + '*' + '1'.padEnd(200, '0')),
  null
);

// ---------------------------------------------------------------------------
// The text as a number
// ---------------------------------------------------------------------------

check('an expression becomes its number', resolveAmountText('25000+15000'), '40000');
check('an expression becomes its number', resolveAmountText('45000*2'), '90000');
check('a plain number is left alone', resolveAmountText('25000'), '25000');
check('a plain number is left alone', resolveAmountText('12.50'), '12.50');
check('an empty text stays empty', resolveAmountText(''), '');
check('text that cannot be read is left as the reader typed it', resolveAmountText('abc'), 'abc');
check('text that cannot be read is left as the reader typed it', resolveAmountText('25000+'), '25000+');
check('a division by zero is left as the reader typed it', resolveAmountText('25000/0'), '25000/0');
check('the result has no long tail', resolveAmountText('0.1+0.2'), '0.3');

// ---------------------------------------------------------------------------

console.log(`amountExpression: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
