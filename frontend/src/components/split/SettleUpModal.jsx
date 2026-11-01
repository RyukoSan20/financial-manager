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

/**
 * The number on the proof, read from the text.
 *
 * The number is looked for in the order it usually appears on a
 * transfer receipt: the amount, written out with the separators the
 * bank used.
 */
export function readAmountFromProof(text) {
  if (!text) return null;

  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // The lines that say the amount, in the words a bank uses.
  const amountWords = [
    'total transfer',
    'nominal',
    'jumlah',
    'transfer amount',
    'amount',
    'total',
  ];

  for (const line of lines) {
    const lowered = line.toLowerCase();
    const saysAmount = amountWords.some((word) => lowered.includes(word));
    if (!saysAmount) continue;

    const numbers = line.match(/[\d][\d.,\s]*/g);
    if (!numbers) continue;

    // The last number on the line is the amount. The ones before it
    // are usually the account number and the reference.
    for (let index = numbers.length - 1; index >= 0; index -= 1) {
      const value = parseIndonesianAmount(numbers[index]);
      if (value !== null && value > 0) {
        return value;
      }
    }
  }

  // Nothing on a line that says what it is. The biggest number on
  // the receipt is the amount, most of the time.
  let biggest = null;
  for (const line of lines) {
    const numbers = line.match(/[\d][\d.,\s]*/g);
    if (!numbers) continue;
    for (const raw of numbers) {
      const value = parseIndonesianAmount(raw);
      if (value !== null && value > 0 && (biggest === null || value > biggest)) {
        biggest = value;
      }
    }
  }
  return biggest;
}

/**
 * A number written the way a bank writes it.
 *
 * Indonesian banks write `150.000,50`. Some write `150,000.50`.
 * Both are read here, and the one that is decided by which
 * separator comes last.
 */
export function parseIndonesianAmount(raw) {
  if (!raw) return null;
  const text = String(raw).replace(/\s+/g, '').replace(/[^\d.,]/g, '');
  if (!text) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  // How many digits are after the last separator. Three digits after
  // a separator is a thousands mark, not a decimal part: `150.000`
  // is a hundred and fifty thousand, and `150.50` is a hundred and
  // fifty and a half.
  const tail = (separator) => {
    if (separator < 0) return 0;
    return text.length - separator - 1;
  };

  let cleaned;
  if (lastComma > lastDot) {
    // Indonesian: the dot is the thousands mark and the comma is
    // the decimal mark.
    cleaned =
      tail(lastComma) === 3
        ? text.replace(/\./g, '').replace(/,/g, '')
        : text.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // English: the comma is the thousands mark and the dot is the
    // decimal mark.
    cleaned =
      tail(lastDot) === 3
        ? text.replace(/,/g, '').replace(/\./g, '')
        : text.replace(/,/g, '');
  } else {
    cleaned = text.replace(/[.,]/g, '');
  }

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * Whether the proof says what it should.
 *
 * `expected` is what was owed. `actual` is what the proof says was
 * paid. The two are the same when they are the same number, and
 * money is compared to the last rupiah.
 */
export function compareProof(actual, expected) {
  if (actual === null || actual === undefined) {
    return { matches: false, actual: null, expected, reason: 'unknown' };
  }
  const left = Math.round(Number(actual));
  const right = Math.round(Number(expected));
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return { matches: false, actual: null, expected, reason: 'unknown' };
  }
  return {
    matches: left === right,
    actual: left,
    expected: right,
    reason: left === right ? 'exact' : 'different',
  };
}

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
