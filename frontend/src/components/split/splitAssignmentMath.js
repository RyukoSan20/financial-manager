/**
 * The arithmetic of assigning the lines of a receipt to the people
 * at the table.
 *
 * A shared bill is a set of lines and a set of people. Somebody has
 * to decide which line belongs to whom, and the money has to add up
 * at the end of it. Two ways of doing that are here:
 *
 * - equally, where everybody pays the same and the leftover rupiah
 *   goes to the first people in the order they are given;
 * - per item, where every line belongs to one person, and the tax
 *   and the discount of the receipt are spread in the same
 *   proportion as the lines they were charged on.
 *
 * The money is worked out in whole rupiah, because a rupiah is the
 * smallest unit there is. A bill of a hundred thousand split three
 * ways is 33.334, 33.333 and 33.333, and the three of them add up to
 * a hundred thousand exactly. No rupiah is lost and none is invented.
 *
 * The rule for the tax and the discount: they are charged on the
 * whole receipt, not on one line. So when the receipt is looked at
 * line by line, each line carries its share of them, in proportion
 * to what that line costs. The person who had the expensive dish
 * carries more of the tax, because the tax was charged on the
 * expensive dish.
 *
 * This file is pure. It reads numbers and gives numbers back, and it
 * does not know what a screen is. The tests read it on its own.
 */

const EPSILON = 1e-9;

/**
 * A number that is a number.
 *
 * Money arrives as text from the server, and a blank is not a
 * number. Everything that is not a number is zero.
 */
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The lines of the receipt, as plain numbers.
 *
 * The lines arrive with different names for the same thing depending
 * on where they came from, so the names that are read here are the
 * ones the screen and the server use between them.
 *
 * The tax and the discount on a line are the ones that are declared
 * on that line. They are the pool for the whole receipt when the
 * receipt itself does not say what its tax and its discount are.
 */
function normalize(item) {
  const source = item || {};

  const quantity = number(source.quantity);
  const unitPrice = number(
    source.unitPrice !== undefined && source.unitPrice !== null
      ? source.unitPrice
      : source.unit_price,
  );

  let subtotal;
  if (source.subtotal !== undefined && source.subtotal !== null) {
    subtotal = number(source.subtotal);
  } else if (quantity > 0 && unitPrice > 0) {
    subtotal = quantity * unitPrice;
  } else {
    subtotal = number(
      source.total !== undefined && source.total !== null
        ? source.total
        : source.total_price,
    );
  }

  return {
    id: source.id,
    name: source.name || '',
    subtotal: Math.round(subtotal),
    discount: Math.max(0, number(source.discount)),
    tax: Math.max(0, number(source.tax)),
  };
}

/**
 * The name of a person, whichever name they are given.
 */
function memberName(member) {
  if (!member) return '';
  return member.name || member.display_name || '';
}

/**
 * Who a line belongs to.
 *
 * The keys of the map of assignments are the ids of the lines, and
 * they arrive as text from a form and as numbers from the server, so
 * they are compared as text.
 */
function ownerOf(assignments, itemId) {
  const map = assignments || {};
  const key = String(itemId);
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    return map[key];
  }
  for (const name of Object.keys(map)) {
    if (String(name) === key) return map[name];
  }
  return undefined;
}

/**
 * A whole amount of money, spread over some weights.
 *
 * The largest remainder method: everybody gets the part of the amount
 * that their weight says they should, and the rupiahs that are left
 * over go to the people whose part was cut the most. The parts add up
 * to the amount exactly, and the order of the answer is the order of
 * the weights, so the same bill always splits the same way.
 */
