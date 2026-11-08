/**
 * The edit form.
 *
 * The edit form on the transactions list was five fields: what it
 * was, how much, which day, which category, which account. A
 * transaction that was recorded with all of that - the place, the
 * lines of the bill, the discount, the tax, the person it was
 * shared with - could not be corrected with any of it. The reader
 * opened the row and found a form that had forgotten most of what
 * the transaction was.
 *
 * So the edit form carries what the add form carries. The fields
 * that were there are still there, and beside them are the ones
 * that were missing: the sub-category, the place, the lines of the
 * bill, and the calculation.
 *
 * It is shown in place of the row, so the reader does not lose their
 * place in the list.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  ReceiptText,
  ChevronDown,
  ChevronUp,
  Store,
  Users,
} from 'lucide-react';

import { categoryName } from '../../utils/categoryName';
import { subCategoriesFor, subCategoryName } from '../../features/transactions/nlp/subCategories.js';
import { formatAmountInput, parseAmount } from '../../utils/amountInput';

/**
 * One field of the form.
 */
const Field = ({ label, children }) => (
  <label className="block min-w-0">
    <span className="block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
      {label}
    </span>
    {children}
  </label>
);

/**
 * A panel that can be put away.
 *
 * The calculation and the sharing are things most transactions do not
 * have. Opening them by default makes every row twice as tall as it
 * needs to be, so they are closed until the reader asks.
 */
