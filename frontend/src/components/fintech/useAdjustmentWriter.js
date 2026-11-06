/**
 * Writing the entry that closes the gap.
 *
 * The reconciliation bar appears on two pages - the accounts page and
 * the transactions page - and both of them have to be able to write the
 * adjusting entry. So the writing is here, once, rather than in both
 * pages.
 *
 * The entry goes against the account with the most money in it, because
 * that is the one the difference belongs to.
 *
 * Two rules hold it up:
 *
 * - the reader is asked before anything is written, because this
 *   creates a record;
 * - the page is told whether it worked, so it can say so. A page that
 *   reported success without knowing would be lying.
 */

import { useCallback, useMemo } from 'react';
import api from '../../services/api';
import { toast } from '../../contexts/ToastContext';
import { ask } from '../../contexts/ConfirmContext';
import { useTranslation } from '../../i18n';
import { batch4 } from '../../i18n/keys_batch4';
import { formatNative } from '../../utils/currency';

/**
 * The account the difference belongs to.
 *
 * The one with the most money in it, and not a credit card: a credit
 * card's balance is a debt, and putting the difference there would
 * make the reader's debt bigger rather than their cash smaller.
 */
export function pickAdjustmentAccount(accounts = []) {
  return [...accounts]
    .filter((account) => !account.is_credit)
    .sort(
      (a, b) => (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0)
    )[0];
}

/**
 * The hook the pages use.
 */
export function useAdjustmentWriter({ accounts = [], onDone }) {
  const { language } = useTranslation();
  // These words live in the batch file with the other screens that
  // were moved over, so they are read from there rather than through
  // the main lookup.
  const A = useMemo(() => batch4[language]?.accounts || {}, [language]);

  const createAdjustment = useCallback(
    async (entry) => {
      if (!entry || !entry.amount) return false;

      const target = pickAdjustmentAccount(accounts);
      if (!target) {
        toast.error(A.no_account_to_adjust);
        return false;
      }

      const ok = await ask({
        title: A.adjust_confirm_title,
        message: A.adjust_confirm_message.replace(
          '%amount%',
          formatNative(entry.amount, target.currency || 'IDR')
        ),
        confirmLabel: A.adjust_confirm_yes,
        cancelLabel: A.adjust_confirm_no,
      });
      if (!ok) return false;

      try {
        await api.transactions.create({
          type: entry.type,
          amount: entry.amount,
          currency: target.currency || 'IDR',
          account_id: target.id,
          description: entry.description,
          date: new Date().toISOString().slice(0, 10),
        });
        toast.success(A.adjust_done);
        await onDone?.();
        return true;
      } catch {
        toast.error(A.adjust_failed);
        return false;
      }
    },
    [accounts, onDone, A]
  );

  return { createAdjustment };
}

export default useAdjustmentWriter;
