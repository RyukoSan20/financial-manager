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
import { equalShares } from './splitMath';

/**
 * The bill divided equally.
 *
 * The leftover is not lost: it goes to the people whose share of the
 * fraction was the largest, and then to the first name, so that the
 * same bill always splits the same way.
 */
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
