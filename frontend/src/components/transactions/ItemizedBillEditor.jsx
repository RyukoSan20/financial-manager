/**
 * The receipt, written down line by line, with the tax and the
 * discount and the sharing.
 *
 * A receipt is more than one number. It is a list of things that were
 * bought, a discount that was given, a tax that was charged, a
 * service charge on top, and sometimes a bill that several people are
 * paying together. The reader needs to see all of it at once, and
 * needs the total to be right while they are still typing.
 *
 * The item table is the heart of it. Every row is a thing: its name,
 * how many of it, in what unit, for what price of one, and which
 * category it belongs to. A different category per row is allowed,
 * because one receipt can hold food and a drink, and the reader knows
 * which is which.
 *
 * The name of a thing brings its price back. If the reader has paid
 * for "Indomie Goreng" before, the price they paid comes with the
 * name, so they do not have to remember it or look it up.
 *
 * Below the table sits the calculation: the subtotal, the discount,
 * the tax with its base and its real rate, the service charge, and
 * the total. The discount and the tax are spread across the lines in
 * proportion to what each line is worth, and the spread uses the
 * largest remainder method, so the parts always add up to exactly
 * the whole.
 *
 * And below that sits the sharing. When the bill is shared, the
 * discount and the tax follow the items to the people they were
 * assigned to, and the shares add up to the total exactly.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Users, ChevronDown, Wand2 } from 'lucide-react';

import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';
import {
  TAX_RULES,
  UNIT_OF_MEASURES,
  computeBill,
  computeSplit,
  lineSubtotal,
  buildPriceMemory,
  suggestFromMemory,
} from '../../utils/receiptBill';

let nextLineId = 1;

/**
 * A blank line.
 */
const blankLine = (categoryId = null) => ({
  id: `line-${nextLineId++}`,
  name: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: '',
  categoryId,
  owner: null,
});

