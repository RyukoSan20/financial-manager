/**
 * How the bill is to be divided.
 *
 * The five ways a bill can be shared, and what each one means for
 * the person reading the screen.
 *
 * The one that needs explaining is the itemised one: it is not a
 * sixth way of dividing a bill, it is the way a bill is divided when
 * everybody claims what they ate. The tax and the service charge
 * follow the food around, because that is what they were charged
 * on.
 *
 * The rounding is settled the same way in every mode: the parts
 * always add up to the whole, to the last rupiah.
 */

import { useMemo } from 'react';
import { batch9 } from '../../i18n/keys_batch9';

/**
 * The bill divided equally.
 *
 * The leftover is not lost: it goes to the people whose share of the
 * fraction was the largest, and then to the first name, so that the
 * same bill always splits the same way.
 */
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

export default function SplitMethodSelector({
  mode = 'ITEMIZED',
  onChange = null,
  members = [],
  total = 0,
  language = 'id',
  disabled = false,
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const modes = useMemo(
    () => [
      { key: 'ITEMIZED', label: K.method_itemized },
      { key: 'EQUAL', label: K.method_equal },
      { key: 'EXACT', label: K.method_exact },
      { key: 'PERCENTAGE', label: K.method_percentage },
      { key: 'WEIGHT', label: K.method_weight },
    ],
    [K],
  );

  const preview = useMemo(() => {
    if (mode !== 'EQUAL' || members.length === 0) return null;
    const shares = equalShares(total, members.length);
    return shares.map((value, index) => ({
      name: members[index]?.display_name || '',
      amount: value,
    }));
  }, [mode, members, total]);

  return (
    <div className="split-method">
      <h4>{K.split_method}</h4>
      <div className="split-method__choices" role="radiogroup">
        {modes.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={mode === option.key}
            className={
              mode === option.key
                ? 'split-method__choice split-method__choice--chosen'
                : 'split-method__choice'
            }
            disabled={disabled}
            onClick={() => onChange && onChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preview && (
        <ul className="split-method__preview">
          {preview.map((row, index) => (
            <li key={`${row.name}-${index}`}>
              <span>{row.name}</span>
              <span>{row.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
