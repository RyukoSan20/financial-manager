/**
 * The three numbers on a receipt.
 *
 * A receipt has a subtotal, a discount and a tax, and the net is
 * what comes out of them:
 *
 *     subtotal - discount + tax = net
 *
 * The rule is written down once, here, and used by both the screen
 * and the server. The screen shows the net while the reader is still
 * typing, and the server works it out again when the receipt is
 * saved. If the two rules were different, the number on the screen
 * would change when it was saved, and the reader would not trust
 * either of them.
 */

/**
 * A number of money, to two places.
 *
 * Two places, because a rupiah has no smaller unit that anybody
 * spends, and a receipt that adds up to a fraction of a rupiah is a
 * receipt that was typed by hand.
 */
export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * The subtotal of a receipt: the lines, without the discounts.
 *
 * A line marked as a discount is not part of the subtotal. The
 * discount is a number of its own, and counting the line as well
 * would take it off twice.
 */
export function subtotalOf(items) {
  return round2((items || []).reduce((sum, item) => {
    if (item.is_discount) return sum;
    // A line with no count is one of them, not none. A line with a
    // count of zero is worth nothing, which is a different thing.
    const quantity = item.quantity === undefined || item.quantity === null
      ? 1
      : (Number(item.quantity) || 0);
    const unitPrice = Number(item.unit_price) || 0;
    return sum + quantity * unitPrice;
  }, 0));
}

/**
 * The net total of a receipt.
 *
 * What was actually paid: the lines, less the discount, plus the tax.
 */
export function netTotal(items, discountTotal, taxTotal) {
  const subtotal = subtotalOf(items);
  const discount = Number(discountTotal) || 0;
  const tax = Number(taxTotal) || 0;
  return round2(subtotal - discount + tax);
}

/**
 * The tax that would make a receipt come out at a given amount.
 *
 * The reader who knows what they paid and what the lines came to can
 * work out what the tax was, which is how a receipt that was
 * scanned wrong gets fixed.
 */
export function taxFor(net, items, discountTotal) {
  const subtotal = subtotalOf(items);
  const discount = Number(discountTotal) || 0;
  return round2((Number(net) || 0) - subtotal + discount);
}
