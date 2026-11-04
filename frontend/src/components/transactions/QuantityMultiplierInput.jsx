/**
 * How many, and at what price each.
 *
 * The reader who buys two packets of Indomie at three thousand five
 * hundred each should not have to work out the total in their head,
 * and should not have to write the total and lose the count.
 *
 * This is the row where they write both: the count on the left, the
 * price of one on the right, and the total underneath, changing as
 * they type. The total is never something they have to trust without
 * seeing it.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';

/**
 * The words for this row, in the reader's own language.
 */
const WORDS = {
  id: {
    quantity: 'Jumlah',
    unitPrice: 'Harga satuan',
    total: 'Total',
    remove: 'Hapus rincian',
    add: 'Tambah rincian',
    unit: 'buah',
    rows: 'Rincian',
  },
  en: {
    quantity: 'Quantity',
    unitPrice: 'Price each',
    total: 'Total',
    remove: 'Remove the breakdown',
    add: 'Add a breakdown',
    unit: 'pcs',
    rows: 'Breakdown',
  },
  ja: {
    quantity: '数量',
    unitPrice: '単価',
    total: '合計',
    remove: '内訳を削除',
    add: '内訳を追加',
    unit: '個',
    rows: '内訳',
  },
};

/**
 * A row of the breakdown.
 *
 * @param {object} props
 * @param {string} props.name        What was bought
 * @param {number} props.quantity    How many
 * @param {number} props.unitPrice   The price of one
 * @param {Function} props.onChange  Called with the whole row
 * @param {Function} props.onRemove  Called when the row is taken away
 */
function BreakdownRow({ name, quantity, unitPrice, onChange, onRemove }) {
  const { language } = useTranslation();
  const K = WORDS[language] || WORDS.id;

  const total = useMemo(() => {
    const count = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isFinite(count) || !Number.isFinite(price)) return 0;
    if (count <= 0 || price <= 0) return 0;
    return Math.round(count * price);
  }, [quantity, unitPrice]);

  const rupiah = useMemo(
    () => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }),
    [],
  );

  return (
    <div className="qm-row" data-testid="qm-row">
      <div className="qm-row-fields">
        <label className="qm-field">
          <span className="qm-label">{K.quantity}</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={quantity ?? ''}
            onChange={(e) => onChange({ quantity: e.target.value })}
            aria-label={K.quantity}
          />
        </label>

        <span className="qm-times" aria-hidden="true">×</span>

        <label className="qm-field">
          <span className="qm-label">{K.unitPrice}</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={unitPrice ?? ''}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
            aria-label={K.unitPrice}
          />
        </label>

        <button
          type="button"
          className="qm-remove"
          onClick={onRemove}
          aria-label={K.remove}
          title={K.remove}
        >
          ×
        </button>
      </div>

      <p className="qm-total">
        <span className="qm-total-label">{K.total}</span>
        <strong>{rupiah.format(total)}</strong>
      </p>
    </div>
  );
}

/**
 * The breakdown, and the total of it.
 *
 * @param {object} props
 * @param {Array} props.rows        The rows of the breakdown
 * @param {Function} props.onChange Called with the whole list of rows
 * @param {string} props.currency   The currency the total is shown in
 */
export default function QuantityMultiplierInput({ rows = [], onChange, currency = 'IDR' }) {
  const { language } = useTranslation();
  const K = WORDS[language] || WORDS.id;
  const [draft, setDraft] = useState(rows);

  // The rows the reader typed are the rows that are shown. When the
  // parent hands down a different set, the rows follow it.
  useEffect(() => {
    setDraft(rows);
  }, [rows]);

  const total = useMemo(() => {
    return draft.reduce((sum, row) => {
      const count = Number(row.quantity);
      const price = Number(row.unitPrice);
      if (!Number.isFinite(count) || !Number.isFinite(price)) return sum;
      if (count <= 0 || price <= 0) return sum;
      return sum + Math.round(count * price);
    }, 0);
  }, [draft]);

  const formatter = useMemo(() => {
    const code = currency === 'IDR' ? 'id-ID' : 'en-US';
    return new Intl.NumberFormat(code, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
  }, [currency]);

  const update = (index, patch) => {
    const next = draft.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setDraft(next);
    onChange?.(next);
  };

  const remove = (index) => {
    const next = draft.filter((_, i) => i !== index);
    setDraft(next);
    onChange?.(next);
  };

  const add = () => {
    const next = [...draft, { name: '', quantity: 1, unitPrice: '' }];
    setDraft(next);
    onChange?.(next);
  };

  return (
    <div className="qm" data-testid="quantity-multiplier">
      {draft.length > 0 && (
        <p className="qm-heading">{K.rows}</p>
      )}

      {draft.map((row, index) => (
        <BreakdownRow
          key={index}
          name={row.name}
          quantity={row.quantity}
          unitPrice={row.unitPrice}
          onChange={(patch) => update(index, patch)}
          onRemove={() => remove(index)}
        />
      ))}

      <div className="qm-actions">
        <button type="button" className="qm-add" onClick={add}>
          {K.add}
        </button>
        {draft.length > 0 && (
          <p className="qm-grand">
            <span className="qm-total-label">{K.total}</span>
            <strong>{formatter.format(total)}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

export { QuantityMultiplierInput };
