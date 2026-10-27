/**
 * Writing the amount as it is typed.
 *
 * The amount a reader types has to survive three things at once:
 *
 * - **The currency.** Rupiah has no cents; dollars have two. A dollar
 *   amount of 12.50 is not the same as 12, and writing 12 when the
 *   reader meant 12.50 is losing money.
 * - **The grouping.** A rupiah amount is grouped with a dot, a dollar
 *   amount with a comma, and the reader should see the number the way
 *   their currency writes it.
 * - **The keyboard.** A phone's number pad gives a plain `.`, and the
 *   reader may type it, so the decimal has to be accepted.
 *
 * The state kept here is a plain string of digits with at most one
 * decimal point. The grouping is only for reading, so it is added
 * when the number is shown and taken off when it is read back.
 *
 * These are plain functions with no React in them, so they can be
 * checked by a script.
 */

/**
 * The style of one currency: how many decimals, and how the digits are
 * grouped and written.
 *
 * This is the same table the rest of the application uses, so the
 * amount on this screen is written the way the other screens write it.
 */
const CURRENCY_STYLE = {
  IDR: { decimals: 0, group: '.', decimal: ',' },
  USD: { decimals: 2, group: ',', decimal: '.' },
  EUR: { decimals: 2, group: ',', decimal: '.' },
  JPY: { decimals: 0, group: ',', decimal: '.' },
  GBP: { decimals: 2, group: ',', decimal: '.' },
  AUD: { decimals: 2, group: ',', decimal: '.' },
  SGD: { decimals: 2, group: ',', decimal: '.' },
  MYR: { decimals: 2, group: ',', decimal: '.' },
  CNY: { decimals: 2, group: ',', decimal: '.' },
  INR: { decimals: 2, group: ',', decimal: '.' },
  THB: { decimals: 2, group: ',', decimal: '.' },
  PHP: { decimals: 2, group: ',', decimal: '.' },
  KRW: { decimals: 0, group: ',', decimal: '.' },
  VND: { decimals: 0, group: ',', decimal: '.' },
  HKD: { decimals: 2, group: ',', decimal: '.' },
  CAD: { decimals: 2, group: ',', decimal: '.' },
  CHF: { decimals: 2, group: ',', decimal: '.' },
  NZD: { decimals: 2, group: ',', decimal: '.' },
  SEK: { decimals: 2, group: ',', decimal: '.' },
  NOK: { decimals: 2, group: ',', decimal: '.' },
  DKK: { decimals: 2, group: ',', decimal: '.' },
  MXN: { decimals: 2, group: ',', decimal: '.' },
  BRL: { decimals: 2, group: ',', decimal: '.' },
  ZAR: { decimals: 2, group: ',', decimal: '.' },
};

const DEFAULT_CURRENCY = 'IDR';

/**
 * The style of a currency. An unknown code falls back to rupiah, which
 * is what the application does everywhere else.
 */
export function amountStyle(currency = DEFAULT_CURRENCY) {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  return CURRENCY_STYLE[code] || CURRENCY_STYLE[DEFAULT_CURRENCY];
}

/**
 * How many decimals a currency has.
 */
export function amountDecimals(currency = DEFAULT_CURRENCY) {
  return amountStyle(currency).decimals;
}

/**
 * Clean up what the reader typed.
 *
 * Only the digits are kept, and at most one decimal point, and no more
 * of them than the currency has decimals.
 *
 * A currency with no cents has no decimal point at all: a rupiah
 * amount of "12.50" is 12.50 rupiah, which is not a thing, so the
 * point is dropped and the digits after it are kept. That is what the
 * reader meant by the keypad, and it is what the amount has always
 * been in this application.
 *
 * For a currency with cents, the decimal point is `.`, because that is
 * what every currency with cents uses. A comma is a grouping mark and
 * is removed.
 */
export function sanitizeAmount(text, currency = DEFAULT_CURRENCY) {
  const { decimals } = amountStyle(currency);
  const raw = String(text ?? '');

  if (decimals === 0) {
    // No cents: only the digits survive.
    return raw.replace(/\D/g, '');
  }

  // Keep the digits and the first decimal point.
  let seenPoint = false;
  let kept = '';
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      kept += ch;
    } else if (ch === '.' && !seenPoint) {
      seenPoint = true;
      kept += '.';
    }
    // A comma, a space and anything else are not part of the number.
  }

  // No more of them than the currency has decimals.
  if (seenPoint) {
    const [whole, fraction = ''] = kept.split('.');
    const trimmed = fraction.slice(0, decimals);
    kept = trimmed ? `${whole}.${trimmed}` : `${whole}.`;
  }

  return kept;
}

/**
 * Write the amount the way its currency writes it.
 *
 * The grouping is for reading, so it is added here and taken off again
 * by `parseAmount`. An empty amount stays empty, rather than becoming
 * a zero, so the field's placeholder shows.
 *
 * The decimal point is always a `.`, whatever the currency writes it
 * as, because that is what every phone keyboard gives and because it
 * keeps the reading-back unambiguous. A currency that groups with a
 * dot has no cents, so the two never meet.
 */
export function formatAmountInput(text, currency = DEFAULT_CURRENCY) {
  const { group } = amountStyle(currency);
  const raw = String(text ?? '').trim();

  if (!raw) return '';

  const negative = raw.startsWith('-');
  const withoutSign = negative ? raw.slice(1) : raw;

  const [whole = '', fraction] = withoutSign.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);

  const tail = fraction === undefined ? '' : `.${fraction}`;

  return `${negative ? '-' : ''}${grouped}${tail}`;
}

/**
 * Read the amount back as a number.
 *
 * The grouping marks are removed and the decimal point is read as a
 * point, whatever the currency writes it as.
 */
export function parseAmount(text, currency = DEFAULT_CURRENCY) {
  const { decimals } = amountStyle(currency);
  const raw = String(text ?? '').trim();

  if (!raw) return 0;

  const cleaned = decimals === 0
    ? raw.replace(/\D/g, '')
    : raw.replace(/,/g, '').replace(/\./g, '.');

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Add to the amount that is already there.
 *
 * The quick amount buttons add to what the reader has typed, rather
 * than replacing it, so pressing 5000 twice is 10000. The sum is
 * rounded to the decimals the currency has, so 12.50 plus 0.25 in
 * rupiah-with-cents is 12.75 and not 12.750000000000001.
 */
export function addAmount(current, preset, currency = DEFAULT_CURRENCY) {
  const { decimals } = amountStyle(currency);
  const sum = parseAmount(current, currency) + (Number(preset) || 0);
  const factor = 10 ** decimals;
  const rounded = Math.round(sum * factor) / factor;
  return String(rounded);
}

export default {
  amountStyle,
  amountDecimals,
  sanitizeAmount,
  formatAmountInput,
  parseAmount,
  addAmount,
};
