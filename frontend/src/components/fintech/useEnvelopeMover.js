/**
 * Moving money from one category's budget to another's.
 *
 * This is the Goodbudget idea: the reader can shift what is left in
 * one envelope over to another, so a category that has run dry can be
 * rescued by one that has more than it needs.
 *
 * The two budgets are changed together. If the second change fails,
 * the first is put back, so the money is never in both envelopes or
 * in neither.
 *
 * The page is told whether it worked, because a panel that says the
 * move went through when it did not is worse than no panel at all.
 */

import { useCallback } from 'react';
import api from '../../services/api';

/**
 * The hook the budgets page uses.
 */
export function useEnvelopeMover({ budgets = [], onDone }) {
  const moveBetweenBudgets = useCallback(
    async ({ fromId, toId, amount }) => {
      const from = budgets.find((b) => b.id === fromId);
      const to = budgets.find((b) => b.id === toId);
      if (!from || !to || !amount) return false;

      const fromAmount = parseFloat(from.amount) || 0;
      const toAmount = parseFloat(to.amount) || 0;

      try {
        await api.budgets.update(fromId, { amount: fromAmount - amount });
        await api.budgets.update(toId, { amount: toAmount + amount });
        await onDone?.();
        return true;
      } catch {
        // Put the money back where it was, so a failed second change
        // does not leave the reader short.
        try {
          await api.budgets.update(fromId, { amount: fromAmount });
        } catch {
          // The put-back failed too; the list is reloaded so the page
          // shows what the server actually holds.
        }
        await onDone?.();
        return false;
      }
    },
    [budgets, onDone]
  );

  return { moveBetweenBudgets };
}

export default useEnvelopeMover;
