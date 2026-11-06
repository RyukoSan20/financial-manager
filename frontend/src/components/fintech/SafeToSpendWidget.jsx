/**
 * The first thing the reader sees, and the first question answered.
 *
 * "How much can I spend today without trouble?"
 *
 * The answer is the money they hold, less what is already promised
 * for the next thirty days, less what they have promised to save.
 *
 * It sits at the top of the dashboard because the point of a dashboard
 * is to answer a question, and this is the question people open the
 * app to ask. A dashboard that only shows how things have been going
 * makes the reader do the arithmetic themselves, which is the one job
 * the application exists to do.
 *
 * The figure is broken into its three parts, because a number on its
 * own cannot be argued with, and the reader needs to be able to see
 * where it came from.
 */

import { ShieldCheck, AlertTriangle, Wallet } from 'lucide-react';
import { safeToSpendToday } from '../../utils/decisionWidgets';
import { formatNative } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

export function SafeToSpendWidget({
  cash = 0,
  rules = [],
  goals = [],
  income = 0,
}) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  const result = safeToSpendToday({ cash, rules, goals, income });

  const Icon = result.comfortable ? ShieldCheck : AlertTriangle;
  const tone = result.shortfall > 0 ? 'short' : result.tight ? 'tight' : 'ok';

  return (
    <section
      className={`safe-spend safe-spend--${tone}`}
      data-testid="safe-to-spend"
      aria-label={W.safe_to_spend_title}
    >
      <div className="safe-spend__head">
        <Icon size={17} aria-hidden="true" />
        <div>
          <p className="safe-spend__title">{W.safe_to_spend_title}</p>
          <p className="safe-spend__subtitle">{W.safe_to_spend_subtitle}</p>
        </div>
      </div>

      {/* The figure itself. */}
      <p className="safe-spend__figure" data-testid="safe-to-spend-figure">
        {result.shortfall > 0 ? (
          <>
            <span className="safe-spend__figure-label">
              {W.safe_to_spend_short}
            </span>
            {formatNative(result.shortfall, 'IDR')}
          </>
        ) : (
          formatNative(result.safe, 'IDR')
        )}
      </p>

      {result.shortfall > 0 && (
        <p className="safe-spend__warning">
          {W.recon_higher || W.safe_to_spend_short}:{' '}
          {formatNative(result.bills + result.savings, 'IDR')}
        </p>
      )}

      {/* The three parts, so the figure can be argued with. */}
      <dl className="safe-spend__parts">
        <div className="safe-spend__part">
          <dt>
            <Wallet size={13} aria-hidden="true" /> {W.safe_to_spend_available}
          </dt>
          <dd>{formatNative(result.available, 'IDR')}</dd>
        </div>
        <div className="safe-spend__part">
          <dt>{W.safe_to_spend_bills}</dt>
          <dd>-{formatNative(result.bills, 'IDR')}</dd>
        </div>
        <div className="safe-spend__part">
          <dt>{W.safe_to_spend_savings}</dt>
          <dd>-{formatNative(result.savings, 'IDR')}</dd>
        </div>
      </dl>

      {result.savingsShortfall > 0 && (
        <p className="safe-spend__warning">
          {W.zero_over}: {formatNative(result.savingsShortfall, 'IDR')}
        </p>
      )}
    </section>
  );
}

export default SafeToSpendWidget;
