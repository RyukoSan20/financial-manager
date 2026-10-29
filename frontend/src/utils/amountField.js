/**
 * What the amount field is showing, and what it means.
 *
 * The amount field takes an expression as well as a number: "25000"
 * is twenty-five thousand, and "25000+15000" is forty thousand. The
 * reader has to be able to see that the expression was understood
 * while they are still typing it, not after they press save and find
 * out what they got.
 *
 * So the field shows two things: the text the reader typed, and what
 * it comes to. The second one is only shown when the two are
 * different, because when the reader has typed a plain number there
 * is nothing to say.
 *
 * This file holds the arithmetic and the wording, with no React in
 * it, so it can be checked by a script.
 */

import { evaluateExpression, isExpression } from './amountExpression.js';

/**
 * The result of reading what the reader typed.
 *
 * `text` is what they typed, unchanged. `value` is what it comes to,
 * or null when it does not come to anything yet. `isSum` says
 * whether it is worth showing.
 */
export function readAmountField(text, { currency = 'IDR' } = {}) {
  const raw = String(text ?? '').trim();

  if (!raw) {
    return { text: '', value: null, isSum: false, hasError: false };
  }

  // A plain number. Nothing to add: the reader can see it.
  if (!isExpression(raw)) {
    const value = Number(raw);
    return {
      text: raw,
      value: Number.isFinite(value) ? value : null,
      isSum: false,
      hasError: !Number.isFinite(value),
    };
  }

  // An expression. It is worth showing what it comes to, because the
  // reader wrote it as a sum and cannot see the sum.
  const value = evaluateExpression(raw);

  if (value === null) {
    // The expression is not finished. "25000+" is half written, and
    // it is not an error, it is just not done.
    return { text: raw, value: null, isSum: true, hasError: false };
  }

  return { text: raw, value, isSum: true, hasError: false };
}

/**
 * The wording of the preview.
 *
 * The reader is told what the expression comes to, and how the parts
 * were read. The wording is the same in every language here because
 * it is built from the number itself and the operators, which are
 * the same everywhere.
 *
 * The caller supplies the two sentences, so the wording comes from
 * the translation and not from here.
 */
export function previewParts(result, { equalsText = '=', totalText = 'Total' } = {}) {
  if (!result || !result.isSum || result.value === null) return null;

  // The expression, with the operator that joins the parts, and what
  // it comes to.
  const parts = String(result.text).split(/(?=[+\-*/])/).filter(Boolean);

  return {
    expression: result.text,
    parts,
    equalsText,
    totalText,
    value: result.value,
  };
}

/**
 * Whether the expression reads as an error the reader should know
 * about.
 *
 * "25000+*15000" cannot be worked out and is not half written. That
 * is worth saying, because otherwise the reader presses save and
 * nothing happens.
 */
export function isBrokenExpression(text) {
  const raw = String(text ?? '').trim();
  if (!raw || !isExpression(raw)) return false;

  // Half written: it ends with an operator, or it starts with one.
  // These are not errors, they are just not finished.
  if (/[+\-*/]\s*$/.test(raw)) return false;
  if (/^\s*[+\-*/]/.test(raw)) return false;

  // Two operators in a row, like "25000+*15000". That cannot be
  // worked out and is not half written either.
  if (/[+\-*/]\s*[+\-*/]/.test(raw)) return true;

  // Anything with a bracket in it. The parser knows about numbers
  // and four operators, and a bracket is not one of them.
  if (/[()[\]]/.test(raw)) return true;

  // It cannot be worked out at all.
  return evaluateExpression(raw) === null;
}

/**
 * The number an amount field ends up with.
 *
 * An expression is worked out. A plain number is read as it is. Text
 * that is neither is read as zero, which is the same as an empty
 * field.
 */
export function resolveAmount(text, fallback = 0) {
  const result = readAmountField(text);
  if (result.value === null) return fallback;
  return result.value;
}
