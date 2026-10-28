/**
 * The sign a transaction is shown with.
 *
 * A transaction is not always money coming in or money going out. A
 * transfer moves money from one of the reader's own accounts to
 * another, and the server writes its two halves as `transfer_out` and
 * `transfer_in`.
 *
 * The old code only knew `income` and `expense`, so anything that was
 * not an income was shown with a minus. The credit half of a transfer
 * therefore looked like an expense, and one transfer looked like two
 * expenses.
 *
 * The rules are in one place, so every screen that shows an amount
 * agrees about the sign.
 */

/** The types that add money to an account. */
const INCOMING_TYPES = new Set(['income', 'transfer_in']);

/** The types that take money out of an account. */
const OUTGOING_TYPES = new Set(['expense', 'transfer_out']);

/**
 * Does this transaction bring money in?
 *
 * An unknown type is neither, so it is not shown with a plus.
 */
export function isIncoming(type) {
  return INCOMING_TYPES.has(type);
}

/**
 * Does this transaction take money out?
 */
export function isOutgoing(type) {
  return OUTGOING_TYPES.has(type);
}

/**
 * The sign to write in front of the amount: `+` for money in, `-` for
 * money out.
 *
 * A transfer is money leaving one account and arriving in another. Both
 * halves are shown with their own sign, so the reader can see which
 * way the money went.
 *
 * A type nobody knows gets no sign at all: the reader is not told a
 * direction that may be wrong.
 */
export function amountSign(type) {
  if (isIncoming(type)) return '+';
  if (isOutgoing(type)) return '-';
  return '';
}

/**
 * The amount with its sign, ready to be written.
 *
 * The amount is written as it is written in the currency it is in; the
 * sign is added in front of it.
 */
export function signedAmount(amount, currency, type, format) {
  return `${amountSign(type)}${format(amount, currency)}`;
}

export default { isIncoming, isOutgoing, amountSign, signedAmount };
