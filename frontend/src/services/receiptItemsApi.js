/**
 * The itemised receipt of a transaction.
 *
 * A receipt is a list of lines, and each line has a count, a price
 * and a category of its own. The reader who buys AYAM PANGGANG and a
 * RED VELVET LATTE on one piece of paper usually wants the food to
 * go to food and the latte to go to drinks, and a receipt that
 * cannot say that puts everything in one bucket.
 *
 * The three numbers on the receipt are kept apart:
 *
 *     subtotal - discount + tax = net
 *
 * The discount and the tax are the ones written on the paper, and
 * the reader can change both of them here.
 */

import api from './api';

/**
 * The receipt of a transaction, with its lines.
 */
export async function readReceiptItems(transactionId) {
  return api.get(`/receipt-items/${transactionId}`);
}

/**
 * Save the receipt of a transaction.
 *
 * The lines that are there are changed in place, a line the reader
 * added is made, and a line they took away is taken away. The
 * subtotal is worked out from the lines; the discount and the tax
 * are what was sent.
 */
export async function writeReceiptItems(transactionId, payload) {
  return api.put(`/receipt-items/${transactionId}`, payload);
}

/**
 * Ask the catalog what each line probably is.
 *
 * The answer is a guess, and it is a guess the reader can refuse:
 * every line keeps its category until it is changed by hand.
 */
export async function categorizeReceiptItems(transactionId) {
  return api.post(`/receipt-items/${transactionId}/categorize`);
}

/**
 * The three numbers on a receipt.
 *
 * The rule is written down once, in `utils/receiptMath`, and used by
 * both the screen and the server.
 */
export { netTotal, subtotalOf, taxFor, round2 } from '../utils/receiptMath';

export default {
  readReceiptItems,
  writeReceiptItems,
  categorizeReceiptItems,
};