function allocate(amount, weights) {
  const count = weights.length;
  if (!count) return [];

  const units = Math.round(number(amount));
  const total = weights.reduce((sum, weight) => sum + number(weight), 0);

  // Nothing to weigh against: the amount is shared evenly, and the
  // leftover goes to the first people in the order they are given.
  if (total <= EPSILON) {
    const out = new Array(count).fill(0);
    const base = Math.floor(units / count);
    let left = units - base * count;
    for (let index = 0; index < count; index += 1) {
      out[index] = base;
      if (left > 0) {
        out[index] += 1;
        left -= 1;
      }
    }
    return out;
  }

  const raw = weights.map((weight) => (units * number(weight)) / total);
  const out = raw.map((value) => Math.floor(value));
  let left = units - out.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let turn = 0;
  while (left > 0 && order.length) {
    out[order[turn % order.length].index] += 1;
    left -= 1;
    turn += 1;
  }
  return out;
}

/**
 * A bill divided equally.
 *
 * The leftover rupiah goes to the first people in the order they are
 * given, which is the order of the members of the group. A hundred
 * thousand divided three ways is 33.334, 33.333 and 33.333.
 */
export function equalSplitTotal(total, memberCount) {
  const count = Math.floor(number(memberCount));
  if (count <= 0) return [];
  return allocate(number(total), new Array(count).fill(1));
}

/**
 * The tax and the discount of a bill, put onto its lines.
 *
 * The tax and the discount of a receipt are charged on the whole
 * receipt, not on one line. When the lines are looked at one by one,
 * each line has to carry its share of them, or the shares of the
 * people would not add up to the bill.
 *
 * A tax or a discount that is not given is left as the line has it.
 * A tax or a discount that is given is the whole of the receipt's,
 * and it is spread over the lines in proportion to what each line
 * costs. The lines are given back with the tax and the discount
 * filled in, and the parts add up to the bill exactly.
 *
 * There is one thing this file does not do on its own: it does not
 * decide whether the receipt's tax is the tax of the bill or the tax
 * of the lines. A receipt that writes the tax once, on the total, has
 * a bill tax. A receipt that writes the tax on each line has a line
 * tax. `computeShares` reads the receipt and says which it is, and
 * passes the answer here.
 *
 * So the pool that is spread here is the bill's own pool, and it is
 * already the sum of what the lines carry.
 */
export function withBillExtras(items, tax, discount) {
  const lines = (items || []).map(normalize);
  if (!lines.length) return lines;

  const weights = lines.map((line) => line.subtotal);

  const taxParts =
    tax === undefined || tax === null
      ? lines.map((line) => line.tax)
      : allocate(number(tax), weights);

  const discountParts =
    discount === undefined || discount === null
      ? lines.map((line) => line.discount)
      : allocate(number(discount), weights);

  return lines.map((line, index) => ({
    ...line,
    tax: taxParts[index],
    discount: discountParts[index],
    total: line.subtotal + taxParts[index] - discountParts[index],
  }));
}

/**
 * What kind of tax the receipt carries.
 *
 * A receipt that puts the tax on the total, and writes it once, has a
 * bill tax: the tax belongs to the whole receipt and has to be
 * spread over the lines. A receipt that writes the tax against each
 * line has a line tax: each line already knows what it paid, and
 * nothing has to be spread.
 *
 * When the receipt says nothing about the tax at all, it is a bill
 * tax of zero, which is the same thing: there is nothing to spread.
 */
export function readTaxKind(lines) {
  const list = (lines || []).map(normalize);
  const declared = list.reduce((sum, line) => sum + line.tax, 0);
  return declared > 0 ? 'line' : 'bill';
}

/**
 * The share of every person, keyed by the member.
 */
function totalsOf(shares) {
  const totals = {};
  for (const share of shares) totals[share.memberId] = share.total;
  return totals;
}

/**
 * What everybody owes.
 *
 * `items` are the lines of the receipt, `members` are the people at
 * the table, and `assignments` say which person each line belongs
 * to. `mode` is either 'equal', where everybody pays the same, or
 * 'dynamic', where the lines decide.
 *
 * `tax` and `discount` are the tax and the discount of the whole
 * receipt. When they are not given, the tax and the discount declared
 * on the lines are added up and used instead. Either way the tax and
 * the discount are spread over the lines in proportion to what each
 * line costs, and the shares of the people add up to the total
 * exactly: no rupiah is lost, and none is invented.
 */
