/**
 * The budget recipes, as cards.
 *
 * A reader who has no budget yet has to make three decisions before
 * they can fill in a form: how much comes in, what to do with it, and
 * how to divide it. The last one is the hard part, and it is the same
 * for most people.
 *
 * So there are some starting points. Each card is one way of dividing
 * the money. The reader taps one, and the sliders and the amount per
 * day are filled in for them. Every slider can then be moved, because
 * the recipe is a starting point and not a rule.
 *
 * The cards are only shown when the reader is in the recipe version of
 * the budget page. The ordinary form is still there, and the reader
 * chooses.
 */

import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../utils/format';
import {
  PARTS,
  RECIPES,
  amountsFromSplit,
  dailyFromSplit,
  dailyLabel,
  splitOf,
} from '../../utils/budgetRecipes';
import FinBuddyMascot from '../common/FinBuddyMascot';

export default function BudgetRecipeSelector({
  total,
  onApply,
  selectedId = null,
  className = '',
}) {
  const { t, language } = useTranslation();

  // Which recipe is being shown. The recipe the reader picked stays
  // shown even when they move a slider, so they can see what they
  // started from.
  const [chosenId, setChosenId] = useState(selectedId);
  const [split, setSplit] = useState(() => splitOf(RECIPES[0]));

  const chosen = RECIPES.find((recipe) => recipe.id === chosenId) || null;
  const amounts = amountsFromSplit(total, split);
  const daily = dailyFromSplit(total, split);

  const pick = (recipe) => {
    setChosenId(recipe.id);
    setSplit(splitOf(recipe));
  };

  // The three sliders have to add up to a hundred between them. When
  // one is moved, the other two give up what it took, in proportion to
  // what they had, so the reader cannot end up with a budget that
  // does not add up.
  const moveKeepingTotal = (partKey, value) => {
    const wanted = Math.max(0, Math.min(100, Number(value) || 0));
    const others = PARTS.filter((part) => part.key !== partKey);
    const othersTotal = others.reduce((sum, part) => sum + (Number(split[part.key]) || 0), 0);
    const difference = (Number(split[partKey]) || 0) - wanted;

    if (othersTotal <= 0) {
      setSplit({ ...split, [partKey]: wanted });
      return;
    }

    const next = { ...split, [partKey]: wanted };
    let given = 0;
    others.forEach((part, index) => {
      if (index === others.length - 1) {
        // The last one takes whatever is left, so the parts always add
        // up to a hundred exactly.
        next[part.key] = Math.max(0, Number(split[part.key]) + difference - given);
        return;
      }
      const share = (Number(split[part.key]) || 0) * (difference / othersTotal);
      const value2 = Math.max(0, Math.round(Number(split[part.key]) + share));
      next[part.key] = value2;
      given += share;
    });
    setSplit(next);
  };

  return (
    <div className={`budget-recipe-selector ${className}`.trim()}>
      <div className="flex items-center gap-2 mb-3">
        <FinBuddyMascot mood={chosen ? 'celebrating' : 'idle'} size={36} />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('budget_recipe.title')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('budget_recipe.subtitle')}</p>
        </div>
      </div>

      {/* The recipes, as cards. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
        {RECIPES.map((recipe) => {
          const isChosen = chosenId === recipe.id;
          return (
            <button
              type="button"
              key={recipe.id}
              onClick={() => pick(recipe)}
              aria-pressed={isChosen}
              className={`recipe-card text-left rounded-xl border p-3 transition-all duration-150 ${
                isChosen
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {t(recipe.nameKey, recipe.fallback)}
                </span>
                {isChosen && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                    {t('budget_recipe.chosen')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                {t(recipe.descriptionKey, recipe.descriptionFallback)}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {PARTS.map((part) => (
                  <span
                    key={part.key}
                    className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 tabular-nums"
                  >
                    {recipe.split[part.key]}%
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* The sliders, once a recipe is chosen. */}
      {chosen && (
        <div className="recipe-sliders rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/60 dark:bg-gray-800/60">
          <div className="space-y-3">
            {PARTS.map((part) => (
              <div key={part.key}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor={`recipe-${part.key}`}
                    className="text-xs font-medium text-gray-700 dark:text-gray-200"
                  >
                    {t(part.labelKey, part.fallback)}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {split[part.key]}%
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                      {dailyLabel(daily[part.key], language)}
                    </span>
                  </div>
                </div>
                <input
                  id={`recipe-${part.key}`}
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={split[part.key]}
                  onChange={(e) => moveKeepingTotal(part.key, e.target.value)}
                  className="w-full accent-primary-600"
                />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  {formatCurrency(amounts[part.key])}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('budget_recipe.total')}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onApply({ split, amounts, daily, recipeId: chosen.id })}
            className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:bg-primary-700 active:scale-95"
          >
            {t('budget_recipe.apply')}
          </button>
        </div>
      )}

      {!chosen && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('budget_recipe.pick_one')}</p>
      )}
    </div>
  );
}
