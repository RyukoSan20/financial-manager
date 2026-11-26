/**
 * Reading a sentence, from the browser's side.
 *
 * The text parser and the voice input both end up with a sentence and
 * both want the same answer: what kind of transaction this is, what it
 * cost, what was bought, which account it belongs to and which
 * category it sits under.
 *
 * The answer comes from one place on the server, so the same sentence
 * reads the same way whichever way it was written. This module is the
 * browser's half of that: it asks, and it holds the shape of the
 * answer so the two screens do not each invent their own.
 *
 * When the server cannot be reached, the reading is worked out here
 * instead. A reader who is offline still gets a transaction; the one
 * thing that is lost is the account that was matched.
 */

import api from '../../../services/api';
import { emptyReading } from './shape.js';
import { localReading } from './localReading.js';

export { emptyReading, localReading };

/**
 * Read a sentence.
 *
 * The reader's own accounts and categories travel with the request so
 * the server can match "gopay" to an account and "makanan" to a
 * category.
 */
export const readSentence = async (text, { accounts = [], categories = [] } = {}) => {
  const sentence = String(text || '').trim();
  if (!sentence) return emptyReading();

  try {
    const response = await api.request('/parser/parse-nlp', {
      method: 'POST',
      body: JSON.stringify({
        text: sentence,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          account_type: a.account_type,
          bank_name: a.bank_name,
        })),
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          system_key: c.system_key,
          type: c.type,
        })),
      }),
    });
    return { ...emptyReading(), ...(response || {}) };
  } catch (err) {
    console.warn('The server could not read the sentence:', err?.message || err);
    return localReading(sentence);
  }
};

export default { emptyReading, readSentence, localReading };
