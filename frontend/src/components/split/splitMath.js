/**
 * The arithmetic of a shared bill, and the reading of a receipt.
 *
 * These are the parts that have to be right and have to be testable
 * on their own, away from the screen they are drawn on. A bank
 * writes a transfer receipt in its own way, and the parts of a bill
 * have to add up to the whole bill.
 *
 * The screen reads these. The tests read these. There is one copy.
 */

export function readAmountFromProof(text) {
  if (!text) return null;

  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // The lines that say the amount, in the words a bank uses.
  const amountWords = [
    'total transfer',
    'nominal',
    'jumlah',
    'transfer amount',
    'amount',
    'total',
  ];

  for (const line of lines) {
    const lowered = line.toLowerCase();
    const saysAmount = amountWords.some((word) => lowered.includes(word));
    if (!saysAmount) continue;

    const numbers = line.match(/[\d][\d.,\s]*/g);
    if (!numbers) continue;

    // The last number on the line is the amount. The ones before it
    // are usually the account number and the reference.
    for (let index = numbers.length - 1; index >= 0; index -= 1) {
      const value = parseIndonesianAmount(numbers[index]);
      if (value !== null && value > 0) {
        return value;
      }
    }
  }

  // Nothing on a line that says what it is. The biggest number on
  // the receipt is the amount, most of the time.
  let biggest = null;
  for (const line of lines) {
    const numbers = line.match(/[\d][\d.,\s]*/g);
    if (!numbers) continue;
    for (const raw of numbers) {
      const value = parseIndonesianAmount(raw);
      if (value !== null && value > 0 && (biggest === null || value > biggest)) {
        biggest = value;
      }
    }
  }
  return biggest;
}

/**
 * A number written the way a bank writes it.
 *
 * Indonesian banks write `150.000,50`. Some write `150,000.50`.
 * Both are read here, and the one that is decided by which
 * separator comes last.
 */
export function parseIndonesianAmount(raw) {
  if (!raw) return null;
  const text = String(raw).replace(/\s+/g, '').replace(/[^\d.,]/g, '');
  if (!text) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  // How many digits are after the last separator. Three digits after
  // a separator is a thousands mark, not a decimal part: `150.000`
  // is a hundred and fifty thousand, and `150.50` is a hundred and
  // fifty and a half.
  const tail = (separator) => {
    if (separator < 0) return 0;
    return text.length - separator - 1;
  };

  let cleaned;
  if (lastComma > lastDot) {
    // Indonesian: the dot is the thousands mark and the comma is
    // the decimal mark.
    cleaned =
      tail(lastComma) === 3
        ? text.replace(/\./g, '').replace(/,/g, '')
        : text.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // English: the comma is the thousands mark and the dot is the
    // decimal mark.
    cleaned =
      tail(lastDot) === 3
        ? text.replace(/,/g, '').replace(/\./g, '')
        : text.replace(/,/g, '');
  } else {
    cleaned = text.replace(/[.,]/g, '');
  }

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * Whether the proof says what it should.
 *
 * `expected` is what was owed. `actual` is what the proof says was
 * paid. The two are the same when they are the same number, and
 * money is compared to the last rupiah.
 */
export function compareProof(actual, expected) {
  if (actual === null || actual === undefined) {
    return { matches: false, actual: null, expected, reason: 'unknown' };
  }
  const left = Math.round(Number(actual));
  const right = Math.round(Number(expected));
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return { matches: false, actual: null, expected, reason: 'unknown' };
  }
  return {
    matches: left === right,
    actual: left,
    expected: right,
    reason: left === right ? 'exact' : 'different',
  };
}

export function equalShares(total, memberCount, exponent = 0) {
  const count = Number(memberCount) || 0;
  if (count <= 0) return [];

  // The count is done in the smallest unit that exists, so that the
  // parts add up to the whole rather than to within a rounding
  // error.
  //
  // The smallest unit is not always a sen. Rupiah has no sen, so a
  // rupiah is divided into whole rupiahs and the leftover rupiah
  // goes to one of the people. Yen and dollars have two decimals.
  const factor = 10 ** Number(exponent || 0);
  const totalUnits = Math.round(Number(total) * factor);
  const base = Math.floor(totalUnits / count);
  let left = totalUnits - base * count;

  const shares = new Array(count).fill(base);
  // The names are not known here, so the extra units go to the first
  // people. The server settles the order properly.
  for (let index = 0; index < count && left > 0; index += 1) {
    shares[index] += 1;
    left -= 1;
  }

  return shares.map((units) => units / factor);
}

