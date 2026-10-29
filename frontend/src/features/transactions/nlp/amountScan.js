/**
 * Reading a sum out of a line of words.
 *
 * The quick entry box takes one line from the reader. That line is
 * not a number: it is words, a date, an amount, or a sum the reader
 * wrote themselves ("25000+15000").
 *
 * This file holds the parts that need to agree with each other:
 *
 * - how a number written in Indonesian is read ("45.000" is forty
 *   five thousand, "1.500.000" is a million and a half);
 * - which parts of a line are a date, and are therefore not money;
 * - what a sum comes to.
 *
 * The rules are the same ones the server uses, so the box and the
 * voice parser do not disagree about the same sentence.
 */

import { evaluateExpression } from '../../../utils/amountExpression.js';

// A number, with the dots and commas a reader writes, and the unit
// that may follow it.
const NUMBER_RE = /(\d+(?:[.,]\d+)*)\s*(k|rb|ribu|jt|juta|rban|c)?(?!\w)/gi;

// A date: a year, a month, a day. Nothing inside one of these is money.
const DATE_RE = /\d{4}-\d{1,2}-\d{1,2}/g;

// A sum: numbers joined by the four operators.
const EXPRESSION_RE = /(\d+(?:[.,]\d+)?(?:\s*[+\-*/]\s*\d+(?:[.,]\d+)?)+)/;

/**
 * The number a written number stands for.
 *
 * The same rule the server uses:
 *
 * - "15.500" is fifteen thousand five hundred, because the dot is a
 *   thousands separator;
 * - "1,5" is one and a half, because the comma is a decimal mark;
 * - the right-most separator decides when there is more than one.
 */
export function toNumber(raw) {
  const source = String(raw ?? '').trim();
  if (!source) return NaN;

  let text;
  if (source.includes('.') && source.includes(',')) {
    text = source.rfind(',') > source.rfind('.')
      ? source.replace(/\./g, '').replace(',', '.')
      : source.replace(/,/g, '');
  } else if (source.includes('.')) {
    const parts = source.split('.');
    const grouped = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    text = grouped ? source.replace(/\./g, '') : source;
  } else if (source.includes(',')) {
    const parts = source.split(',');
    const grouped = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    text = grouped ? source.replace(/,/g, '') : source.replace(',', '.');
  } else {
    text = source;
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * The parts of the text that are a date.
 *
 * Each one is a pair: where it starts and where it ends. A number
 * that falls inside one of them is a year or a day, and the reader
 * did not mean it as money.
 */
export function dateRanges(text) {
  const source = String(text ?? '');
  const ranges = [];
  for (const match of source.matchAll(DATE_RE)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/**
 * Is this number inside a date?
 */
export function isInsideDate(ranges, start, end) {
  return ranges.some(([from, to]) => start < to && end > from);
}

/**
 * The sum a reader wrote.
 *
 * The reader's own text is never run as code. The expression is read
 * by the parser in `utils/amountExpression.js`, which knows about
 * numbers and four operators and nothing else.
 *
 * A division by zero is not a number, and a date is not a sum, so
 * both are refused rather than turned into an amount.
 */
export function findMath(text) {
  const source = String(text ?? '');
  if (!source) return null;

  // A date is not a sum.
  if (/\d{4}-\d{1,2}-\d{1,2}/.test(source)) return null;

  const match = source.match(EXPRESSION_RE);
  if (!match) return null;

  const raw = match[0];

  // Each number in the sum is read with the Indonesian rule first, so
  // "25.000+15.000" is forty thousand and not two point five.
  const normalized = raw.replace(/\d+(?:[.,]\d+)*/g, (part) => {
    const value = toNumber(part);
    return Number.isFinite(value) ? String(value) : '0';
  });

  const value = evaluateExpression(normalized);

  return {
    value,
    span: [match.index, match.index + raw.length],
    raw,
  };
}

/**
 * The value of a sum, for the callers that only want the number.
 */
export function evalMath(text) {
  const found = findMath(text);
  return found ? found.value : null;
}

export default { toNumber, dateRanges, isInsideDate, findMath, evalMath };
