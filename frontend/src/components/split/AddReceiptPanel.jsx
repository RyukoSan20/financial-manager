/**
 * Adding a receipt to a group.
 *
 * A shared bill starts with a receipt. The reader scans it, the
 * receipt is read into the dishes on it, and the reader checks that
 * the reading is right before the bill is made. Nothing is written
 * down until the reader says so.
 *
 * The reading is a proposal. The reader can change a dish, change a
 * price, or take a line away. The gap between the lines and the
 * subtotal is shown, because a receipt that was read wrong is a
 * receipt somebody would otherwise pay for wrongly.
 */

import { useCallback, useMemo, useState } from 'react';
import { createExpense, decomposeReceipt } from '../../services/splitApi';
import { batch9 } from '../../i18n/keys_batch9';
import { parseIndonesianAmount } from './splitMath';

/**
 * The lines of a receipt, as the reader wrote them down.
 *
 * One dish per line. The reader types what the paper says; the
 * reading turns that into quantities and prices.
 */
const EMPTY_LINES = '';

/**
 * The dishes, as they stand while the reader is changing them.
 *
 * A dish has a name, how many there were, what one costs, and what
 * the line costs in all. The last one is worked out from the first
 * three, so the reader does not have to write the same number twice
 * and get it wrong.
 */
function blankDish() {
  return {
    name: '',
    quantity: '1',
    unitPrice: '',
    totalPrice: '',
    kind: 'item',
  };
}

/**
 * The number on a dish, as a number.
 *
 * The reader may type "40.000" or "40k" or "40000". The reader is
 * in Indonesia, so the thousands separator is a dot and the decimal
 * separator is a comma. The reading of a number like that already
 * exists in the shared helpers, so it is used here as well, and the
 * two places cannot drift apart.
 */
