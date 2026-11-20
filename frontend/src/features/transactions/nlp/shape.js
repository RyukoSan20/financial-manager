/**
 * The shape of a reading.
 *
 * A reading is what a sentence about money turned out to mean: the
 * kind of transaction, what it cost, what was bought, which account it
 * belongs to and which category it sits under.
 *
 * The fields are all here even when they are empty, so the screens
 * never have to ask whether a key is there. A screen that has to check
 * is a screen that will eventually show nothing at all.
 */

export const emptyReading = () => ({
  type: 'expense',
  total_amount: 0,
  items: [],
  merchant: null,
  location: null,
  category: null,
  category_id: null,
  account_id: null,
  account_hint: null,
  source_account: null,
  destination_account: null,
  source_account_id: null,
  destination_account_id: null,
  description: null,
  confidence: 0,
  raw_text: '',
  fixes: [],
});

export default emptyReading;
