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
 * - `who`    — who receives it.
 * - `what`   — what is sent.
 * - `when`   — when it is sent.
 * - `why`    — why it is sent, which is the reason it is allowed to.
 * - `carries` — whether the reader's own records travel with it.
 *
 * The last one is the important one. A price lookup is a question
 * about the world, and it carries nothing of the reader. The advice
 * and the receipt are about the reader, and they say so.
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
    what: 'transactions',
    detail: 'Every transaction, with its amount, its category and its note.',
  },
  {
    id: 'stays_accounts',
    what: 'accounts and balances',
    detail: 'The accounts, their balances and their currencies.',
  },
  {
    id: 'stays_budgets',
    what: 'budgets and goals',
    detail: 'The limits, the targets and how far along they are.',
  },
  {
    id: 'stays_recurring',
    what: 'recurring rules',
    detail: 'The bills and income set up to repeat.',
  },
  {
    id: 'stays_settings',
    what: 'settings',
    detail: 'The language, the theme, the accent and the currency on screen.',
  },
];

/**
 * The data that goes.
 *
 * The order is the order of how much the reader's own records travel
 * with it: the ones that carry the most come first.
 */
export const GOES_OUT = [
  {
    id: 'out_advice',
    host: 'generativelanguage.googleapis.com',
    who: 'Google',
    what: 'The totals, the account balances, the budget limits, the goal progress and the debt total.',
    when: 'When the reader asks the AI Advisor for advice.',
    why: 'To answer the question. The numbers are the question.',
    carries: true,
  },
  {
    id: 'out_receipt',
    host: 'generativelanguage.googleapis.com',
    who: 'Google',
    what: 'The picture of the receipt, and the picture of the screen it was scanned from.',
    when: 'When the reader scans a receipt.',
    why: 'To read the words and the figures off the picture.',
    carries: true,
  },
  {
    id: 'out_email',
    host: 'generativelanguage.googleapis.com',
    who: 'Google',
    what: 'The sender, the subject and the first thousand characters of the email.',
    when: 'When a Gmail receipt cannot be read by the ordinary parsers and the last resort is used.',
    why: 'To pull the amount and the merchant out of the email.',
    carries: true,
  },
  {
    id: 'out_gmail',
    host: 'gmail.googleapis.com',
    who: 'Google',
    what: 'The list of messages, and the text of the ones that look like receipts.',
    when: 'When the reader connects Gmail, and afterwards when the inbox is checked.',
    why: 'To find the receipts in the first place.',
    carries: true,
  },
  {
    id: 'out_location',
    host: 'nominatim.openstreetmap.org',
    who: 'OpenStreetMap',
    what: 'The latitude and longitude, and the name that comes back.',
    when: 'When the reader asks where a transaction happened.',
    why: 'To turn a point on a map into a place name.',
    carries: true,
  },
  {
    id: 'out_maps',
    host: 'maps.googleapis.com',
    who: 'Google',
    what: 'The latitude and longitude.',
    when: 'When a map is shown for a transaction.',
    why: 'To draw the map.',
    carries: true,
  },
  {
    id: 'out_currency',
    host: 'api.frankfurter.dev',
    who: 'Frankfurter',
    what: 'Which currency is wanted. Nothing about the reader.',
    when: 'When a balance in another currency is added up.',
    why: 'To know what one currency is worth in another.',
    carries: false,
  },
  {
    id: 'out_market',
    host: 'query1.finance.yahoo.com',
    who: 'Yahoo Finance',
    what: 'Which ticker is wanted. Nothing about the reader.',
    when: 'When the market page is opened.',
    why: 'To show the price.',
    carries: false,
  },
  {
    id: 'out_search',
    host: 'shopee.co.id',
    who: 'The marketplace',
    what: 'The words the reader typed. Nothing about the reader.',
    when: 'When the reader searches for a product.',
    why: 'To find the product.',
    carries: false,
  },
  {
    id: 'out_google_signin',
    host: 'oauth2.googleapis.com',
    who: 'Google',
    what: 'The sign-in, and the name and email address that come back with it.',
    when: 'When the reader signs in with Google.',
    why: 'To know who is signing in.',
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
    what: 'The full history of your records',
    detail:
      'The advice is given the totals and the names of the accounts, budgets and goals, not the whole list of transactions one by one.',
  },
  {
    id: 'never_bulk',
    what: 'Your records in bulk',
    detail: 'There is no path in this application that exports everything at once.',
  },
  {
    id: 'never_sell',
    what: 'Your records to anyone else',
    detail:
      'The services above are the whole list. Your records are not sold, and they are not shared with an advertiser.',
  },
];

/**
 * Every host named above, so the test can check each one against the
 * backend.
 */
export const ALL_HOSTS = [...new Set(GOES_OUT.map((entry) => entry.host))];
