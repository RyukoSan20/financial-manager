/**
 * Do the figures agree with the bank?
 *
 * This is the bar that sits at the top of the accounts and
 * transactions pages, and it is there because of what the research
 * found: the commonest reason people leave a money app is that the
 * balance does not match, and nothing tells them why.
 *
 * So the reader types in what their banking app says. There are three
 * answers, and each one says what to do:
 *
 * - they match, and there is nothing to do;
 * - the application is higher, which usually means a transaction was
 *   entered twice;
 * - the application is lower, which usually means one is missing.
 *
 * When there is a difference, the application works out the entry that
 * would close the gap and shows it. It is not written until the reader
 * says so, and the reader can change their mind. Nothing is created
 * without a click.
 */

import { useMemo, useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle } from 'lucide-react';
import { reconciliationState, adjustmentFor } from '../../utils/decisionWidgets';
import { formatNative } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

export function ReconciliationBar({
  recorded = 0,
  bank = null,
  onCheck,
  onCreateEntry,
}) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};
  const [typed, setTyped] = useState('');

  const state = useMemo(
    () => (bank === null || bank === '' ? null : reconciliationState({ recorded, bank: typed })),
    [recorded, bank, typed]
  );

  // The entry that would close the gap. Shown before it is written.
  const adjustment = state ? adjustmentFor(state) : null;

  const check = () => {
    if (typed === '') return;
    onCheck?.(Number(typed));
  };

  const Icon = !state ? Scale : state.matched ? CheckCircle2 : AlertTriangle;
  const tone = !state ? 'idle' : state.matched ? 'matched' : state.higher ? 'higher' : 'lower';

  const message = !state
    ? W.recon_intro
    : state.matched
    ? W.recon_matched
    : state.higher
    ? W.recon_higher
    : W.recon_lower;

  return (
    <section
      className={`recon recon--${tone}`}
      data-testid="reconciliation-bar"
      aria-label={W.recon_title}
    >
      <header className="recon__head">
        <Icon size={16} aria-hidden="true" />
        <p className="recon__title">{W.recon_title}</p>
      </header>

      <div className="recon__figures">
        <span className="recon__label">{W.recon_recorded}</span>
        <span className="recon__value">{formatNative(recorded, 'IDR')}</span>
      </div>

      <div className="recon__input">
        <label className="recon__label" htmlFor="fintech-recon-bank">
          {W.recon_bank}
        </label>
        <input
          id="fintech-recon-bank"
          type="number"
          inputMode="numeric"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="0"
        />
        <button
          type="button"
          className="recon__check"
          onClick={check}
          disabled={typed === ''}
        >
          {W.recon_check}
        </button>
      </div>

      {state && (
        <div className="recon__result" role="status">
          <p className={`recon__message recon__message--${tone}`}>{message}</p>
          {!state.matched && (
            <p className="recon__difference">
              {W.recon_difference}: {formatNative(Math.abs(state.difference), 'IDR')}
            </p>
          )}

          {adjustment?.ok && (
            <div className="recon__entry">
              <p className="recon__entry-head">{W.recon_adjust_preview}</p>
              <p className="recon__entry-line">
                {adjustment.entry.type} · {formatNative(adjustment.entry.amount, 'IDR')}
              </p>
              <button
                type="button"
                className="recon__apply"
                onClick={() => onCreateEntry?.(adjustment.entry)}
              >
                {W.recon_apply}
              </button>
            </div>
          )}

          {state.matched && (
            <p className="recon__entry-head">{W.recon_nothing}</p>
          )}
        </div>
      )}
    </section>
  );
}

export default ReconciliationBar;
