/**
 * Writing money and dates.
 *
 * Two things are decided here, and they are decided separately:
 *
 * - **The currency.** Which symbol, how many decimals, how the digits
 *   are grouped. This follows the currency, not the language. A yen
 *   amount has no cents, and a rupiah amount is grouped with a dot.
 *
 * - **The language.** How a date is written, and how a number is read
 *   when it is typed. This follows the language, not the currency.
 *
 * Picking Japanese does not turn rupiah into yen. Picking a display
 * currency does not change the language.
 *
 * The dates are written in the reader's own timezone, Asia/Jakarta, so
 * a transaction recorded at nine in the evening in Jakarta does not
 * move to the previous day because the server is somewhere else.
 */

const CURRENCY_STYLE = {
  IDR: { symbol: 'Rp', decimals: 0, group: '.', decimal: ',' },
  USD: { symbol: '$', decimals: 2, group: ',', decimal: '.' },
  EUR: { symbol: '€', decimals: 2, group: ',', decimal: '.' },
  JPY: { symbol: '¥', decimals: 0, group: ',', decimal: '.' },
  GBP: { symbol: '£', decimals: 2, group: ',', decimal: '.' },
  AUD: { symbol: 'A$', decimals: 2, group: ',', decimal: '.' },
  SGD: { symbol: 'S$', decimals: 2, group: ',', decimal: '.' },
  MYR: { symbol: 'RM', decimals: 2, group: ',', decimal: '.' },
  CNY: { symbol: 'CN¥', decimals: 2, group: ',', decimal: '.' },
  INR: { symbol: '₹', decimals: 2, group: ',', decimal: '.' },
  THB: { symbol: '฿', decimals: 2, group: ',', decimal: '.' },
  PHP: { symbol: '₱', decimals: 2, group: ',', decimal: '.' },
  KRW: { symbol: '₩', decimals: 0, group: ',', decimal: '.' },
  VND: { symbol: '₫', decimals: 0, group: ',', decimal: '.' },
  HKD: { symbol: 'HK$', decimals: 2, group: ',', decimal: '.' },
  CAD: { symbol: 'C$', decimals: 2, group: ',', decimal: '.' },
  CHF: { symbol: 'CHF', decimals: 2, group: ',', decimal: '.' },
  SEK: { symbol: 'kr', decimals: 2, group: ',', decimal: '.' },
  NOK: { symbol: 'kr', decimals: 2, group: ',', decimal: '.' },
  DKK: { symbol: 'kr', decimals: 2, group: ',', decimal: '.' },
  PLN: { symbol: 'zł', decimals: 2, group: ',', decimal: '.' },
};

const DEFAULT_CURRENCY = 'IDR';

/** The timezone the reader is in. */
export const APP_TIMEZONE = 'Asia/Jakarta';

/** The locale the dates are written in. */
export const LOCALE_BY_LANGUAGE = {
  id: 'id-ID',
  en: 'en-US',
  ja: 'ja-JP',
};

const LANGUAGE_BY_LOCALE = {
  'id-ID': 'id',
  'en-US': 'en',
  'ja-JP': 'ja',
};

/**
 * The style of one currency: its symbol, its decimals, and how its
 * digits are grouped.
 */
export function currencyStyle(currency = DEFAULT_CURRENCY) {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  return CURRENCY_STYLE[code] || { ...CURRENCY_STYLE[DEFAULT_CURRENCY], symbol: code };
}

/**
 * Write an amount of money.
 *
 * The amount is a number, in the currency given. It is written the way
 * that currency is written: `Rp 5.975.000` for rupiah, `¥ 149,524`
 * for yen, `$1,234.56` for dollars.
 *
 * The number is grouped by hand rather than by `Intl`, because the
 * grouping belongs to the currency and `Intl` groups by the locale.
 */