export function computeShares({
  items = [],
  members = [],
  assignments = {},
  mode = 'dynamic',
  tax,
  discount,
} = {}) {
  const plain = (items || []).map(normalize);
  const people = (members || []).map((member) => ({
    id: member ? member.id : null,
    name: memberName(member),
  }));

  // The tax and the discount of the whole receipt.
  //
  // When the receipt says what they are, they are the pool, and the
  // pool is spread over the lines in proportion to what each line
  // costs. When the receipt does not say, the lines carry their own
  // tax and their own discount, and each line keeps them: there is
  // nothing to spread.
  //
  // The two are told apart here and not further down, because this is
  // the only place that still knows whether the reader gave a tax for
  // the whole receipt or the receipt wrote a tax against each line.
  const hasBillTax = tax !== undefined && tax !== null;
  const hasBillDiscount = discount !== undefined && discount !== null;

  const billTax = hasBillTax ? Math.max(0, number(tax)) : 0;
  const billDiscount = hasBillDiscount ? Math.max(0, number(discount)) : 0;

  // The lines, each carrying its share of the tax and the discount.
  const lines = withBillExtras(
    plain,
    hasBillTax ? billTax : undefined,
    hasBillDiscount ? billDiscount : undefined,
  );
  const bill = {
    subtotal: lines.reduce((sum, line) => sum + line.subtotal, 0),
    tax: lines.reduce((sum, line) => sum + line.tax, 0),
    discount: lines.reduce((sum, line) => sum + line.discount, 0),
    total: lines.reduce((sum, line) => sum + line.total, 0),
  };

  // --- everybody pays the same -----------------------------------------
  if (mode === 'equal') {
    const parts = equalSplitTotal(bill.total, people.length);
    const taxParts = allocate(bill.tax, new Array(people.length).fill(1));
    const discountParts = allocate(
      bill.discount,
      new Array(people.length).fill(1),
    );

    const shares = people.map((person, index) => ({
      memberId: person.id,
      memberName: person.name,
      subtotal: parts[index] - taxParts[index] + discountParts[index],
      discount: discountParts[index],
      tax: taxParts[index],
      total: parts[index],
    }));

    return {
      mode: 'equal',
      bill,
      total: bill.total,
      shares,
      totalsByMember: totalsOf(shares),
      unassigned: { count: 0, total: 0 },
    };
  }

  // --- the lines decide who pays what ---------------------------------
  const isOwned = (line) => {
    const owner = ownerOf(assignments, line.id);
    return owner !== undefined && owner !== null && owner !== '';
  };

  const owned = lines.filter(isOwned);
  const unassignedLines = lines.filter((line) => !isOwned(line));

  const shares = people.map((person) => {
    const mine = owned.filter(
      (line) => String(ownerOf(assignments, line.id)) === String(person.id),
    );
    const subtotal = mine.reduce((sum, line) => sum + line.subtotal, 0);
    const taxPart = mine.reduce((sum, line) => sum + line.tax, 0);
    const discountPart = mine.reduce((sum, line) => sum + line.discount, 0);
    return {
      memberId: person.id,
      memberName: person.name,
      subtotal,
      discount: discountPart,
      tax: taxPart,
      total: subtotal + taxPart - discountPart,
    };
  });

  return {
    mode: 'dynamic',
    bill,
    total: shares.reduce((sum, share) => sum + share.total, 0),
    shares,
    totalsByMember: totalsOf(shares),
    unassigned: {
      count: unassignedLines.length,
      total: unassignedLines.reduce((sum, line) => sum + line.total, 0),
    },
  };
}

export default {
  equalSplitTotal,
  withBillExtras,
  computeShares,
};
