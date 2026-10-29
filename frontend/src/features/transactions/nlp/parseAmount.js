/**
 * Parse Indonesian currency amounts from text
 * Handles: "45rb", "1,5jt", "25.000", "100000", "1jt"
 *
 * The rules are the ones the server uses, so the quick entry box and
 * the voice parser read the same sentence the same way:
 *
 * - a dot is a thousands separator, so "25.000" is twenty five
 *   thousand and "1.500.000" is a million and a half;
 * - a comma is a decimal mark, so "1,5jt" is one and a half million;
 * - a number inside a date is a year or a day, and is not money.
 */

import { toNumber, dateRanges, isInsideDate, findMath } from './amountScan.js';

const MULTIPLIERS = {
  'k': 1000,
  'rb': 1000,
  'ribu': 1000,
  'jt': 1000000,
  'juta': 1000000,
  'rban': 100000,
  'c': 100,
};

// Indonesian number words
const NUMBER_WORDS = {
  'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
  'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9,
  'sepuluh': 10, 'sebelas': 11,
  'puluh': 'puluh', 'belas': 'belas',
  'ratus': 100, 'seratus': 100,
  'seribu': 1000,
};

/**
 * Parse amount from text
 * @param {string} text - Input text
 * @returns {{ value: number, span: [number, number] } | null}
 */
export function parseAmount(text) {
  if (!text) return null;

  const source = String(text);
  const dates = dateRanges(source);

  // Pattern: number with optional unit (rb,jt,k) or Indonesian number words
  // Match: 45rb, 1.5jt, 25000, 1,5jt, seratus ribu
  const RE = /(\d+(?:[.,]\d+)*)\s*(k|rb|ribu|jt|juta|rban|c)?(?!\w)/gi;

  let match;
  while ((match = RE.exec(source)) !== null) {
    const [raw, numStr, unit] = match;
    const start = match.index;
    const end = match.index + raw.length;

    // A number that is part of a date is a year or a day, and the
    // reader did not mean it as money.
    if (isInsideDate(dates, start, end)) continue;

    let value;

    if (unit) {
      // Has unit like "rb", "jt", "k"
      const num = toNumber(numStr);
      if (!Number.isFinite(num)) continue;
      value = Math.round(num * MULTIPLIERS[unit.toLowerCase()]);
    } else {
      // No unit - the dot is a thousands separator.
      const num = toNumber(numStr);
      if (!Number.isFinite(num)) continue;
      value = Math.round(num);

      // Ignore values < 1000 without unit (likely not money)
      if (value < 1000) continue;
    }

    if (value > 0 && value <= 1000000000) { // Max 1 billion
      return {
        value,
        span: [start, end],
        raw
      };
    }
  }

  // Try parsing plain number (minimum 4 digits = 1000 in thousands)
  const plainMatch = source.match(/^(\d{4,10})$/);
  if (plainMatch) {
    const val = parseInt(plainMatch[1], 10);
    if (val >= 1000 && val <= 1000000000) {
      return {
        value: val,
        span: [0, plainMatch[1].length],
        raw: plainMatch[1]
      };
    }
  }

  return null;
}

/**
 * Parse Indonesian number words (seratus ribu, dua puluh lima ribu)
 * @param {string} text
 * @returns {number | null}
 */
export function parseNumberWords(text) {
  const lower = text.toLowerCase();

  // Simple patterns
  if (lower.includes('seratus ribu') || lower.includes('seribu')) {
    return 1000;
  }
  if (lower.includes('ratus ribu') || lower.includes('ratusan ribu')) {
    // Extract the number before "ratus"
    const match = lower.match(/(\w+)\s*ratus/);
    if (match) {
      const num = NUMBER_WORDS[match[1]];
      if (num) return num * 100 * 1000;
    }
  }

  return null;
}

/**
 * Evaluate simple math expressions like "25000+15000" or "50000*2"
 *
 * The reader's own text is never run as code. The expression is read
 * by the parser in `utils/amountExpression.js` and walked as a tree.
 *
 * A division by zero is not a number, so the sum is refused rather
 * than the reader being shown an amount that came from nothing.
 *
 * @param {string} text
 * @returns {number | null}
 */
export function evalMath(text) {
  const found = findMath(text);
  return found ? found.value : null;
}

export default { parseAmount, parseNumberWords, evalMath };