export function formatRupiah(amount, currency = DEFAULT_CURRENCY, options = {}) {
  const { decimals, group, decimal, symbol } = currencyStyle(currency);

  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return `${symbol} 0`;
  }

  const value = Number(amount);
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const sign = value < 0 ? '-' : '';
  const tail = fraction ? `${decimal}${fraction}` : '';
  const space = options.noSpace ? '' : ' ';

  return `${sign}${symbol}${space}${grouped}${tail}`;
}

/**
 * Write a date.
 *
 * The date is shown in the reader's own timezone, so a transaction
 * recorded late in the evening keeps its day.
 *
 * `style` is one of:
 * - `short`  10 Okt 2026
 * - `long`   Jumat, 10 Oktober 2026
 * - `month`  Oktober 2026
 * - `day`    10 Okt
 * - `input`  10/10/2026, for a date being typed
 */
export function formatTanggal(value, style = 'short', language = null) {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const lang = language || currentLanguage();
  const locale = LOCALE_BY_LANGUAGE[lang] || LOCALE_BY_LANGUAGE.id;

  const options = {
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    month: { month: 'long', year: 'numeric' },
    day: { day: 'numeric', month: 'short' },
    input: { day: '2-digit', month: '2-digit', year: 'numeric' },
  }[style] || { day: 'numeric', month: 'short', year: 'numeric' };

  const formatted = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIMEZONE,
  }).format(date);

  return formatted;
}

/**
 * Write a number on a chart axis.
 *
 * The axis holds a range of numbers, so it needs short labels. A
 * small amount must not be written as "0jt", which is what happens
 * when everything is divided by a million: 25,000 rupiah becomes 0.
 *
 * The scale is chosen from the size of the number, and the unit is
 * written in the reader's language.
 */
export function formatAxisValue(value, language = null) {
  const lang = language || currentLanguage();
  const number = Number(value);
  if (!Number.isFinite(number)) return '';

  const absolute = Math.abs(number);

  // The units, written the way each language writes them.
  const units = {
    id: { thousand: 'rb', million: 'jt', billion: 'M' },
    en: { thousand: 'K', million: 'M', billion: 'B' },
    ja: { thousand: '千', million: '百万', billion: '十億' },
  }[lang] || { thousand: 'rb', million: 'jt', billion: 'M' };

  if (absolute >= 1_000_000_000) {
    return `${scaled(number / 1_000_000_000, lang)}${units.billion}`;
  }
  if (absolute >= 1_000_000) {
    return `${scaled(number / 1_000_000, lang)}${units.million}`;
  }
  if (absolute >= 1_000) {
    return `${scaled(number / 1_000, lang)}${units.thousand}`;
  }

  return scaled(number, lang);
}

/**
 * Write a number in full, with the grouping of the display currency.
 */
export function formatNumber(value, currency = DEFAULT_CURRENCY) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }
  const { group, decimals } = currencyStyle(currency);
  const fixed = Number(value).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * The language the reader has chosen.
 */
export function currentLanguage() {
  if (typeof window === 'undefined') return 'id';
  const stored = window.localStorage.getItem('language');
  return stored && LOCALE_BY_LANGUAGE[stored] ? stored : 'id';
}

/**
 * The language a locale belongs to.
 */
export function languageOf(locale) {
  return LANGUAGE_BY_LOCALE[locale] || 'id';
}

/**
 * Write a small number the way the language writes numbers.
 *
 * Indonesian writes 1,5 and English writes 1.5, so the label on a
 * chart axis reads the way the reader expects. The grouping and the
 * decimal mark belong to the language here, not to the currency,
 * because this is a bare number and not an amount of money.
 */
function scaled(value, lang) {
  const rounded = Math.round(Number(value) * 10) / 10;
  const locale = LOCALE_BY_LANGUAGE[lang] || LOCALE_BY_LANGUAGE.id;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(rounded);
}

export default {
  formatRupiah,
  formatTanggal,
  formatAxisValue,
  formatNumber,
  currencyStyle,
  currentLanguage,
  languageOf,
  APP_TIMEZONE,
};
