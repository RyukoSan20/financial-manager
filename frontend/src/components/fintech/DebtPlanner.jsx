/**
 * The plan for paying the debts off.
 *
 * Two things sit on the debts page and they are the same idea seen
 * from two sides.
 *
 * The first is the order. There are two ways to work through a list of
 * debts and they give different answers:
 *
 * - The snowball clears the smallest balance first. The reader sees
 *   debts going down one at a time, which is why it is often chosen.
 * - The avalanche pays the highest interest first. The reader pays
 *   the least money overall, which is why it is often the better one.
 *
 * Neither is right for everyone, so the reader picks, and the order on
 * the screen changes.
 *
 * The second is what would happen if the reader paid a bit more each
 * month. It says how much interest that saves and how many months
 * sooner the debt is cleared.
 *
 * The arithmetic is in `utils/fintech.js`, so the interest worked out
 * here is the interest the application works out.
 */

import { useMemo, useState } from 'react';
import { TrendingDown, Snowflake, Mountain, Calculator } from 'lucide-react';
import {
  DEBT_STRATEGIES,
  orderDebts,
  payoffWithExtra,
  debtStrategyIsKnown,
} from '../../utils/fintech';
import { formatNative } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

/**
 * The two orders, side by side, with the debts in them.
 */
export function DebtOrderPanel({ debts = [], strategy, onStrategyChange }) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  const current = debtStrategyIsKnown(strategy) ? strategy : 'snowball';
  const ordered = useMemo(() => orderDebts(debts, current), [debts, current]);

  if (!ordered.length) return null;

  return (
    <section
      className="fintech-panel"
      data-testid="debt-order-panel"
      aria-label={W.debt_strategy}
    >
      <header className="fintech-panel__head">
        <h3 className="fintech-panel__title">{W.debt_strategy}</h3>
        <p className="fintech-panel__hint">{W.debt_strategy_hint}</p>
      </header>

      <div className="fintech-segment" role="group" aria-label={W.debt_strategy}>
        {DEBT_STRATEGIES.map((option) => {
          const Icon = option.key === 'snowball' ? Snowflake : Mountain;
          const label = W[option.labelKey] || option.fallback;
          const active = option.key === current;
          return (
            <button
              key={option.key}
              type="button"
              className={`fintech-segment__button ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onStrategyChange?.(option.key)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <ol className="fintech-order">
        {ordered.map((debt) => (
          <li key={debt.id} className="fintech-order__row">
            <span className="fintech-order__number" aria-hidden="true">
              {debt.order}
            </span>
            <span className="fintech-order__name">{debt.name}</span>
            <span className="fintech-order__rate">
              {(Number(debt.interest_rate) * 100).toFixed(1)}%
            </span>
            <span className="fintech-order__balance">
              {formatNative(Number(debt.balance) || 0, 'IDR')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * What happens if the reader pays a bit more.
 *
 * The slider goes up in steps of a hundred thousand, which is a round
 * number in rupiah and a small enough step that the reader can see
 * the effect.
 */
export function PayoffSimulator({ debt }) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};
  const [extra, setExtra] = useState(500000);

  const result = useMemo(() => payoffWithExtra(debt, extra), [debt, extra]);

  if (!result.ok) return null;

  const nothingChanges = result.monthsSaved <= 0 && result.interestSaved <= 0;

  return (
    <section
      className="fintech-panel"
      data-testid="payoff-simulator"
      aria-label={W.debt_simulator}
    >
      <header className="fintech-panel__head">
        <h3 className="fintech-panel__title">
          <Calculator size={16} aria-hidden="true" /> {W.debt_simulator}
        </h3>
      </header>

      <label className="fintech-slider">
        <span className="fintech-slider__label">{W.debt_simulator_extra}</span>
        <span className="fintech-slider__value">
          {formatNative(extra, 'IDR')}
        </span>
        <input
          type="range"
          min="0"
          max="5000000"
          step="100000"
          value={extra}
          onChange={(event) => setExtra(Number(event.target.value))}
          aria-label={W.debt_simulator_extra}
        />
      </label>

      {nothingChanges ? (
        <p className="fintech-panel__note">{W.debt_simulator_same}</p>
      ) : (
        <div className="fintech-savings">
          <div className="fintech-savings__item">
            <TrendingDown size={15} aria-hidden="true" />
            <span>
              {W.debt_simulator_saves.replace(
                '%amount%',
                formatNative(result.interestSaved, 'IDR')
              )}
            </span>
          </div>
          <div className="fintech-savings__item">
            <TrendingDown size={15} aria-hidden="true" />
            <span>
              {W.debt_simulator_faster.replace('%months%', String(result.monthsSaved))}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Both panels, for the debts page.
 */
export function DebtPlanner({ debts = [], strategy, onStrategyChange }) {
  const ordered = useMemo(() => orderDebts(debts, strategy || 'snowball'), [debts, strategy]);
  // The simulator works on one debt: the one that is first in the
  // order, because that is the one the reader is about to pay.
  const first = ordered[0] || null;

  if (!ordered.length) return null;

  return (
    <div className="fintech-grid" data-testid="debt-planner">
      <DebtOrderPanel
        debts={debts}
        strategy={strategy}
        onStrategyChange={onStrategyChange}
      />
      {first && <PayoffSimulator debt={first} />}
    </div>
  );
}

export default DebtPlanner;
