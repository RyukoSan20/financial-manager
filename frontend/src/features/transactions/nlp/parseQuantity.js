/**
 * Quantity times unit price.
 *
 * The reader writes what they bought: "2 indomie 3500" means two
 * packets at three thousand five hundred each, which is seven
 * thousand. The old reader took the first money it found and called it
 * the whole thing, so the reader had to do the multiplication in their
 * head, or write the total, or make three transactions.
 *
 * The shapes that are understood:
 *
 *   2 indomie 3500            the count before the thing
 *   indomie 2x 3500           the count after the thing, with an x
 *   indomie 2x3.500           the count and the price together
 *   ayam 4 @ 35rb             the count with an at sign
 *   indomie 2 bungkus harga satuan 3500
 *
 * What is NOT done:
 *
 *   kopi 45rb                 one thing is not a multiplication
 *   kopi 2 orang 50k          fifty thousand is the whole, not each
 *   2026 indomie 3500         a year is not a count of packets
 *
 * A sentence is only multiplied when there is both a count and a
 * price, and when the words make it plain that the price is the price
 * of one. Otherwise the sentence is left exactly as it was, because a
 * wrong total is worse than no total.
 */

import { parseAmount } from './parseAmount.js';

/**
 * The words that say the price is the price of one.
 *
 * Without one of these the price is taken to be the price of the
 * whole thing, and there is nothing to multiply.
 */
const UNIT_PRICE_WORDS = [
  'harga satuan',
  'harga satuannya',
  'harga per',
  'per pcs',
  'per buah',
  'satuan',
  'unit price',
  '@',
];

/**
 * The words that say the price belongs to everybody together.
 *
 * "kopi 2 orang 50k" is fifty thousand for the two of them, so it is
 * not a unit price and nothing is multiplied.
 */
const WHOLE_PRICE_WORDS = ['orang', 'orangnya', 'masing', 'per orang', 'total', 'semua', 'sebesar'];

const COUNT_WORDS = {
  satu: 1, sepcs: 1, '1': 1,
  dua: 2, sepasang: 2, '2': 2,
  tiga: 3, '3': 3,
  empat: 4, '4': 4,
  lima: 5, '5': 5,
  enam: 6, '6': 6,
  tujuh: 7, '7': 7,
  delapan: 8, '8': 8,
  sembilan: 9, '9': 9,
  sepuluh: 10, '10': 10,
  selusin: 12, lusin: 12,
  separuh: 0.5,
};

const MAX_QUANTITY = 1000;

/**
 * A year is not a count of packets.
 *
 * Four digits that look like a year are not a count. The reader writes
 * "2026 indomie 3500" about the year, not about two thousand and
 * twenty six packets.
 */
function looksLikeAYear(text) {
  return /\b(19|20)\d{2}\b/.test(text);
}

/**
 * The count in the sentence.
 *
 * Only small numbers count. A number of twenty thousand packets is a
 * price that was written in the wrong place, not a count.
 *
 * @param {string} text
 * @returns {{value: number, span: [number, number]}|null}
 */
function findCount(text) {
  const re = /(\d{1,4})|(\b(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|selusin|lusin)\b)/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const value = /^\d+$/.test(raw) ? Number(raw) : COUNT_WORDS[raw.toLowerCase()];
    if (!value || value <= 0 || value > MAX_QUANTITY) continue;
    // A year is not a count.
    if (/^\d{4}$/.test(raw)) continue;
    return { value, span: [match.index, match.index + raw.length] };
  }
  return null;
}

/**
 * The count that follows the thing, written with an x or a times.
 *
 * @param {string} text
 * @returns {{value: number, span: [number, number]}|null}
 */
function findCountAfterX(text) {
  const re = /(\d{1,4})\s*[x×]\s*(?=\d)/gi;
  const match = re.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (!value || value <= 0 || value > MAX_QUANTITY) return null;
  return { value, span: [match.index, match.index + match[1].length] };
}

/**
 * Remove the count and the price from the sentence, and tidy up what
 * is left of it.
 *
 * @param {string} text
 * @param {[number, number]} countSpan
 * @param {[number, number]} priceSpan
 * @returns {string}
 */
function describe(text, countSpan, priceSpan) {
  const spans = [countSpan, priceSpan].sort((a, b) => a[0] - b[0]);
  let out = '';
  let cursor = 0;
  for (const [start, end] of spans) {
    out += text.slice(cursor, start);
    cursor = end;
  }
  out += text.slice(cursor);

  return out
    .replace(/\b[x×]\b/g, '') // a stray x
    .replace(/@/g, '') // a stray at sign
    .replace(/\s*[x×@]\s*$/g, '') // a trailing x or at sign
    .replace(/\b(harga\s+satuan|harga\s+satuannya|harga\s+per|per\s+pcs|per\s+buah|satuan|unit\s+price)\b/gi, '')
    .replace(/[,\s]+$/g, '')
    .replace(/^\s*[,\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Read the count and the price of one out of the sentence.
 *
 * @param {string} text
 * @returns {{quantity: number, unitPrice: number, total: number, description: string}|null}
 */
export function parseQuantity(text) {
  if (!text) return null;

  const source = String(text);
  const lower = source.toLowerCase();

  // A year is not a count of packets.
  if (looksLikeAYear(source)) return null;

  // When the price is plainly the price of everybody together, it is
  // not the price of one, and nothing is multiplied.
  if (WHOLE_PRICE_WORDS.some((word) => lower.includes(word))) return null;

  const price = parseAmount(source);
  if (!price) return null;

  // The count written after the thing, with an x: "indomie 2x 3500".
  const afterX = findCountAfterX(source);
  const count = afterX || findCount(source);
  if (!count) return null;

  // The count and the price must not be the same characters.
  if (count.span[0] === price.span[0] && count.span[1] === price.span[1]) return null;

  // The price must come after the count, or at least not before it,
  // unless the x form says otherwise. "3500 indomie 2" is a price
  // first and is rare enough to leave alone.
  if (!afterX && price.span[0] < count.span[0]) return null;

  // The price must be the price of one.
  //
  // It is, when the reader says so in words ("harga satuan"), or
  // writes the count with an x or an at sign, or simply writes the
  // price after the count: "2 indomie 3500" is two at three thousand
  // five hundred.
  //
  // A price written BEFORE the count is the price of the whole thing:
  // "3500 indomie 2" is three thousand five hundred for two. That is
  // left alone, because multiplying it would double the truth.
  const between = source.slice(
    Math.min(count.span[1], price.span[0]),
    Math.max(count.span[0], price.span[1]),
  );
  const saysUnitPrice =
    UNIT_PRICE_WORDS.some((word) => lower.includes(word)) ||
    afterX !== null ||
    /^\s*@\s*$/.test(between) ||
    price.span[0] > count.span[0];

  if (!saysUnitPrice) return null;

  const total = count.value * price.value;
  if (!Number.isFinite(total) || total <= 0 || total > 1000000000) return null;

  return {
    quantity: count.value,
    unitPrice: price.value,
    total: Math.round(total),
    description: describe(source, count.span, price.span),
  };
}

export default { parseQuantity };