/**
 * The bill divided in proportion to what each person ate.
 *
 * The tax, the service charge and the discount are spread in the
 * same proportion, because they were charged on the food.
 */
export function proportionalShares(items, claims, totals) {
  // The people are the ones who claimed something, not the lines.
  // The claims are keyed by line, and each line names the people who
  // took part of it.
  const itemTotals = {};

  for (const item of items || []) {
    const quantity = Number(item.quantity || 0);
    const unit =
      quantity > 0 ? Number(item.total_price || 0) / quantity : Number(item.total_price || 0);
    // The line is looked up by text as well as by number, because
    // the claims arrive with the keys the server sent, and the
    // server sends text.
    const lineClaims =
      (claims || {})[item.id] || (claims || {})[String(item.id)] || {};
    for (const member of Object.keys(lineClaims)) {
      if (itemTotals[member] === undefined) itemTotals[member] = 0;
      itemTotals[member] += unit * Number(lineClaims[member] || 0);
    }
  }

  const members = Object.keys(itemTotals);
  if (members.length === 0) return {};

  const subtotal = Object.values(itemTotals).reduce((a, b) => a + b, 0);
  const tax = Number(totals?.tax ?? 0);
  const service = Number(totals?.service_charge ?? 0);
  const discount = Number(totals?.discount ?? 0);

  const result = {};
  for (const member of members) {
    const weight = subtotal > 0 ? itemTotals[member] / subtotal : 1 / members.length;
    result[member] =
      itemTotals[member] + weight * tax + weight * service - weight * discount;
  }
  return result;
}

export function inviteLink(origin, code) {
  if (!origin || !code) return '';
  const base = String(origin).replace(/\/$/, '');
  return `${base}/split/claim/${code}`;
}

/**
 * Is there a gap between the lines of the receipt and its subtotal?
 *
 * The gap is signed: a negative number means the lines are short of
 * the subtotal, which is what a missed line looks like. A gap of
 * zero, and no gap at all, both mean the receipt adds up.
 */
export function hasDiscrepancy(discrepancy) {
  if (discrepancy === null || discrepancy === undefined) return false;
  const value = Number(discrepancy);
  if (!Number.isFinite(value)) return false;
  return value !== 0;
}

/**
 * How big is the gap?
 *
 * The size is what the reader is shown, because a gap of minus ten
 * thousand and a gap of ten thousand are the same problem.
 */
export function discrepancySize(discrepancy) {
  if (!hasDiscrepancy(discrepancy)) return 0;
  return Math.abs(Number(discrepancy));
}

/**
 * Which lines are the ones that have to be looked at?
 *
 * When the lines are short of the subtotal, the line that was read
 * wrong is usually the one that looks wrong next to the others: the
 * price that does not fit its neighbours. The reader is shown those
 * lines rather than being left to find them.
 *
 * The test is deliberately simple: a line whose total is more than
 * the subtotal is definitely one of them, and a receipt where the
 * lines do not reach the subtotal is missing one somewhere, so the
 * last line is the one to check.
 */
export function linesToCheck(items, subtotal) {
  const lines = (items || []).filter((item) => (item.kind || 'item') === 'item');
  if (lines.length === 0) return [];

  const target = Number(subtotal || 0);
  if (target <= 0) return [];

  const total = lines.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0,
  );
  const difference = total - target;

  // The gap is worked out in the smallest unit, so that a receipt
  // that adds up is not reported as one that is a fraction short.
  const gap = Math.round(difference * 100) / 100;

  if (gap === 0) return [];

  if (gap > 0) {
    // A line is worth more than the whole subtotal. It cannot be
    // right.
    return lines
      .filter((item) => Number(item.total_price || 0) > target)
      .map((item) => item.id);
  }

  // The lines are short. The last line is the one most often read
  // wrong, because it is the one nearest the total on the paper.
  const last = lines[lines.length - 1];
  return last ? [last.id] : [];
}
