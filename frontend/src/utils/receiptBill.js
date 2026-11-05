/**
 * The arithmetic of a receipt.
 *
 * A receipt is a list of things that were bought, a discount that was
 * given, a tax that was charged, and a service charge on top. The
 * total the reader finally pays is not the sum of the lines: it is the
 * sum of the lines, less the discount, plus the tax, plus the charge.
 *
 * The tax here is Indonesian, and it is not one rule but several.
 * - "Tanpa Pajak" is no tax at all.
 * - "PB1 Resto" is the 10% restaurant tax on the gross price.
 * - "PPN PMK 131/2024" is the 12% value added tax on goods that are
 *   not luxury goods, but it is charged on the value of the goods
 *   *excluding* the tax itself. So the effective rate is 12% of 11/12,
 *   which is 11%. That is the "DPP nilai lain" rule in PMK 131/2024.
 * - "PPN 12%" is the plain rate, on the value including the tax.
 *
 * Whether the tax is already inside the price the reader typed
 * ("inclusive") or is added on top of it ("exclusive") changes the
 * base it is charged on. An inclusive tax is already inside the total,
 * so it is not added again; it is only shown so the reader can see how
 * much of their money went to the government.
 *
 * The discount is spread across the lines in proportion to what each
 * line is worth, so that the parts still add up to the whole. The
 * tax is spread the same way. The spread uses the largest remainder
 * method, so the parts always add up to exactly the whole: no
 * rupiah is invented and no rupiah is lost along the way.
 */

/**
 * The tax rules the reader can choose from.
 *
 * The rate is what the rule charges. The base tells the engine how
 * to work out what the tax is charged on.
 */
export const TAX_RULES = {
  none: {
    id: 'none',
    rate: 0,
    base: 'none',
    labelKey: 'tax.none',
  },
  pb1: {
    // PB1 Resto: ten percent of the gross price of the meal.
    id: 'pb1',
    rate: 10,
    base: 'gross',
    labelKey: 'tax.pb1',
  },
  ppn131: {
    // PPN PMK 131/2024, goods that are not luxury goods.
    // The tax is charged on 11/12 of the value, so the rate that
    // actually comes out of the reader's pocket is 11%.
    id: 'ppn131',
    rate: 12,
    base: 'non_luxury',
    labelKey: 'tax.ppn131',
  },
  ppn12: {
    // The plain twelve percent.
    id: 'ppn12',
    rate: 12,
    base: 'gross',
    labelKey: 'tax.ppn12',
  },
};

/**
 * The units a thing can be counted in.
 *
 * These are the ones a receipt actually uses in Indonesia.
 */
export const UNIT_OF_MEASURES = [
  { id: 'pcs', labelKey: 'uom.pcs' },
  { id: 'bungkus', labelKey: 'uom.bungkus' },
  { id: 'box', labelKey: 'uom.box' },
  { id: 'kg', labelKey: 'uom.kg' },
  { id: 'gram', labelKey: 'uom.gram' },
  { id: 'liter', labelKey: 'uom.liter' },
  { id: 'cup', labelKey: 'uom.cup' },
  { id: 'botol', labelKey: 'uom.botol' },
  { id: 'porsi', labelKey: 'uom.porsi' },
  { id: 'topi', labelKey: 'uom.topi' },
];

/**
 * Money, rounded to the rupiah.
 *
 * Rupiah have no cents. Every number that reaches the reader is a
 * whole rupiah, and the arithmetic is done in whole rupiah so that
 * what is shown is what is stored.
 */
export const roundRupiah = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number);
};

/**
 * A line of a receipt: what was bought, how many, and for how much.
 *
 * The subtotal is the line's own worth: the count times the price of
 * one. It is worked out here rather than in the component, so that
 * the number on the screen and the number that gets saved are the
 * same number.
 */
