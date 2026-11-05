/**
 * The receipt that was read, and the reader's chance to say otherwise.
 *
 * A receipt that was read from paper is a guess. A sentence that was
 * spoken aloud is a guess too. Either way, the reader knows better
 * than the machine what was on it: how many of what, at what price,
 * which of it was food and which was a drink, what was discounted,
 * what was taxed, and who is paying for which of it.
 *
 * So when a receipt is scanned or a transaction is spoken, the reading
 * is not saved straight away. It is brought here first, with the lines
 * laid out, the discount and the tax beside them, and the sharing
 * below. The reader changes what is wrong, and then it is saved.
 *
 * Nothing is written until the reader presses save. A reading is a
 * reading.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, ReceiptText, Users } from 'lucide-react';

import api from '../../services/api';
import { createGroup, addMember, createExpense, assignItems } from '../../services/splitApi';
import { useTranslation } from '../../i18n';
import ItemizedBillEditor from './ItemizedBillEditor';

let nextId = 1;

export default function ReceiptReviewModal({
  isOpen,
  reading,
  categories = [],
  accounts = [],
  existingTransactions = [],
  splitGroups = [],
  onClose,
  onSaved,
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState([]);
  const [bill, setBill] = useState(null);
  const [split, setSplit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The reading is turned into rows of the table. A line that the
  // reader never looked at still comes through, because the reader
  // may well agree with it.
  useEffect(() => {
    if (!isOpen || !reading) return;
    const items = Array.isArray(reading.items) ? reading.items : [];
    setLines(
      items.map((item) => ({
        id: `review-${nextId++}`,
        name: item.name || item.raw_name || '',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unit_price ?? item.price_per_unit ?? 0) || '',
        categoryId:
          item.category_id ??
          categories.find((c) => c.name === item.category)?.id ??
          null,
        owner: null,
      }))
    );
    setError(null);
  }, [isOpen, reading, categories]);

  const accountId = reading?.account_id ?? accounts[0]?.id ?? null;


  /**
   * The shared bill, written down as a split bill.
   *
   * A group is made for the bill, the people are put in it, and the
   * receipt is added to it with the lines it has. The people who were
   * given lines are the payers of those lines, so what each of them
   * owes is worked out by the server from the same lines the reader
   * saw.
   */
  const makeSplitBill = async (transactionId, label) => {
    if (!split?.shares?.length) return;

    const group = await createGroup({
      name: label?.trim() || t('bill.splitDefaultGroupName'),
      currency: 'IDR',
      allow_guest_claims: true,
    });

    const members = [];
    for (const share of split.shares) {
      const member = await addMember(group.id, { display_name: share.name });
      members.push({ name: share.name, id: member.id });
    }

    const named = lines.filter((row) => row.name?.trim());
    const items = named.map((row) => ({
      name: String(row.name).trim(),
      quantity: Number(row.quantity) || 1,
      unit_price: Number(row.unitPrice) || 0,
      total_price: (Number(row.quantity) || 1) * (Number(row.unitPrice) || 0),
      kind: 'item',
      category: null,
    }));

    const host = members[0];
    const made = await createExpense(group.id, {
      name: label?.trim() || t('bill.splitDefaultGroupName'),
      receipt_scan_id: null,
      items,
      payers: host ? [{ member_id: host.id, amount: bill?.total || 0 }] : [],
      subtotal: bill?.subtotal || 0,
      tax: bill?.taxAmount || 0,
      service_charge: bill?.fee || 0,
      discount: bill?.discount || 0,
      grand_total: bill?.total || 0,
      split_mode: named.some((row) => row.owner) ? 'ITEMIZED' : 'EQUAL',
    });

    // Who had which line.
    const expenseId = made?.id;
    if (expenseId) {
      const assignments = {};
      const madeLines = made.items || [];
      named.forEach((row, index) => {
        const line = madeLines[index];
        const member = members.find((m) => m.name === row.owner);
        if (line?.id && member?.id) assignments[line.id] = member.id;
      });
      if (Object.keys(assignments).length > 0) {
        await assignItems(group.id, expenseId, assignments);
      }
    }
    return group.id;
  };

  const save = async () => {
    const amount = bill?.total ?? Number(reading?.amount) ?? 0;
    if (!amount || amount <= 0) {
      setError(t('bill.invalidTotal'));
      return;
    }
    if (!accountId) {
      setError(t('bill.noAccount'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // When the reader is sharing a transaction that is already
      // written down, the transaction is not made again. Only the
      // bill is made, and it points at the transaction that is
      // already there.
      if (reading?.transaction_id) {
        await api.put(`/receipt-items/${reading.transaction_id}`, {
          items: lines
            .filter((row) => row.name?.trim())
            .map((row) => ({
              name: String(row.name).trim(),
              quantity: Number(row.quantity) || 1,
              unit_price: Number(row.unitPrice) || 0,
              total_price:
                (Number(row.quantity) || 1) * (Number(row.unitPrice) || 0),
              category_id: row.categoryId ?? null,
            })),
          discount_total: bill?.discount || 0,
          tax_total: bill?.taxAmount || 0,
        });
        onSaved?.({ id: reading.transaction_id, split: true });
        onClose?.();
        return;
      }

      const created = await api.transactions.create({
        amount,
        type: reading.type || 'expense',
        description: reading.description || '',
        date: reading.date || new Date().toISOString().slice(0, 10),
        account_id: accountId,
        category_id: reading.category_id ?? null,
        merchant_name: reading.merchant_name || null,
        raw_source_text: reading.raw_source_text || null,
        confidence_score: reading.confidence_score ?? null,
        detection_type: reading.detection_type || 'receipt_ocr',
      });

      // The lines are written down after the transaction, because a
      // line belongs to a transaction and the transaction has to be
      // there first.
      const txId = created?.id;
      const named = lines.filter((row) => row.name?.trim());
      if (txId && named.length > 0) {
        await api.put(`/receipt-items/${txId}`, {
          items: named.map((row) => ({
            name: String(row.name).trim(),
            quantity: Number(row.quantity) || 1,
            unit_price: Number(row.unitPrice) || 0,
            total_price:
              (Number(row.quantity) || 1) * (Number(row.unitPrice) || 0),
            category_id: row.categoryId ?? null,
          })),
          discount_total: bill?.discount || 0,
          tax_total: bill?.taxAmount || 0,
        });
      }

      // When the bill is shared, the split bill is made at the same
      // time, so that what each person owes is on record the moment
      // the transaction is saved.
      if (split && split.shares.length > 1) {
        try {
          await makeSplitBill(created?.id, reading?.description);
        } catch (e) {
          console.error('Could not create the split bill:', e);
        }
      }

      onSaved?.(created);
      onClose?.();
    } catch (e) {
      setError(e.message || t('bill.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const title = useMemo(
    () => reading?.detection_type === 'VOICE' ? t('bill.reviewVoice') : t('bill.reviewReceipt'),
    [reading, t]
  );

  if (!isOpen || !reading) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-gray-50 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg hover:bg-gray-100 pressable"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{t('bill.reviewIntro')}</p>

          <ItemizedBillEditor
            lines={lines}
            onLinesChange={setLines}
            categories={categories}
            accounts={accounts}
            existingTransactions={existingTransactions}
            splitGroups={splitGroups}
            onBillChange={setBill}
            onSplitChange={setSplit}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 sticky bottom-0 bg-gray-50 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border rounded-xl text-sm font-medium text-gray-700 pressable"
            >
              {t('bill.cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 pressable"
            >
              {saving ? t('bill.saving') : t('bill.saveTransaction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
