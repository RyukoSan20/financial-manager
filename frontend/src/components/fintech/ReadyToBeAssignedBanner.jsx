/**
 * The banner that says what the money is doing.
 *
 * Two things sit at the top of the dashboard and they are both about
 * trust:
 *
 * - The money that has not been given a job yet. A reader has money
 *   in the bank and budgets that claim parts of it. The rest is free
 *   to be given a job, and until it is, it is money that is doing
 *   nothing. This is the YNAB idea, and it is worth showing because
 *   it is the one number that tells the reader whether their plan
 *   works.
 *
 * - How fresh the data is, and whether anything is waiting to be
 *   looked at. The survey behind this work found that the most common
 *   complaint about the tools people already use is that the data is
 *   wrong and nobody says so. So the banner says when it was last
 *   touched, and offers the fix in one click.
 *
 * The numbers come from the shared arithmetic in `utils/fintech.js`,
 * so this component does no maths of its own.
 */

import { useMemo } from 'react';
import { CheckCircle2, AlertCircle, Wallet, Sparkles, ArrowRight } from 'lucide-react';
import { readyToBeAssigned, dataFreshness } from '../../utils/fintech';
import { formatNative } from '../../utils/currency';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

/**
 * The money with no job yet.
 *
 * `cash` is what the reader has. `budgets` are the envelopes that
 * have claimed part of it. `spent` is what has already gone out this
 * period, so it is not available either.
 */
export function ReadyToBeAssignedBanner({
  cash = 0,
  budgets = [],
  spent = 0,
  onAssign,
  compact = false,
}) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  const result = useMemo(() => {
    const allocated = (budgets || []).reduce(
      (sum, budget) => sum + (Number(budget.amount) || 0),
      0
    );
    return readyToBeAssigned({ cashBalance: cash, allocated, spent });
  }, [cash, budgets, spent]);

  // Nothing to say when there is no money and no budget.
  if (result.cash <= 0 && result.allocated <= 0) return null;

  const over = result.overcommitted;
  const Icon = over ? AlertCircle : Sparkles;

  return (
    <div
      className={`fintech-banner ${over ? 'fintech-banner--over' : 'fintech-banner--free'}`}
      role="status"
      data-testid="ready-to-be-assigned"
    >
      <span className="fintech-banner__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="fintech-banner__body">
        <p className="fintech-banner__title">
          {over ? W.banner_over_title : W.banner_free_title}
        </p>
        {!compact && (
          <p className="fintech-banner__text">
            {over ? W.banner_over_text : W.banner_free_text}
          </p>
        )}
      </div>
      <div className="fintech-banner__amount">
        <span className="fintech-banner__figure">
          {formatNative(Math.abs(result.free), 'IDR')}
        </span>
        <span className="fintech-banner__caption">
          {over ? W.banner_over_caption : W.banner_free_caption}
        </span>
      </div>
      {onAssign && !over && (
        <button
          type="button"
          className="fintech-banner__action"
          onClick={onAssign}
        >
          {W.banner_action}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * The trust indicator.
 *
 * Green when the data was touched a moment ago and nothing is waiting
 * to be looked at. Amber when something is waiting. The reader can fix
 * it in one click.
 */
export function DataAccuracyIndicator({
  updatedAt = null,
  pendingReview = 0,
  onCorrect,
  compact = false,
}) {
  const { language } = useTranslation();
  const W = batch3[language]?.fintech || {};

  const state = useMemo(
    () => dataFreshness({ updatedAt, pendingReview }),
    [updatedAt, pendingReview]
  );

  const Icon = state.accurate ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={`fintech-trust ${state.accurate ? 'fintech-trust--ok' : 'fintech-trust--review'}`}
      role="status"
      data-testid="data-accuracy"
    >
      <span className="fintech-trust__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="fintech-trust__label">
        {state.accurate ? W.trust_accurate : W.trust_needs_review}
      </span>
      {!compact && (
        <span className="fintech-trust__time">
          {state.pending > 0
            ? W.trust_pending.replace('%count%', String(state.pending))
            : W.trust_updated}
        </span>
      )}
      {onCorrect && !state.accurate && (
        <button type="button" className="fintech-trust__action" onClick={onCorrect}>
          {W.trust_correct}
        </button>
      )}
    </div>
  );
}

/**
 * Both banners, in the order they should be read.
 */
export function TrustStrip(props) {
  return (
    <div className="fintech-trust-strip" data-testid="trust-strip">
      <DataAccuracyIndicator {...props.trust} />
      {props.ready && <ReadyToBeAssignedBanner {...props.ready} />}
    </div>
  );
}

export default ReadyToBeAssignedBanner;