export const lineSubtotal = (line) => {
  const quantity = Number(line?.quantity);
  const unitPrice = Number(line?.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  return roundRupiah(quantity * unitPrice);
};

/**
 * The sum of the lines.
 */
export const sumLines = (lines = []) =>
  roundRupiah(lines.reduce((total, line) => total + lineSubtotal(line), 0));

/**
 * The discount, as a number of rupiah.
 *
 * The reader can give the discount in two ways: as a number of rupiah,
 * or as a percentage of the subtotal. Both come out of here as
 * rupiah, because that is what is taken off.
 */
export const discountAmount = (subtotal, discount, discountType = 'nominal') => {
  const value = Number(discount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (discountType === 'percent') {
    return roundRupiah((subtotal * value) / 100);
  }
  return roundRupiah(value);
};

/**
 * The base the tax is charged on, and the amount of the tax.
 *
 * The answer holds three numbers:
 * - `base` is the value the tax was charged on. This is the "DPP",
 *   the taxable base.
 * - `amount` is the tax itself.
 * - `effectiveRate` is what the tax really came to, as a percentage
 *   of what the reader paid. For the PMK 131 rule that is 11, not 12,
 *   because the tax is charged on the value without the tax.
 *
 * When the tax is inclusive, the tax is already inside the price the
 * reader typed, so it is not added on again. It is only worked out so
 * that it can be shown.
 */
export const computeTax = ({
  subtotal,
  discount = 0,
  taxRuleId = 'none',
  inclusive = false,
}) => {
  const rule = TAX_RULES[taxRuleId] || TAX_RULES.none;
  // What the lines are worth after the discount. This is what the
  // tax is charged on.
  const net = roundRupiah(subtotal - discount);

  if (!rule || rule.base === 'none' || rule.rate <= 0) {
    return { base: net, amount: 0, effectiveRate: 0, rule: rule.id };
  }

  if (rule.base === 'non_luxury') {
    // The value without the tax. PMK 131/2024: the taxable base is
    // eleven twelfths of the value, so the effective rate is eleven
    // percent, not twelve.
    const elevenTwelfths = 11 / 12;
    const base = roundRupiah(net * elevenTwelfths);
    const amount = roundRupiah((base * rule.rate) / 100);
    return {
      base,
      amount,
      effectiveRate: rule.rate * elevenTwelfths,
      rule: rule.id,
    };
  }

  if (rule.base === 'gross') {
    // The tax is charged on the whole value.
    if (inclusive) {
      // The tax is already inside the price. The tax that is inside
      // it is the part of the price that is the tax: for a twelve
      // percent tax on a gross price, the tax is 12/112 of it.
      const base = roundRupiah((net * 100) / (100 + rule.rate));
      const amount = roundRupiah(net - base);
      return { base, amount, effectiveRate: rule.rate, rule: rule.id };
    }
    const base = net;
    const amount = roundRupiah((base * rule.rate) / 100);
    return { base, amount, effectiveRate: rule.rate, rule: rule.id };
  }

  return { base: net, amount: 0, effectiveRate: 0, rule: rule.id };
};

/**
 * The total the reader pays.
 *
 * When the tax is exclusive it is added on top. When it is inclusive
 * it is already inside the net figure, so it is not added again, and
 * the total is simply the net plus the service charge.
 */
export const computeTotal = ({
  subtotal,
  discount = 0,
  taxAmount = 0,
  fee = 0,
  inclusive = false,
}) => {
  const net = roundRupiah(subtotal - discount);
  const taxPart = inclusive ? 0 : roundRupiah(taxAmount);
  return roundRupiah(net + taxPart + (Number(fee) || 0));
};

/**
 * Split a whole number of rupiah into shares that add back up to it.
 *
 * This is the largest remainder method. Each share gets its equal
 * part, rounded down. What is left over - always less than one unit
 * per share - is handed out one unit at a time to the shares with the
 * biggest remainder, so the shares add up to exactly the whole.
 *
 * Without this, three people sharing Rp 100.000 would get
 * 33.334 + 33.333 + 33.333 and one rupiah would be lost, or
 * 33.334 + 33.334 + 33.334 and one rupiah would be invented.
 */
export const largestRemainderSplit = (total, weights) => {
  const whole = roundRupiah(total);
  const list = weights.map((weight) => (Number(weight) > 0 ? Number(weight) : 0));
  const sum = list.reduce((a, b) => a + b, 0);

  if (sum <= 0) {
    // Nothing to weigh it by. Everyone owes the same, and the extra
    // rupiahs go to the first ones in order.
    const each = Math.floor(whole / Math.max(list.length, 1));
    const shares = list.map(() => each);
    let left = whole - each * list.length;
    for (let i = 0; left > 0 && i < shares.length; i += 1, left -= 1) {
      shares[i] += 1;
    }
    return shares;
  }

  const exact = list.map((weight) => (whole * weight) / sum);
  const floors = exact.map((value) => Math.floor(value));
  let left = whole - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const shares = floors.slice();
  for (const { index } of order) {
    if (left <= 0) break;
    shares[index] += 1;
    left -= 1;
  }
  return shares;
};

/**
 * The whole bill, worked out from the lines.
 *
 * The answer holds everything the reader needs to see: the subtotal,
 * the discount, the tax with its base and its effective rate, the
 * service charge, and the total.
 */
export const computeBill = ({
  lines = [],
  discount = 0,
  discountType = 'nominal',
  taxRuleId = 'none',
  inclusive = false,
  fee = 0,
}) => {
  const subtotal = sumLines(lines);
  const discountValue = discountAmount(subtotal, discount, discountType);
  const tax = computeTax({
    subtotal,
    discount: discountValue,
    taxRuleId,
    inclusive,
  });
  const feeValue = roundRupiah(fee);
  const total = computeTotal({
    subtotal,
    discount: discountValue,
    taxAmount: tax.amount,
    fee: feeValue,
    inclusive,
  });

  return {
    subtotal,
    discount: discountValue,
    discountInput: Number(discount) || 0,
    discountType,
    taxBase: tax.base,
    taxAmount: tax.amount,
    taxEffectiveRate: tax.effectiveRate,
    taxRuleId: tax.rule,
    inclusive,
    fee: feeValue,
    total,
  };
};

/**
 * Who owes what, when the bill is shared.
 *
 * Two ways of sharing:
 * - "equal" gives everyone the same share of the total.
 * - "byItem" gives each person the items that were assigned to them,
 *   and the discount and the tax follow those items in proportion to
 *   what they are worth.
 *
 * Both ways use the largest remainder method, so the shares always
 * add up to exactly the total. Not one rupiah is lost, and not one is
 * invented.
 */
export const computeSplit = ({
  bill,
  participants = [],
  mode = 'equal',
  assignments = {},
}) => {
  const total = roundRupiah(bill?.total || 0);
  const names = participants.filter(Boolean);
  if (names.length === 0) return { shares: [], hostShare: 0, owedToHost: 0 };

  if (mode === 'byItem') {
    // Each line carries a share of the discount and of the tax, in
    // proportion to what that line is worth.
    const lines = bill?.lines || [];
    const subtotal = lines.reduce((sum, line) => sum + lineSubtotal(line), 0);
    const perLine = lines.map((line) => {
      const value = lineSubtotal(line);
      // The share of the discount that falls on this line.
      const shareOfDiscount =
        subtotal > 0 ? roundRupiah((bill.discount * value) / subtotal) : 0;
      // The share of the tax that falls on this line.
      const shareOfTax =
        subtotal > 0 ? roundRupiah((bill.taxAmount * value) / subtotal) : 0;
      const owner = assignments[line.id];
      return {
        lineId: line.id,
        value,
        owner: owner || names[0],
        net: roundRupiah(value - shareOfDiscount),
        tax: shareOfTax,
        amount: roundRupiah(value - shareOfDiscount + shareOfTax),
      };
    });

    // What each person is worth, before the rounding is settled.
    const weights = names.map((name) =>
      perLine
        .filter((entry) => entry.owner === name)
        .reduce((sum, entry) => sum + entry.amount, 0)
    );

    const shares = largestRemainderSplit(total, weights);
    return {
      shares: names.map((name, index) => ({ name, amount: shares[index] })),
      hostShare: shares[0],
      owedToHost: shares.slice(1).reduce((a, b) => a + b, 0),
      perLine,
    };
  }

  const shares = largestRemainderSplit(total, names.map(() => 1));
  return {
    shares: names.map((name, index) => ({ name, amount: shares[index] })),
    hostShare: shares[0],
    owedToHost: shares.slice(1).reduce((a, b) => a + b, 0),
    perLine: [],
  };
};

/**
 * The price that was last paid for a thing.
 *
 * This is the memory: the reader types "Indomie" and the price comes
 * back, because they paid it last time.
 */
export const buildPriceMemory = (transactions = []) => {
  const memory = new Map();

  const remember = (name, amount, categoryId, unit) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const price = Number(amount);
    if (!Number.isFinite(price) || price <= 0) return;
    const key = clean.toLowerCase();
    const known = memory.get(key);
    if (!known) {
      memory.set(key, {
        name: clean,
        amount: price,
        categoryId: categoryId ?? null,
        unit: unit || 'pcs',
        count: 1,
      });
    } else {
      known.count += 1;
      // The price that was paid most often wins, because that is the
      // price that is really the price.
      known.amount = price;
      if (known.categoryId == null && categoryId != null) {
        known.categoryId = categoryId;
      }
    }
  };

  for (const tx of transactions) {
    // The lines of the receipt come first, because the price of the
    // Indomie is written on the line, not on the total of the shop.
    const items = Array.isArray(tx.items) ? tx.items : [];
    for (const item of items) {
      remember(
        item.name || item.raw_name,
        item.unit_price ?? item.price_per_unit,
        item.category_id ?? null,
        item.unit || item.uom
      );
    }

    remember(
      tx.description || tx.merchant_name,
      tx.amount,
      tx.category_id ?? null,
      null
    );
  }
  return memory;
};

/**
 * The suggestions for a name the reader has started to type.
 *
 * The names are the ones that have been paid for before, matched on
 * what has been typed so far.
 */
export const suggestFromMemory = (memory, query, limit = 5) => {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  const found = [];
  for (const entry of memory.values()) {
    if (entry.name.toLowerCase().startsWith(needle)) {
      found.push(entry);
    }
  }
  found.sort((a, b) => b.count - a.count);
  return found.slice(0, limit);
};