function readAmount(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/k$/i, '000');
  if (!cleaned) return 0;

  const parsed = parseIndonesianAmount(cleaned);
  if (parsed !== null && Number.isFinite(parsed)) return parsed;

  const value = Number(cleaned.replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

/**
 * The total of a dish, worked out.
 *
 * When the reader gave a price and a count, the line costs that
 * price times that count. When they gave the total of the line, that
 * is what it costs.
 */
function dishTotal(dish) {
  const given = readAmount(dish.totalPrice);
  if (given > 0) return given;
  return readAmount(dish.unitPrice) * (readAmount(dish.quantity) || 1);
}

/**
 * The panel.
 */
export default function AddReceiptPanel({
  groupId,
  accounts = [],
  members = [],
  language = 'id',
  onCreated,
  onCancel,
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const [lines, setLines] = useState(EMPTY_LINES);
  const [dishes, setDishes] = useState([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [merchant, setMerchant] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payerMemberId, setPayerMemberId] = useState('');

  // The host is the one who paid, unless the reader says otherwise.
  const host = useMemo(
    () => members.find((member) => member.is_host) || null,
    [members],
  );

  /**
   * The receipt, read.
   *
   * The reading writes nothing down. It only says what the lines
   * look like, so that the reader can look at them.
   */
  const read = useCallback(async () => {
    const theLines = lines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!theLines.length) {
      setError(new Error(K.add_receipt_needs_lines));
      return;
    }

    setReading(true);
    setError(null);
    try {
      const answer = await decomposeReceipt({ lines: theLines, use_model: true });
      setDishes(
        (answer.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity || '1',
          unitPrice: item.unit_price || '0',
          totalPrice: item.total_price || '0',
          kind: item.kind || 'item',
        })),
      );
      setNotice(answer.discrepancy ? K.discrepancy_warning : K.add_receipt_read);
    } catch (err) {
      setError(err);
    } finally {
      setReading(false);
    }
  }, [lines, K]);

  /**
   * One dish, changed.
   */
  const changeDish = (index, field, value) => {
    setDishes((current) =>
      current.map((dish, at) => (at === index ? { ...dish, [field]: value } : dish)),
    );
  };

  const removeDish = (index) => {
    setDishes((current) => current.filter((_, at) => at !== index));
  };

  const addDish = () => {
    setDishes((current) => [...current, blankDish()]);
  };

  /**
   * What the dishes add up to.
   */
  const totals = useMemo(() => {
    // The subtotal is the dishes. The tax and the service charge are
    // added on top of them, and the discount comes off. The total is
    // what was paid, which is the same way the server reads it, so
    // the two do not drift apart.
    const sumOf = (kind) =>
      dishes
        .filter((dish) => dish.kind === kind)
        .reduce((sum, dish) => sum + dishTotal(dish), 0);

    const items = sumOf('item');
    const tax = sumOf('tax');
    const service = sumOf('service');
    const discount = sumOf('discount');

    return {
      subtotal: items,
      tax,
      service,
      discount,
      grandTotal: items + tax + service - discount,
    };
  }, [dishes]);

  /**
   * The bill, made.
   */
  const save = useCallback(async () => {
    const theDishes = dishes.filter((dish) => dish.name.trim());
    if (!theDishes.length) {
      setError(new Error(K.add_receipt_needs_dishes));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: merchant.trim() || K.add_receipt_default_name,
        merchant_name: merchant.trim() || null,
        items: theDishes.map((dish) => ({
          name: dish.name.trim(),
          quantity: String(readAmount(dish.quantity) || 1),
          unit_price: String(readAmount(dish.unitPrice)),
          total_price: String(dishTotal(dish)),
          kind: dish.kind || 'item',
        })),
        subtotal: String(totals.subtotal),
        tax: String(totals.tax),
        service_charge: String(totals.service),
        discount: String(totals.discount),
        grand_total: String(totals.grandTotal),
        split_mode: 'ITEMIZED',
      };

      if (accountId) payload.payer_account_id = Number(accountId);

      // Who paid, and how much.
      //
      // When the reader names somebody, that is who paid. When they
      // do not, the host is the one who paid: they are the member of
      // the group, and the bill names the account it came out of.
      const paidBy = payerMemberId
        ? Number(payerMemberId)
        : host
          ? host.id
          : null;
      if (paidBy) {
        payload.payers = [
          {
            member_id: paidBy,
            amount: Number(totals.grandTotal),
          },
        ];
      }

      const made = await createExpense(groupId, payload);
      setDishes([]);
      setLines(EMPTY_LINES);
      setMerchant('');
      setNotice(K.add_receipt_done);
      if (onCreated) onCreated(made);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }, [dishes, merchant, accountId, payerMemberId, host, totals, groupId, K, onCreated]);

  return (
    <section className="split-add-receipt">
      <h3>{K.add_receipt}</h3>

      <label className="split-add-receipt__label" htmlFor="split-receipt-lines">
        {K.add_receipt_lines}
      </label>
      <textarea
        id="split-receipt-lines"
        value={lines}
        rows={6}
        placeholder={K.add_receipt_lines_placeholder}
        onChange={(event) => setLines(event.target.value)}
      />
      <button type="button" onClick={read} disabled={reading}>
        {reading ? K.add_receipt_reading : K.add_receipt_read_button}
      </button>

      {dishes.length > 0 && (
        <div className="split-add-receipt__dishes">
          <ul>
            {dishes.map((dish, index) => (
              <li key={index}>
                <input
                  type="text"
                  value={dish.name}
                  aria-label={K.add_receipt_dish_name}
                  onChange={(event) => changeDish(index, 'name', event.target.value)}
                />
                <input
                  type="text"
                  value={dish.quantity}
                  aria-label={K.add_receipt_dish_quantity}
                  onChange={(event) => changeDish(index, 'quantity', event.target.value)}
                />
                <input
                  type="text"
                  value={dish.unitPrice}
                  aria-label={K.add_receipt_dish_price}
                  onChange={(event) => changeDish(index, 'unitPrice', event.target.value)}
                />
                <input
                  type="text"
                  value={dish.totalPrice}
                  aria-label={K.add_receipt_dish_total}
                  onChange={(event) => changeDish(index, 'totalPrice', event.target.value)}
                />
                <button type="button" onClick={() => removeDish(index)}>
                  {K.remove}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addDish}>
            {K.add_receipt_add_dish}
          </button>
        </div>
      )}

      <div className="split-add-receipt__fields">
        <label htmlFor="split-receipt-merchant">{K.merchant}</label>
        <input
          id="split-receipt-merchant"
          type="text"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        />

        {members.length > 0 && (
          <>
            <label htmlFor="split-receipt-payer">{K.paid_by}</label>
            <select
              id="split-receipt-payer"
              value={payerMemberId}
              onChange={(event) => setPayerMemberId(event.target.value)}
            >
              <option value="">{host ? host.display_name : K.add_receipt_default_name}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </>
        )}

        {accounts.length > 0 && (
          <>
            <label htmlFor="split-receipt-account">{K.add_receipt_account}</label>
            <select
              id="split-receipt-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">{K.add_receipt_no_account}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="split-add-receipt__totals">
        <span>{K.subtotal}</span>
        <strong>{totals.subtotal}</strong>
        <span>{K.grand_total}</span>
        <strong>{totals.grandTotal}</strong>
      </div>

      {notice && <p className="split-add-receipt__notice">{notice}</p>}
      {error && (
        <p className="split-add-receipt__error" role="alert">
          {error.message}
        </p>
      )}

      <div className="split-add-receipt__actions">
        <button type="button" onClick={save} disabled={saving || !dishes.length}>
          {saving ? K.saving : K.add_receipt_save}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            {K.cancel}
          </button>
        )}
      </div>
    </section>
  );
}
