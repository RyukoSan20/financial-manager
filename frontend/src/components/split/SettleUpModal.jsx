/**
 * Paying somebody back.
 *
 * The screen a debtor looks at. It has two jobs, and both of them
 * exist because paying somebody back is fiddly in Indonesia:
 *
 * - **Copy the account and the exact amount.** Two buttons, and
 *   neither of them asks the reader to pick the last four digits
 *   off a number and hope. The amount is the amount that was worked
 *   out, to the last rupiah, so that what is paid and what is owed
 *   are the same number.
 * - **Check the proof.** A photograph of the transfer receipt is
 *   compared with the bill. The number on the proof and the number
 *   that was owed are read side by side, and the reader is told when
 *   they are not the same.
 *
 * The account number is only shown when there is something to settle.
 * It is not a list to browse.
 */

import { useState } from 'react';
import { batch9 } from '../../i18n/keys_batch9';
import { readAmountFromProof, compareProof } from './splitMath';

/**
 * The number on the proof, read from the text.
 *
 * The number is looked for in the order it usually appears on a
 * transfer receipt: the amount, written out with the separators the
 * bank used.
 */
export default function SettleUpModal({
  open = false,
  step = null,
  paymentMethods = [],
  language = 'id',
  money = (value) => String(value),
  onClose = null,
  onConfirm = null,
  onUploadProof = null,
  proofText = '',
  expectedAmount = null,
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const [copied, setCopied] = useState(null);

  if (!open) return null;

  const amount = step ? Number(step.amount) : 0;
  const comparison = compareProof(
    readAmountFromProof(proofText),
    expectedAmount === null ? amount : expectedAmount,
  );

  const copy = async (what, value) => {
    if (!value) return;
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(String(value));
        setCopied(what);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch (err) {
      // The browser would not let the page write to the clipboard.
      // The reader can still select the number by hand.
    }
  };

  return (
    <div className="split-settle-modal" role="dialog" aria-modal="true">
      <div className="split-settle-modal__panel">
        <header className="split-settle-modal__header">
          <h3>{K.settle_up}</h3>
          {onClose && (
            <button type="button" onClick={onClose} aria-label={K.settle_up}>
              &times;
            </button>
          )}
        </header>

        {step && (
          <p className="split-settle-modal__who">
            <strong>{step.from_member}</strong> &rarr; <strong>{step.to_member}</strong>
          </p>
        )}

        <div className="split-settle-modal__amount">
          <span className="split-settle-modal__amount-label">{K.total}</span>
          <span className="split-settle-modal__amount-value">{money(amount)}</span>
          <button
            type="button"
            className="split-settle-modal__copy"
            onClick={() => copy('amount', amount)}
          >
            {copied === 'amount' ? K.amount_copied : K.copy_amount}
          </button>
        </div>

        {paymentMethods.length === 0 && (
          <p className="split-settle-modal__empty">{K.no_payment_methods}</p>
        )}

        {paymentMethods.map((method) => (
          <div key={method.id} className="split-settle-modal__method">
            <div className="split-settle-modal__method-head">
              <span>{method.label || method.provider_name || method.method_type}</span>
              {method.account_number_hint && (
                <span className="split-settle-modal__hint">
                  ***{method.account_number_hint}
                </span>
              )}
            </div>
            {method.qris_image_url && (
              <img
                className="split-settle-modal__qris"
                src={method.qris_image_url}
                alt={K.qr_title}
              />
            )}
            {method.account_number && (
              <button
                type="button"
                className="split-settle-modal__copy"
                onClick={() => copy('account', method.account_number)}
              >
                {copied === 'account' ? K.account_copied : K.copy_account}
              </button>
            )}
          </div>
        ))}

        {onUploadProof && (
          <div className="split-settle-modal__proof">
            <h4>{K.upload_proof}</h4>
            <p className="split-settle-modal__hint">{K.verify_proof_hint}</p>
            <textarea
              value={proofText}
              onChange={(event) => onUploadProof(event.target.value)}
              placeholder={K.proof_amount}
              rows={3}
            />
            {proofText && (
              <p
                className={
                  comparison.matches
                    ? 'split-settle-modal__proof-ok'
                    : 'split-settle-modal__proof-bad'
                }
              >
                {comparison.matches
                  ? K.proof_matches
                  : K.proof_differs.replace('%s %s', `${comparison.actual} ${comparison.expected}`)}
              </p>
            )}
          </div>
        )}

        {onConfirm && (
          <div className="split-settle-modal__actions">
            <button
              type="button"
              className="split-settle-modal__confirm"
              onClick={() => onConfirm(step, comparison)}
            >
              {K.confirm_payment}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
