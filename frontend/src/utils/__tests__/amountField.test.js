/**
 * The amount field tells the reader what it understood.
 *
 * Run with: node src/utils/__tests__/amountField.test.js
 *
 * The amount field takes an expression as well as a number. The
 * reader has to be able to see that the expression was understood
 * while they are still typing it, not after they press save.
 *
 * The cases that matter:
 *
 * - a plain number shows nothing extra, because the reader can
 *   already see it;
 * - a finished expression shows what it comes to;
 * - a half-written expression is not an error, it is just not done;
 * - an expression that cannot be worked out is an error, and it says
 *   so, because otherwise the reader presses save and nothing
 *   happens.
 */

import {
  readAmountField,
  previewParts,
  isBrokenExpression,
  resolveAmount,
} from '../amountField.js';

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

// ---------------------------------------------------------------------------
// A plain number
// ---------------------------------------------------------------------------

check('an empty field is empty', readAmountField('').value, null);
check('an empty field is not a sum', readAmountField('').isSum, false);

check('a plain number reads as itself', readAmountField('25000').value, 25000);
check('a plain number is not a sum', readAmountField('25000').isSum, false);
check('a plain number has no error', readAmountField('25000').hasError, false);

check(
  'a plain number has no preview',
  previewParts(readAmountField('25000')),
  null
);

// ---------------------------------------------------------------------------
// A finished expression
// ---------------------------------------------------------------------------

check('a sum reads as a sum', readAmountField('25000+15000').isSum, true);
check('a sum is worked out', readAmountField('25000+15000').value, 40000);
check('a sum has no error', readAmountField('25000+15000').hasError, false);

check('multiplication is worked out', readAmountField('45000*2').value, 90000);
check('division is worked out', readAmountField('45000/2').value, 22500);
check('subtraction is worked out', readAmountField('50000-15000').value, 35000);

check(
  'the order of operations is the usual one',
  readAmountField('2+3*4').value,
  14
);

check(
  'brackets are not read as an expression',
  isBrokenExpression('(2+3)*4'),
  true
);

check(
  'a bracket is not worked out as a number',
  readAmountField('(2+3)*4').value,
  null
);

// ---------------------------------------------------------------------------
// A half-written expression
// ---------------------------------------------------------------------------

check('a sum with nothing after it is not an error', readAmountField('25000+').hasError, false);
check('a sum with nothing after it has no value yet', readAmountField('25000+').value, null);
check('a sum with nothing before it is not an error', readAmountField('+15000').hasError, false);

// ---------------------------------------------------------------------------
// An expression that cannot be worked out
// ---------------------------------------------------------------------------

check('two operators in a row is an error', isBrokenExpression('25000+*15000'), true);
// "25000+*" ends with an operator, so it reads as half written
// rather than as broken. The reader is still typing.
check('an expression that ends with an operator is not broken', isBrokenExpression('25000+*'), false);
check('two operators in the middle is an error', isBrokenExpression('25000+*15000'), true);
check('a plain number is not a broken expression', isBrokenExpression('25000'), false);
check('an empty field is not a broken expression', isBrokenExpression(''), false);
check('a good expression is not a broken expression', isBrokenExpression('25000+15000'), false);
check('a half-written expression is not a broken expression', isBrokenExpression('25000+'), false);

// ---------------------------------------------------------------------------
// The preview
// ---------------------------------------------------------------------------

const preview = previewParts(readAmountField('25000+15000'));

check('the preview shows the expression', preview.expression, '25000+15000');
check('the preview shows what it comes to', preview.value, 40000);
check('the preview breaks into the parts', preview.parts.length, 2);
check('the first part is the first number', preview.parts[0], '25000');
check('the second part carries the operator', preview.parts[1], '+15000');

check(
  'there is no preview for a half-written expression',
  previewParts(readAmountField('25000+')),
  null
);

// ---------------------------------------------------------------------------
// What the field ends up with
// ---------------------------------------------------------------------------

check('an expression ends up as its value', resolveAmount('25000+15000'), 40000);
check('a plain number ends up as itself', resolveAmount('25000'), 25000);
check('an empty field ends up as nothing', resolveAmount('', 0), 0);
check('text that is not a number ends up as nothing', resolveAmount('abc', 0), 0);

// ---------------------------------------------------------------------------

console.log(`amountField: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
