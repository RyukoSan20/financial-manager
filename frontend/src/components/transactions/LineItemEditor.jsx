/**
 * The list of things, written down line by line.
 *
 * A receipt is more than one number. It is a list of what was bought,
 * a count of each, a price of one, and the sum. The reader needs to
 * see all of it at once, and needs to be able to correct any line
 * before the transaction is saved.
 *
 * This is the editor for that list, and it is used by all three ways of
 * adding a transaction by reading something: the text parser, the
 * voice input and the receipt scanner. They all produce the same
 * shape, so they all use the same editor, and the reader learns it
 * once.
 *
 * The sum at the bottom is always the sum of the lines. It is never
 * left over from the reading, because a total that disagrees with the
 * lines is a total the reader cannot trust.
 */

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { formatCurrency } from '../../utils/format';

/**
 * A blank line.
 */
export const blankLine = () => ({
  name: '',
  quantity: 1,
  unit_price: 0,
  subtotal: 0,
  variant_or_note: null,
  category: null,
});

/**
 * The lines, ready to be shown.
 *
 * The lines come in from three different readers, and each of them
 * calls the price of one something slightly different. All of them
 * are understood here.
 */
export const toLines = (items) =>
  (items || []).map((item) => ({
    name: item.name || '',
    quantity: Number(item.quantity ?? 1) || 1,
    unit_price: Number(item.unit_price ?? item.price_per_unit ?? 0) || 0,
    subtotal: Number(item.subtotal ?? item.total ?? item.total_price ?? 0) || 0,
    variant_or_note: item.variant_or_note || item.note || null,
    category: item.category || null,
  }));

/**
 * The lines, ready to be saved.
 *
 * A line with no name is not a line of the bill, so it is dropped.
 */
export const fromLines = (lines) =>
  (lines || [])
    .filter((line) => (line.name || '').trim())
    .map((line) => ({
      name: (line.name || '').trim(),
      quantity: Number(line.quantity ?? 1) || 1,
      unit_price: Number(line.unit_price ?? 0) || 0,
      total_price:
        Math.round(
          (Number(line.quantity ?? 1) || 1) * (Number(line.unit_price ?? 0) || 0) * 100
        ) / 100,
      category: line.category || undefined,
    }));

/**
 * The sum of the lines.
 */
export const linesTotal = (lines) =>
  (lines || []).reduce(
    (sum, line) =>
      sum + (Number(line.quantity ?? 1) || 1) * (Number(line.unit_price ?? 0) || 0),
    0
  );

export function LineItemEditor({
  lines = [],
  items,
  onChange,
  labels = {},
  disabled = false,
  max = 30,
  // The amount, for a reading that has no lines of its own.
  fallbackTotal = 0,
}) {
  const L = labels;

  // The lines are called "lines" here and "items" by the readers. Both
  // names are accepted so a caller can use whichever it has.
  const source = items !== undefined ? items : lines;
  const rows = useMemo(() => toLines(source), [source]);

  const setRow = (index, patch) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    if (rows.length >= max) return;
    onChange([...rows, blankLine()]);
  };

  const removeRow = (index) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  // The total of the lines.
  //
  // When there are no lines the total is zero, and showing zero as
  // "the total" is a lie: "gajian masuk 8.5jt ke bca" has no lines and
  // is still worth eight and a half million. So when the caller knows
  // the amount, that is shown instead.
  const lineTotal = linesTotal(rows);
  const total = rows.length ? lineTotal : Number(fallbackTotal) || lineTotal;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {L.title || 'Rincian Barang'}
        </label>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || rows.length >= max}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          {L.add || 'Tambah'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          {L.empty || 'Belum ada rincian barang.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 items-center rounded-lg border border-gray-200 dark:border-gray-700 p-2"
            >
              <div className="col-span-5">
                <input
                  type="text"
                  value={line.name || ''}
                  disabled={disabled}
                  onChange={(e) => setRow(index, { name: e.target.value })}
                  placeholder={L.name || 'Nama barang'}
                  aria-label={L.name || 'Nama barang'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={line.quantity ?? 1}
                  disabled={disabled}
                  onChange={(e) => setRow(index, { quantity: e.target.value })}
                  placeholder={L.qty || 'Qty'}
                  aria-label={L.qty || 'Jumlah'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={line.unit_price ?? 0}
                  disabled={disabled}
                  onChange={(e) => setRow(index, { unit_price: e.target.value })}
                  placeholder={L.price || 'Harga'}
                  aria-label={L.price || 'Harga satuan'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="col-span-2 text-right text-xs text-gray-600 dark:text-gray-400">
                {formatCurrency(
                  (Number(line.quantity ?? 1) || 1) * (Number(line.unit_price ?? 0) || 0)
                )}
              </div>
              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={disabled}
                  aria-label={L.remove || 'Hapus baris'}
                  className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm pt-1">
        <span className="text-gray-600 dark:text-gray-400">{L.total || 'Total'}</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export default LineItemEditor;
