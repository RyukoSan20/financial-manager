/**
 * What leaves this device.
 *
 * Every line here was read out of the code, not written from memory.
 * The test beside this file checks each named host against the
 * backend, so a line that stops being true is caught rather than
 * left standing.
 *
 * The shape of a line:
 *
 * - `id`     — the code the screen uses to find the words.
 * - `host`   — where the data goes.
 * - `carries` — whether the reader's own records travel with it.
 *
 * The last one is the important one. A price lookup is a question
 * about the world, and it carries nothing of the reader. The advice
 * and the receipt are about the reader, and they say so.
 *
 * The sentences that explain each line live in the words file,
 * `i18n/keys_batch8.js`, keyed by this same `id`. The facts are here
 * because they are checked against the backend; the sentences are
 * there because they are read by a person, in their own language.
 */

/**
 * The data that stays.
 *
 * This is the other half of the page: the things the application
 * keeps and does not send. It is written out so the reader can see
 * that the absence of an entry is deliberate and not an oversight.
 */
export const STAYS_LOCAL = [
  {
    id: 'stays_transactions',
  },
  {
    id: 'stays_accounts',
  },
  {
    id: 'stays_budgets',
  },
  {
    id: 'stays_recurring',
  },
  {
    id: 'stays_settings',
  },
];

/**
 * The data that goes.
 *
 * The order is the order of how much the reader's own records travel
 * with it: the ones that carry the most come first.
 *
 * The words that explain each line are in `i18n/keys_batch8.js`.
 */
export const GOES_OUT = [
  {
    id: 'out_advice',
    host: 'generativelanguage.googleapis.com',
    carries: true,
  },
  {
    id: 'out_receipt',
    host: 'generativelanguage.googleapis.com',
    carries: true,
  },
  {
    id: 'out_email',
    host: 'generativelanguage.googleapis.com',
    carries: true,
  },
  {
    id: 'out_gmail',
    host: 'gmail.googleapis.com',
    carries: true,
  },
  {
    id: 'out_location',
    host: 'nominatim.openstreetmap.org',
    carries: true,
  },
  {
    id: 'out_maps',
    host: 'maps.googleapis.com',
    carries: true,
  },
  {
    id: 'out_currency',
    host: 'api.frankfurter.dev',
    carries: false,
  },
  {
    id: 'out_market',
    host: 'query1.finance.yahoo.com',
    carries: false,
  },
  {
    id: 'out_search',
    host: 'shopee.co.id',
    carries: false,
  },
  {
    id: 'out_google_signin',
    host: 'oauth2.googleapis.com',
    carries: true,
  },
];

/**
 * What is never sent.
 *
 * Stated outright, because "we do not do that" is worth as much to
 * a reader as "we do that, here is how".
 */
export const NEVER_SENT = [
  {
    id: 'never_whole_records',
  },
  {
    id: 'never_bulk',
  },
  {
    id: 'never_sell',
  },
];

/**
 * Every host named above, so the test can check each one against the
 * backend.
 */
export const ALL_HOSTS = [...new Set(GOES_OUT.map((entry) => entry.host))];
