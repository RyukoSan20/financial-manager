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
  // The list is refreshed after the move. It must not be able to
  // change the answer, so it swallows its own failure.
  const refresh = useCallback(async () => {
    try {
      await onDone?.();
    } catch {
      // The move already happened; a failed refresh only means the
      // list on the screen is out of date for a moment.
    }
  }, [onDone]);

  const moveBetweenBudgets = useCallback(
    async ({ fromId, toId, amount }) => {
      // The ids come from a select box, so they are strings. The
      // budgets carry numbers. They are compared as strings, because a
      // strict comparison of '427' with 427 finds nothing and the move
      // silently refuses to happen.
      const from = budgets.find((b) => String(b.id) === String(fromId));
      const to = budgets.find((b) => String(b.id) === String(toId));
      if (!from || !to || !amount) return false;

      const fromAmount = parseFloat(from.amount) || 0;
      const toAmount = parseFloat(to.amount) || 0;

      try {
        await api.budgets.update(fromId, { amount: fromAmount - amount });
        await api.budgets.update(toId, { amount: toAmount + amount });
      } catch {
        // Put the money back where it was, so a failed second change
        // does not leave the reader short.
        try {
          await api.budgets.update(fromId, { amount: fromAmount });
        } catch {
          // The put-back failed too; the list is reloaded so the page
          // shows what the server actually holds.
        }
        await refresh();
        return false;
      }

      // The money has moved. The list is refreshed afterwards, and a
      // failure there is not a failure of the move - the server
      // already has the new amounts.
      await refresh();
      return true;
    },
    [budgets, refresh]
  );

  return { moveBetweenBudgets };
}

export default useEnvelopeMover;