const Panel = ({ icon: Icon, title, count, open, onToggle, children }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
    >
      <span className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{title}</span>
        {count ? (
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">({count})</span>
        ) : null}
      </span>
      {open ? (
        <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : (
        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
    </button>
    {open ? <div className="pt-2">{children}</div> : null}
  </div>
);

export default function TransactionEditForm({
  transaction,
  categories = [],
  accounts = [],
  language = 'id',
  saving = false,
  onChange,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({});
  const [showLines, setShowLines] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showSplit, setShowSplit] = useState(false);

  // The form starts as a copy of the transaction, so nothing the
  // reader did not change is lost.
  useEffect(() => {
    if (!transaction) return;
    setForm({
      description: transaction.description || '',
      amount: transaction.amount,
      currency: transaction.currency || 'IDR',
      type: transaction.type,
      date: transaction.date,
      category_id: transaction.category_id,
      account_id: transaction.account_id,
      // The place the reader gave, so it can be corrected.
      latitude: transaction.latitude ?? null,
      longitude: transaction.longitude ?? null,
      merchant_address: transaction.merchant_address || '',
      merchant_name: transaction.merchant_name || '',
      // The sub-category, when there is one.
      tags: transaction.tags || '',
      // The lines of the bill.
      breakdown: transaction.breakdown || transaction.items || [],
      // The calculation.
      discount: transaction.discount ?? '',
      discount_type: transaction.discount_type || 'fixed',
      tax: transaction.tax ?? '',
      tax_included: transaction.tax_included ?? false,
      fee: transaction.fee ?? '',
      // The people it was shared with.
      split_group_id: transaction.split_group_id ?? null,
      split_paid_by: transaction.split_paid_by ?? null,
    });
  }, [transaction]);

  const set = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    onChange(next);
  };

  // The sub-categories of the category that is chosen.
  const parent = useMemo(
    () => categories.find((c) => c.id === form.category_id),
    [categories, form.category_id]
  );
  const subs = useMemo(
    () => (parent?.system_key ? subCategoriesFor(parent.system_key) : []),
    [parent]
  );
  const currentSub = useMemo(() => {
    const tag = (form.tags || '').split(',').map((t) => t.trim()).filter(Boolean)[0];
    if (!tag || !parent?.system_key) return null;
    return subCategoryName(parent.system_key, tag);
  }, [form.tags, parent]);

  if (!transaction) return null;

  const input =
    'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100';

  // The amount, written the way the reader reads it.
  //
  // It used to be the raw number - "10000,00" - which is what the
  // database holds, not what money looks like. The reader is looking
  // at their own money, so it is shown as "Rp 10.000".
  const amountText = formatAmountInput(
    String(form.amount ?? ''),
    form.currency || 'IDR'
  );

  const onAmountChange = (text) => {
    const cleaned = text.replace(/[^\d.,-]/g, '');
    set('amount', parseAmount(cleaned, form.currency || 'IDR'));
  };

  return (
    <div className="space-y-3">
      <Field label="Deskripsi">
        <input
          type="text"
          value={form.description || ''}
          onChange={(e) => set('description', e.target.value)}
          className={input}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Jumlah">
          <input
            type="text"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => onAmountChange(e.target.value)}
            className={`${input} tabular-nums`}
          />
        </Field>
        <Field label="Tanggal">
          <input
            type="date"
            value={form.date || ''}
            onChange={(e) => set('date', e.target.value)}
            className={input}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="Kategori">
          <select
            value={form.category_id || ''}
            onChange={(e) => {
              set('category_id', parseInt(e.target.value) || null);
              // The sub-category belongs to the category, so a change
              // of category clears it.
              set('tags', '');
            }}
            className={input}
          >
            <option value="">—</option>
            {categories
              .filter((c) => {
                if (!c.type) return true;
                if (form.type === 'expense') return c.type !== 'income';
                if (form.type === 'income') return c.type !== 'expense';
                return true;
              })
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName(c, language)}
                </option>
              ))}
          </select>
        </Field>

        {/* The sub-category. It is only offered when the parent has
            some, and it says which one is chosen. */}
        {subs.length ? (
          <Field label="Sub-kategori">
            <select
              value={(form.tags || '').split(',')[0] || ''}
              onChange={(e) => set('tags', e.target.value)}
              className={input}
            >
              <option value="">—</option>
              {subs.map((sub) => (
                <option key={sub.key} value={sub.key}>
                  {sub.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Akun">
          <select
            value={form.account_id || ''}
            onChange={(e) => set('account_id', parseInt(e.target.value) || null)}
            className={input}
          >
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        {/* The place. */}
        <Field label="Lokasi">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={form.merchant_address || ''}
              onChange={(e) => set('merchant_address', e.target.value)}
              placeholder="Alamat toko"
              className={input}
            />
          </div>
        </Field>
      </div>

      {/* The lines of the bill. */}
      <Panel
        icon={ReceiptText}
        title="Rincian Barang"
        count={(form.breakdown || []).length}
        open={showLines}
        onToggle={() => setShowLines(!showLines)}
      >
        <div className="space-y-2 pl-2 border-l-2 border-gray-100 dark:border-white/10">
          {(form.breakdown || []).length ? (
            (form.breakdown || []).map((line, index) => (
              <div key={line.id || index} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-sm truncate text-gray-700 dark:text-gray-300">
                  {line.name}
                </span>
                <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                  {line.quantity || 1} × {line.unit_price ?? line.unitPrice ?? 0}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 py-1">
              Tidak ada rincian. Gunakan tombol rincian pada baris transaksi untuk menambahkannya.
            </p>
          )}
        </div>
      </Panel>

      {/* The calculation. */}
      <Panel
        icon={Store}
        title="Pajak & Diskon"
        open={showCalc}
        onToggle={() => setShowCalc(!showCalc)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-2 border-l-2 border-gray-100 dark:border-white/10">
          <Field label="Diskon">
            <input
              type="text"
              inputMode="decimal"
              value={form.discount ?? ''}
              onChange={(e) => set('discount', e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Pajak">
            <input
              type="text"
              inputMode="decimal"
              value={form.tax ?? ''}
              onChange={(e) => set('tax', e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Biaya Tambahan">
            <input
              type="text"
              inputMode="decimal"
              value={form.fee ?? ''}
              onChange={(e) => set('fee', e.target.value)}
              className={input}
            />
          </Field>
        </div>
      </Panel>

      {/* The sharing. */}
      <Panel
        icon={Users}
        title="Bagi Tagihan"
        open={showSplit}
        onToggle={() => setShowSplit(!showSplit)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 border-l-2 border-gray-100 dark:border-white/10">
          <Field label="ID Grup Split">
            <input
              type="text"
              value={form.split_group_id ?? ''}
              onChange={(e) => set('split_group_id', e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Dibayar Oleh">
            <input
              type="text"
              value={form.split_paid_by ?? ''}
              onChange={(e) => set('split_paid_by', e.target.value)}
              className={input}
            />
          </Field>
        </div>
      </Panel>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg text-sm"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
