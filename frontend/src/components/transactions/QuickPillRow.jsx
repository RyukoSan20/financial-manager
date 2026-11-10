/**
 * The quick pills.
 *
 * Below the amount on the "add a transaction" screen there are two
 * rows of pills: the categories that are used most often for the kind
 * of transaction being recorded, and the accounts the money is in.
 *
 * One tap sets the category. One tap sets the account. The reader who
 * buys coffee every morning does not open a tree and look for "Kopi &
 * Kafe" every single time - they tap the pill that is already there.
 *
 * And the pills change with the kind of transaction. A reader
 * recording an income is offered "Gaji", "Freelance" and "Bisnis" -
 * never "Makanan & Minuman". A reader recording an expense is offered
 * food, transport and shopping - never a salary. The two lists do not
 * meet, and that is not an accident: the same list for both is what
 * made the category sheet confusing in the first place.
 *
 * The pills are of the kind of transaction being recorded, and they
 * are the ones that are used most often, so the ones a reader
 * actually wants are the ones under their thumb.
 */

import { useMemo } from 'react';
import { Wallet } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { categoriesForType } from '../../features/transactions/nlp/categoryTypes';

/**
 * How many pills there are.
 *
 * Six is what fits on a phone without scrolling, and it is enough to
 * cover what most transactions are.
 */
const PILL_LIMIT = 6;

/**
 * The categories the reader uses most, for this kind of transaction.
 *
 * The count comes from the transactions the reader has already made,
 * so the pills are the reader's own habits and not ours. A reader who
 * has never recorded a "Kopi & Kafe" is not offered one.
 */
export function quickCategories(categories = [], usage = {}, type = 'expense', limit = PILL_LIMIT) {
  const forType = categoriesForType(categories, type);

  const scored = forType
    .filter((cat) => !cat.parent_id)
    .map((cat) => ({
      ...cat,
      uses: usage[cat.id] || 0,
    }))
    .sort((a, b) => {
      if (b.uses !== a.uses) return b.uses - a.uses;
      // The same number of uses: the one that comes first in the list
      // the reader made wins, so the order is stable and not random
      // between two renders.
      return (a.id || 0) - (b.id || 0);
    });

  const used = scored.filter((cat) => cat.uses > 0).slice(0, limit);
  const rest = scored.filter((cat) => cat.uses === 0).slice(0, Math.max(0, limit - used.length));

  return [...used, ...rest];
}

/**
 * The accounts the reader has, for this kind of transaction.
 *
 * A transfer needs two accounts, so the pills are not offered for one -
 * a reader who taps "BCA" for a transfer does not know which end
 * they meant.
 */
export function quickAccounts(accounts = [], type = 'expense', limit = PILL_LIMIT) {
  if (type === 'transfer') return [];

  const active = (accounts || []).filter((acc) => acc.is_active !== false);
  return active.slice(0, limit);
}

/**
 * @param {object} props
 * @param {Array} props.categories     Every category the reader has
 * @param {Array} props.accounts      Every account the reader has
 * @param {object} props.usage        How often each category is used
 * @param {string} props.type         The kind of transaction
 * @param {number} props.categoryId   The category that is chosen
 * @param {number} props.accountId    The account that is chosen
 * @param {Function} props.onCategory Called with the category chosen
 * @param {Function} props.onAccount  Called with the account chosen
 */
export default function QuickPillRow({
  categories = [],
  accounts = [],
  usage = {},
  type = 'expense',
  categoryId,
  accountId,
  onCategory,
  onAccount,
}) {
  const { t } = useTranslation();

  const categoryPills = useMemo(
    () => quickCategories(categories, usage, type),
    [categories, usage, type],
  );

  const accountPills = useMemo(
    () => quickAccounts(accounts, type),
    [accounts, type],
  );

  if (!categoryPills.length && !accountPills.length) return null;

  return (
    <div className="quick-pill-row space-y-2" data-testid="quick-pill-row">
      {/* The categories. */}
      {categoryPills.length ? (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">
            {t('quick_pill.quick_category')}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {categoryPills.map((cat) => {
              const isActive = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategory?.(cat.id)}
                  aria-pressed={isActive}
                  data-testid={`quick-category-${cat.id}`}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-[transform,background-color,color,box-shadow] duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm scale-105'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/40 hover:text-primary-700 dark:hover:text-primary-200 hover:shadow-sm hover:-translate-y-0.5'
                  }`}
                >
                  <span aria-hidden="true">{cat.icon || '🏷️'}</span>
                  <span className="whitespace-nowrap">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* The accounts. */}
      {accountPills.length ? (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0 inline-flex items-center gap-1">
            <Wallet className="w-3 h-3" aria-hidden="true" />
            {t('quick_pill.quick_wallet')}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {accountPills.map((acc) => {
              const isActive = accountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onAccount?.(acc.id)}
                  aria-pressed={isActive}
                  data-testid={`quick-account-${acc.id}`}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-[transform,background-color,color,box-shadow] duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm scale-105'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 hover:text-emerald-700 dark:hover:text-emerald-200 hover:shadow-sm hover:-translate-y-0.5'
                  }`}
                >
                  <span className="whitespace-nowrap">{acc.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { QuickPillRow };
