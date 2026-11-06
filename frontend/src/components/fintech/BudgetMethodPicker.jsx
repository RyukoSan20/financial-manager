/**
 * Which way the reader wants to run their money.
 *
 * There are three ways to handle a budget and they suit different
 * people:
 *
 * - Simple: three groups, nothing more to think about.
 * - Category envelopes: a limit per category, with the leftover
 *   carried over and balances moved between envelopes.
 * - Zero-based: every rupiah given a job until nothing is left.
 *
 * They are three ways of looking at the same money, not three kinds
 * of money. Switching between them never changes a record - it
 * changes what is shown and what the reader can do with it. That is
 * said on the panel, because a reader who thinks switching is going
 * to rearrange their budget will not switch at all.
 *
 * The choice is kept in the reader's own preferences, so it survives
 * a reload and it is theirs, not the application's.
 */

import { Check } from 'lucide-react';
import { BUDGET_METHODS, resolveBudgetMethod } from '../../utils/decisionWidgets';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

export function BudgetMethodPicker({ method = 'flex', onChange }) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  const current = resolveBudgetMethod(method);

  return (
    <section
      className="fintech-panel"
      data-testid="budget-method-picker"
      aria-label={W.method_title}
    >
      <header className="fintech-panel__head">
        <h3 className="fintech-panel__title">{W.method_title}</h3>
        <p className="fintech-panel__hint">{W.method_intro}</p>
      </header>

      <div className="fintech-methods" role="radiogroup" aria-label={W.method_title}>
        {BUDGET_METHODS.map((option) => {
          const active = option.key === current;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`fintech-method ${active ? 'is-active' : ''}`}
              onClick={() => onChange?.(option.key)}
            >
              <span className="fintech-method__head">
                {active && <Check size={15} aria-hidden="true" />}
                <span className="fintech-method__summary">
                  {W[option.summaryKey] || option.fallback}
                </span>
              </span>
              <span className="fintech-method__detail">
                {W[option.detailKey] || ''}
              </span>
              {active && (
                <span className="fintech-method__current">{W.method_current}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default BudgetMethodPicker;
