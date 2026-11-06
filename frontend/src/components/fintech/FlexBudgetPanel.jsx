/**
 * The flexible budget.
 *
 * The budget page shows one envelope at a time: a category, an amount,
 * and how much of it has gone. That is a good way to look at one
 * thing, and a poor way to see the shape of a month.
 *
 * So this panel gathers them into three, the way Monarch does:
 *
 * - Fixed: the bills that come every month, the same amount each time.
 * - Sinking: the things that come once in a while, so the money is put
 *   aside a little at a time.
 * - Flexible: everything else, the part that moves around.
 *
 * The three add up to the total, and the leftover goes into the
 * flexible envelope, because that is the one that is meant to absorb
 * what is left over.
 *
 * And when one envelope has run out and another has more than it
 * needs, the reader can move money between them. The move is refused
 * when the money is not there, and the refusal says so.
 *
 * The rollover is per envelope. Money that is not spent is not lost,
 * it is still the reader's, and they can carry it to next month - but
 * only the ones they choose to.
 *
 * The arithmetic is in `utils/fintech.js`.
 */

import { useMemo, useState } from 'react';
import { Layers, ArrowLeftRight, RotateCcw } from 'lucide-react';
import {
  ENVELOPE_KINDS,
  splitIntoEnvelopes,
  rolloverFor,
  moveBetweenEnvelopes,
} from '../../utils/fintech';
import { formatNative } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

/**
 * The kind of envelope a budget is.
 *
 * A budget that is not a fixed bill and not a sinking fund is
 * flexible. The reader can say which it is, and the default is the
 * third one, because most spending is that.
 */
export function envelopeKindOf(budget) {
  const kind = budget?.envelope_kind;
  if (kind === 'fixed' || kind === 'sinking' || kind === 'flexible') return kind;
  const name = String(budget?.name || '').toLowerCase();
  if (/(sewa|rent|kontrakan|bayar|tagihan|listrik|internet|angsuran|loan)/.test(name)) {
    return 'fixed';
  }
  if (/(tabungan|target|renovasi|liburan|travel|dana darurat|emergency)/.test(name)) {
    return 'sinking';
  }
  return 'flexible';
}

/**
 * The three envelopes and the money in them.
 */
export function FlexBudgetPanel({ budgets = [], carry = {}, onCarryChange }) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  const totals = useMemo(() => {
    const byKind = { fixed: 0, sinking: 0, flexible: 0 };
    for (const budget of budgets || []) {
      byKind[envelopeKindOf(budget)] += Number(budget.amount) || 0;
    }
    return byKind;
  }, [budgets]);

  const total = useMemo(
    () => (budgets || []).reduce((sum, budget) => sum + (Number(budget.amount) || 0), 0),
    [budgets]
  );

  const split = useMemo(
    () => splitIntoEnvelopes(total, totals),
    [total, totals]
  );

  const rolled = useMemo(() => rolloverFor(budgets || [], carry), [budgets, carry]);

  if (!budgets.length) return null;

  return (
    <section
      className="fintech-panel"
      data-testid="flex-budget-panel"
      aria-label={W.envelope_flex_title}
    >
      <header className="fintech-panel__head">
        <h3 className="fintech-panel__title">
          <Layers size={16} aria-hidden="true" /> {W.envelope_flex_title}
        </h3>
        <p className="fintech-panel__hint">{W.envelope_flex_text}</p>
      </header>

      <div className="fintech-envelopes">
        {ENVELOPE_KINDS.map((kind) => {
          const amount = split[kind.key];
          const share = total > 0 ? Math.round((amount / total) * 100) : 0;
          return (
            <div key={kind.key} className="fintech-envelope">
              <p className="fintech-envelope__name">
                {W[kind.labelKey] || kind.fallback}
              </p>
              <p className="fintech-envelope__amount">{formatNative(amount, 'IDR')}</p>
              <p className="fintech-envelope__share">{share}%</p>
            </div>
          );
        })}
      </div>

      {!split.balanced && (
        <p className="fintech-panel__note">
          {formatNative(split.remainder, 'IDR')}
        </p>
      )}

      {/* The rollover, one switch per envelope. */}
      <div className="fintech-rollover">
        <p className="fintech-rollover__head">
          <RotateCcw size={14} aria-hidden="true" /> {W.envelope_rollover}
        </p>
        <ul className="fintech-rollover__list">
          {rolled.rows.map((row) => (
            <li key={row.id} className="fintech-rollover__row">
              <label className="fintech-rollover__label">
                <input
                  type="checkbox"
                  checked={row.rollover > 0 || carry[row.id] === true}
                  onChange={(event) => onCarryChange?.(row.id, event.target.checked)}
                  aria-label={`${W.envelope_rollover} — ${row.name}`}
                />
                <span>{row.name}</span>
              </label>
              <span className="fintech-rollover__value">
                {row.overspent
                  ? `-${formatNative(Math.abs(row.leftover), 'IDR')}`
                  : formatNative(row.leftover, 'IDR')}
              </span>
            </li>
          ))}
        </ul>
        {rolled.carried > 0 && (
          <p className="fintech-panel__note">
            {formatNative(rolled.carried, 'IDR')}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Moving money from one envelope to another.
 *
 * The reader picks where the money comes from, where it goes, and how
 * much. The move is refused when the source envelope does not have
 * that much in it, and the refusal says so rather than leaving the
 * reader wondering.
 */
export function EnvelopeTransfer({ budgets = [], onMove }) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(null);

  const envelopes = useMemo(
    () =>
      (budgets || []).map((budget) => ({
        id: budget.id,
        name: budget.name,
        remaining:
          (Number(budget.amount) || 0) - (Number(budget.spent) || 0),
      })),
    [budgets]
  );

  if (envelopes.length < 2) return null;

  const move = async () => {
    const result = moveBetweenEnvelopes(envelopes, fromId, toId, amount);
    if (!result.ok) {
      setMessage(
        result.reason === 'short'
          ? W.envelope_move_short
          : W.envelope_move_amount
      );
      return;
    }

    // The move is only reported as done when it actually happened.
    // The page writes the two changes and says so afterwards, so the
    // reader is never told a move went through when it did not.
    const done = await onMove?.({ fromId, toId, amount: result.moved });
    if (done === false) {
      setMessage(W.envelope_move_failed);
      return;
    }
    setMessage(W.envelope_move_done);
    setAmount('');
  };

  return (
    <section
      className="fintech-panel"
      data-testid="envelope-transfer"
      aria-label={W.envelope_move}
    >
      <header className="fintech-panel__head">
        <h3 className="fintech-panel__title">
          <ArrowLeftRight size={16} aria-hidden="true" /> {W.envelope_move}
        </h3>
      </header>

      <div className="fintech-transfer">
        <label className="fintech-transfer__field">
          <span>{W.envelope_move_from}</span>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">—</option>
            {envelopes.map((envelope) => (
              <option key={envelope.id} value={envelope.id}>
                {envelope.name}
              </option>
            ))}
          </select>
        </label>

        <label className="fintech-transfer__field">
          <span>{W.envelope_move_to}</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">—</option>
            {envelopes.map((envelope) => (
              <option key={envelope.id} value={envelope.id}>
                {envelope.name}
              </option>
            ))}
          </select>
        </label>

        <label className="fintech-transfer__field">
          <span>{W.envelope_move_amount}</span>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="fintech-transfer__go"
          onClick={move}
          disabled={!fromId || !toId || !Number(amount)}
        >
          {W.envelope_move}
        </button>
      </div>

      {message && (
        <p className="fintech-panel__note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export default FlexBudgetPanel;