export default function ItemizedBillEditor({
  lines,
  onLinesChange,
  categories = [],
  accounts = [],
  existingTransactions = [],
  splitGroups = [],
  onTotalChange,
  onSplitChange,
  onBillChange,
  value = 'expense',
}) {
  const { t } = useTranslation();

  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('nominal');
  const [taxRuleId, setTaxRuleId] = useState('none');
  const [inclusive, setInclusive] = useState(false);
  const [fee, setFee] = useState('');
  const [splitOn, setSplitOn] = useState(false);
  const [splitMode, setSplitMode] = useState('equal');
  const [participants, setParticipants] = useState([]);
  const [newPerson, setNewPerson] = useState('');
  const [openPanel, setOpenPanel] = useState('items');

  // The prices that were paid before, so a name can bring its price
  // back with it.
  const priceMemory = useMemo(
    () => buildPriceMemory(existingTransactions),
    [existingTransactions]
  );

  // The rows of the receipt. Held in a memo so that the callbacks
  // below do not change their mind on every render.
  const rowList = useMemo(() => lines || [], [lines]);

  const setRow = useCallback(
    (id, patch) => {
      onLinesChange(rowList.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    },
    [rowList, onLinesChange]
  );

  const removeRow = useCallback(
    (id) => {
      onLinesChange(rowList.filter((row) => row.id !== id));
    },
    [rowList, onLinesChange]
  );

  const addRow = useCallback(() => {
    onLinesChange([...rowList, blankLine()]);
  }, [rowList, onLinesChange]);

  // The name of a thing brings the price with it. The price that is
  // put in is the price that was paid last, which is the one the
  // reader is most likely to pay again.
  const applyKnownPrice = useCallback(
    (id, name) => {
      const row = rowList.find((r) => r.id === id);
      if (!row) return;
      const found = priceMemory.get(String(name).trim().toLowerCase());
      if (!found) return;
      setRow(id, {
        unitPrice: found.amount,
        categoryId: row.categoryId ?? found.categoryId,
      });
    },
    [rowList, priceMemory, setRow]
  );

  const suggestionsFor = useCallback(
    (name) => suggestFromMemory(priceMemory, name),
    [priceMemory]
  );

  const bill = useMemo(() => {
    const computed = computeBill({
      lines: rowList,
      discount,
      discountType,
      taxRuleId,
      inclusive,
      fee,
    });
    return { ...computed, lines: rowList };
  }, [rowList, discount, discountType, taxRuleId, inclusive, fee]);

  const split = useMemo(() => {
    if (!splitOn) return null;
    return computeSplit({
      bill,
      participants,
      mode: splitMode,
      assignments: rowList.reduce((acc, row) => {
        if (row.owner) acc[row.id] = row.owner;
        return acc;
      }, {}),
    });
  }, [splitOn, bill, participants, splitMode, rowList]);

  // The total is told to the page, so the amount field and the table
  // never disagree.
  useEffect(() => {
    if (onTotalChange) onTotalChange(bill.total);
  }, [bill.total, onTotalChange]);

  // The whole bill is told to the page, so that what is saved carries
  // the discount and the tax with it, and not only the total.
  //
  // The lines go with it, because the lines are the receipt. A bill
  // that carries only the total is a bill that loses the thing.
  useEffect(() => {
    if (onBillChange) onBillChange({ ...bill, lines: rowList });
  }, [bill, rowList, onBillChange]);

  useEffect(() => {
    if (onSplitChange) onSplitChange(split);
  }, [split, onSplitChange]);

  // The whole bill is told to the page as well, not only the total:
  // the lines, the discount, the tax and the fee are what has to be
  // saved, and the page has nowhere else to get them from.
  const billReport = useMemo(
    () => ({
      lines: rowList,
      discount,
      discountType,
      taxRuleId,
      inclusive,
      fee,
      total: bill.total,
      split,
    }),
    [rowList, discount, discountType, taxRuleId, inclusive, fee, bill.total, split]
  );

  useEffect(() => {
    if (onBillChange) onBillChange(billReport);
  }, [billReport, onBillChange]);

  const addPerson = useCallback(() => {
    const name = newPerson.trim();
    if (!name) return;
    if (!participants.includes(name)) {
      setParticipants([...participants, name]);
    }
    setNewPerson('');
  }, [newPerson, participants]);

  const removePerson = useCallback(
    (name) => {
      setParticipants(participants.filter((p) => p !== name));
      // The rows that were given to that person are given back to the
      // host, so no row is left pointing at nobody.
      onLinesChange(
        rowList.map((row) => (row.owner === name ? { ...row, owner: null } : row))
      );
    },
    [participants, rowList, onLinesChange]
  );

  const assignLine = useCallback(
    (id, owner) => {
      setRow(id, { owner: owner || null });
    },
    [setRow]
  );


  return (
    <div className="space-y-4" data-testid="itemized-bill-editor">
      {/* ---- the items ---------------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === 'items' ? '' : 'items')}
            className="flex items-center gap-2 text-sm font-semibold text-gray-800 pressable"
            aria-expanded={openPanel === 'items'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${openPanel === 'items' ? '' : '-rotate-90'}`}
            />
            <span>📦 {t('bill.items')}</span>
          </button>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium pressable"
          >
            <Plus className="w-4 h-4" />
            {t('bill.addItem')}
          </button>
        </div>

        {openPanel === 'items' && (
          <div className="space-y-3">
            {rowList.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">{t('bill.noItems')}</p>
            ) : (
              rowList.map((row) => {
                const sub = lineSubtotal(row);
                const known = priceMemory.get(String(row.name || '').trim().toLowerCase());
                const suggestions = suggestionsFor(row.name);
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2"
                    data-testid="bill-line"
                  >
                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* name */}
                      <div className="col-span-12 md:col-span-4 relative">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('bill.itemName')}
                        </label>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => setRow(row.id, { name: e.target.value })}
                          onBlur={(e) => applyKnownPrice(row.id, e.target.value)}
                          placeholder={t('bill.itemNameExample')}
                          className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                        />
                        {suggestions.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                            {suggestions.map((s) => (
                              <button
                                type="button"
                                key={s.name}
                                onClick={() => {
                                  setRow(row.id, { name: s.name, unitPrice: s.amount });
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between"
                              >
                                <span>{s.name}</span>
                                <span className="text-gray-500">
                                  {formatCurrency(s.amount)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* quantity */}
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('bill.quantity')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.quantity}
                          onChange={(e) =>
                            setRow(row.id, { quantity: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                        />
                      </div>

                      {/* unit */}
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('bill.unit')}
                        </label>
                        <select
                          value={row.unit}
                          onChange={(e) => setRow(row.id, { unit: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                        >
                          {UNIT_OF_MEASURES.map((u) => (
                            <option key={u.id} value={u.id}>
                              {t(`bill.${u.labelKey}`)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* unit price */}
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('bill.unitPrice')}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.unitPrice}
                          onChange={(e) =>
                            setRow(row.id, { unitPrice: e.target.value })
                          }
                          placeholder={t('bill.zero')}
                          className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                        />
                        {known && (
                          <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                            <Wand2 className="w-3 h-3" />
                            {t('bill.knownPrice')}: {formatCurrency(known.amount)}
                          </p>
                        )}
                      </div>

                      {/* category */}
                      <div className="col-span-6 md:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('bill.itemCategory')}
                        </label>
                        <select
                          value={row.categoryId ?? ''}
                          onChange={(e) =>
                            setRow(row.id, {
                              categoryId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
                        >
                          <option value="">—</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon ? `${cat.icon} ` : ''}
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* remove */}
                      <div className="col-span-2 md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          aria-label={t('bill.removeItem')}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg pressable"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* the subtotal of this line, and who is paying for it */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-gray-600">
                        {t('bill.subtotal')}:{' '}
                        <strong className="text-gray-900">
                          {formatCurrency(sub)}
                        </strong>
                      </span>
                      {splitOn && participants.length > 0 && (
                        <span className="flex items-center gap-1 flex-wrap">
                          <span className="text-gray-500">{t('bill.owed')}:</span>
                          {participants.map((person) => (
                            <button
                              type="button"
                              key={person}
                              onClick={() =>
                                assignLine(row.id, row.owner === person ? null : person)
                              }
                              className={`px-2 py-0.5 rounded-full border pressable ${
                                row.owner === person
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'bg-white text-gray-600 border-gray-200'
                              }`}
                            >
                              {person === 'Saya' ? t('bill.me') : person}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ---- the calculation ----------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-800">🧮 {t('bill.calcTitle')}</p>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{t('bill.subtotalGoods')}</span>
          <span className="font-medium">{formatCurrency(bill.subtotal)}</span>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-gray-600">{t('bill.discount')}</span>
          <span className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder={t('bill.zero')}
              className="w-24 px-2 py-1 border rounded-lg text-sm"
              data-testid="bill-discount"
            />
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              className="px-2 py-1 border rounded-lg text-sm"
            >
              <option value="nominal">Rp</option>
              <option value="percent">%</option>
            </select>
            <span className="w-28 text-right font-medium">
              −{formatCurrency(bill.discount)}
            </span>
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-600">{t('bill.tax')}</span>
            <span className="flex items-center gap-2">
              <select
                value={taxRuleId}
                onChange={(e) => setTaxRuleId(e.target.value)}
                className="px-2 py-1 border rounded-lg text-sm"
                data-testid="bill-tax-rule"
              >
                {Object.values(TAX_RULES).map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {t(`bill.${rule.labelKey}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setInclusive(!inclusive)}
                className="px-2 py-1 border rounded-lg text-xs text-gray-600 pressable"
              >
                {inclusive ? t('bill.taxInclusive') : t('bill.taxExclusive')}
              </button>
              <span className="w-28 text-right font-medium">
                +{formatCurrency(bill.taxAmount)}
              </span>
            </span>
          </div>
          {bill.taxAmount > 0 && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {t('bill.taxBase')}: {formatCurrency(bill.taxBase)} (
                {bill.taxEffectiveRate.toFixed(2).replace(/\.00$/, '')}%)
              </span>
              <span>{t('bill.taxAmount')}: {formatCurrency(bill.taxAmount)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{t('bill.fee')}</span>
          <span className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder={t('bill.zero')}
              className="w-24 px-2 py-1 border rounded-lg text-sm"
              data-testid="bill-fee"
            />
            <span className="w-28 text-right font-medium">
              +{formatCurrency(bill.fee)}
            </span>
          </span>
        </div>

        <div className="border-t pt-3 flex justify-between items-baseline">
          <span className="text-sm font-semibold text-gray-800">{t('bill.grandTotal')}</span>
          <span
            className="text-2xl font-bold text-gray-900"
            data-testid="bill-total"
          >
            {formatCurrency(bill.total)}
          </span>
        </div>
      </div>

      {/* ---- the sharing --------------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4" />
            👥 {t('bill.splitTitle')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSplitOn(!splitOn);
              if (!splitOn && participants.length === 0) {
                setParticipants(['Saya']);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium pressable ${
              splitOn
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
            data-testid="split-toggle"
          >
            {splitOn ? 'ON / AKTIF' : 'OFF / MATI'}
          </button>
        </div>

        {splitOn && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              {participants.map((person) => (
                <span
                  key={person}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs"
                >
                  {person === 'Saya' ? t('bill.host') : person}
                  {person !== 'Saya' && (
                    <button
                      type="button"
                      onClick={() => removePerson(person)}
                      aria-label={`${t('qty.remove')} ${person}`}
                      className="text-primary-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <input
                type="text"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPerson();
                  }
                }}
                placeholder={t('bill.addPerson')}
                className="px-2 py-1 border rounded-lg text-xs w-40"
              />
              <button
                type="button"
                onClick={addPerson}
                className="px-2 py-1 bg-gray-100 rounded-lg text-xs pressable"
              >
                <Plus className="w-3 h-3 inline" /> {t('bill.addPerson')}
              </button>
              {splitGroups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  onClick={() =>
                    setParticipants(
                      participants.includes(group.name)
                        ? participants
                        : [...participants, group.name]
                    )
                  }
                  className="px-2 py-1 border rounded-lg text-xs pressable"
                >
                  {group.name}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSplitMode('equal')}
                className={`px-3 py-1.5 rounded-lg text-xs pressable ${
                  splitMode === 'equal'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t('bill.splitModeEqual')}
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('byItem')}
                className={`px-3 py-1.5 rounded-lg text-xs pressable ${
                  splitMode === 'byItem'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t('bill.splitModeByItem')}
              </button>
            </div>

            {split && split.shares.length > 0 && (
              <div className="space-y-1 text-xs" data-testid="split-shares">
                {split.shares.map((share, index) => (
                  <div
                    key={share.name}
                    className="flex justify-between items-center"
                  >
                    <span className="text-gray-600">
                      {index === 0 ? t('bill.myShare') : `${share.name} ${t('bill.owesYou')}`}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(share.amount)}
                      {index > 0 && (
                        <span className="text-gray-400 ml-1">({t('bill.splitSaved')})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
