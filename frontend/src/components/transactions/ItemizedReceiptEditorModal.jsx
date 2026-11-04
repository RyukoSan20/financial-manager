/**
 * Editing the receipt, line by line, in place.
 *
 * A receipt that was read from paper is a guess. The reader knows
 * better than the machine what was on it: how many of what, at what
 * price, and which of it was food and which was a drink. This is
 * where they say so.
 *
 * The three numbers are kept apart on purpose. The subtotal is the
 * sum of the lines and is not typed. The discount and the tax are
 * the ones written on the paper and are typed, because the reader
 * can see them there. The net is what comes out, and it is worked
 * out as the reader types so that they can see the receipt add up.
 *
 * A category can be different for every line, because that is the
 * whole point: AYAM PANGGANG is food and RED VELVET LATTE is a
 * drink, and one receipt is allowed to say so.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Sparkles, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';

import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';
import { batch9 } from '../../i18n/keys_batch9';
import {
  categorizeReceiptItems,
  readReceiptItems,
  writeReceiptItems,
} from '../../services/receiptItemsApi';
import { netTotal, subtotalOf } from '../../utils/receiptMath';

/**
 * A blank line.
 */
function blankLine() {
  return {
    id: null,
    name: '',
    quantity: 1,
    unit_price: 0,
    category_id: null,
    category: null,
    is_discount: false,
  };
}

export default function ItemizedReceiptEditorModal({
  isOpen,
  transactionId,
  transactionAmount,
  categories = [],
  onClose,
  onSaved,
}) {
  const { language } = useTranslation();
  const K = batch9[language]?.receiptEditor || batch9.id.receiptEditor;

  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    try {
      const receipt = await readReceiptItems(transactionId);
      const lines = (receipt?.items || []).map((line) => ({
        id: line.id ?? null,
        name: line.name || '',
        quantity: line.quantity ?? 1,
        unit_price: line.price_per_unit ?? line.unit_price ?? 0,
        category_id: line.category_id ?? null,
        category: line.category ?? null,
        is_discount: !!line.is_discount,
      }));
      setItems(lines);
      setDiscount(Number(receipt?.discount_total) || 0);
      setTax(Number(receipt?.tax_total) || 0);
    } catch (err) {
      setError(err?.message || K.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [transactionId, K.loadFailed]);

  useEffect(() => {
    if (isOpen) {
      load();
    } else {
      setItems([]);
      setDiscount(0);
      setTax(0);
      setError(null);
    }
  }, [isOpen, load]);

  /**
   * Change one line.
   *
   * The id is kept on the line so that the server knows which line
   * is which, and a line that has never been saved has no id.
   */
  const updateLine = (index, patch) => {
    setItems((current) =>
      current.map((line, idx) => (idx === index ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (index) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const addLine = () => {
    setItems((current) => [...current, blankLine()]);
  };

  /**
   * Let the catalog have a go at the lines.
   *
   * Every line keeps the category it had unless the catalog is sure,
   * so a refused guess costs nothing.
   */
  const autoCategorize = async () => {
    if (!transactionId) return;
    setCategorizing(true);
    setError(null);
    try {
      const result = await categorizeReceiptItems(transactionId);
      const guesses = result?.items || [];
      setItems((current) =>
        current.map((line, idx) => {
          const guess = guesses[idx];
          if (!guess) return line;
          return {
            ...line,
            category_id: guess.category_id ?? line.category_id,
            category: guess.category ?? line.category,
          };
        }),
      );
    } catch (err) {
      setError(err?.message || K.categorizeFailed);
    } finally {
      setCategorizing(false);
    }
  };

  const save = async () => {
    if (!transactionId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        items: items.map((line) => ({
          id: line.id ?? undefined,
          name: line.name || '',
          quantity: Number(line.quantity) || 0,
          unit_price: Number(line.unit_price) || 0,
          category_id: line.category_id ?? undefined,
          category: line.category ?? undefined,
          is_discount: !!line.is_discount,
        })),
        discount_total: Number(discount) || 0,
        tax_total: Number(tax) || 0,
      };
      const saved = await writeReceiptItems(transactionId, payload);
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.message || K.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const subtotal = useMemo(() => subtotalOf(items), [items]);
  const net = useMemo(() => netTotal(items, discount, tax), [items, discount, tax]);

  /**
   * How far the receipt is from the transaction it belongs to.
   *
   * A receipt that does not add up to what was paid is usually a
   * receipt the reader has not finished editing, and it is worth
   * saying so rather than letting the reader find out later.
   */
  const difference = useMemo(() => {
    if (!transactionAmount) return 0;
    return Math.round((net - Number(transactionAmount)) * 100) / 100;
  }, [net, transactionAmount]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={K.title}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* The head of the window. */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{K.title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{K.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label={K.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* The body of the window. */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* The lines. */}
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_5rem_7rem_9rem_2rem] gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 px-1">
                  <span>{K.item}</span>
                  <span>{K.quantity}</span>
                  <span>{K.unitPrice}</span>
                  <span>{K.category}</span>
                  <span />
                </div>

                {items.map((line, index) => (
                  <div
                    key={line.id ?? `new-${index}`}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_7rem_9rem_2rem] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => updateLine(index, { name: e.target.value })}
                      placeholder={K.itemPlaceholder}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                      aria-label={K.quantity}
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unit_price}
                      onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                      aria-label={K.unitPrice}
                    />
                    <select
                      value={line.category_id ?? ''}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        const found = categories.find((c) => c.id === id);
                        updateLine(index, { category_id: id, category: found?.name ?? null });
                      }}
                      className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                      aria-label={K.category}
                    >
                      <option value="">{K.noCategory}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 self-end sm:self-center"
                      aria-label={K.removeLine}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLine}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <Plus size={15} />
                {K.addLine}
              </button>

              {/* The three numbers. */}
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1">{K.discount}</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1">{K.tax}</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                    />
                  </label>
                </div>

                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 pt-1">
                  <span>{K.subtotal}</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100">
                  <span>{K.netTotal}</span>
                  <span>{formatCurrency(net)}</span>
                </div>

                {transactionAmount ? (
                  <p className={`text-xs ${difference === 0 ? 'text-gray-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {difference === 0
                      ? K.matchesTransaction
                      : K.differsFromTransaction.replace('%s', formatCurrency(Math.abs(difference)))}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* The foot of the window. */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={autoCategorize}
            disabled={categorizing || !items.length}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-50"
          >
            {categorizing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {K.autoCategorize}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {K.cancel}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin inline" /> : K.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
