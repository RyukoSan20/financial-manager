/**
 * The numbers the market page shows.
 *
 * Run with: node src/utils/__tests__/marketFormat.test.js
 *
 * A quote that is missing has to read as missing. When it is written
 * as `value.toFixed(2) + '%'`, a missing value becomes the word
 * "undefined" with a percent sign on the end, because the string is
 * always true. When it is written as `(value.toFixed(2) || '-') + '%'`,
 * a missing value becomes a dash with a percent sign on the end. Both
 * are lies: the reader is told the change is a number when there is
 * no number at all.
 *
 * The same applies to the table tabs. The page starts on one tab, and
 * that tab has to be one the page can actually draw, or the table
 * view opens empty and the reader has to guess that a tab exists.
 */

// The tabs the table view can show. The page starts on the first of
// them, so the table view is never empty when it opens.
export const TABLE_TABS = ['forex', 'idx', 'us', 'crypto', 'commodities'];

// The tab the page opens on.
export const DEFAULT_TABLE_TAB = TABLE_TABS[0];

// A percentage change, written the way a reader reads it.
//
// A missing number reads as a dash. A number that moved up carries a
// plus sign, a number that moved down carries the minus it already
// has, and a number that did not move is still a plus.
export const formatChangePercent = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

// A price, with its currency sign in front of it.
//
// A missing price reads as a dash rather than as "NaN" or as a
// currency sign with nothing after it.
export const formatPriceValue = (value, { decimals = 2, prefix = '' } = {}) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const text = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${text}`;
};

// Whether a change moved up. A missing change moved nowhere, so it is
// not up.
export const isChangeUp = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  return num >= 0;
};

// The quotes that match what the reader is looking for.
//
// A quote is matched on its symbol, its name or its pair, so a reader
// can search for "AAPL", for "Apple" or for "USD/IDR" and find the
// same row. An empty search keeps everything.
export const filterQuotes = (quotes, searchTerm) => {
  if (!Array.isArray(quotes)) return [];
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return [...quotes];
  return quotes.filter((q) => {
    if (!q || typeof q !== 'object') return false;
    return (
      String(q.symbol ?? '').toLowerCase().includes(term) ||
      String(q.name ?? '').toLowerCase().includes(term) ||
      String(q.pair ?? '').toLowerCase().includes(term)
    );
  });
};
