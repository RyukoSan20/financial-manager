/*
 * The pills of the ratios.
 *
 * A ratio is a number with a meaning, and the meaning is what the
 * reader needs: "25% of your income is being saved" is a fact, while
 * "25" on its own is a number they have to interpret.
 *
 * So each ratio is a row: the name of the ratio, the value, and a
 * mark that says whether the value is good. The mark is the status
 * the server worked out, not a guess made here - the server knows the
 * thresholds, and a second copy of them in the browser would drift
 * away from the first.
 *
 * The mark is a small pastel badge, not a sentence. It used to be a
 * long line of text on the right of the row, and the card was not
 * wide enough for it: "Perlu diperbaiki" was cut into "Per / dip" at
 * the edge, and a badge that cannot say what it is saying is worse
 * than no badge.
 *
 * So the status is a compact pill that cannot be cut, and the row
 * wraps rather than pushing the badge off the edge.
 */

import { useTranslation } from '../../i18n';

/**
 * The four states the server uses, and the mark for each.
 *
 * They are written out in full rather than built at run time, so
 * Tailwind's scanner sees the class and it reaches the stylesheet.
 */
const STATUS_CLASS = {
  excellent: 'wellness-pill__dot--excellent',
  good: 'wellness-pill__dot--good',
  warning: 'wellness-pill__dot--warning',
  danger: 'wellness-pill__dot--danger',
};

/* The pastel badge for the status.

   Written out in full for each state, so the scanner sees the class
   and it reaches the stylesheet. */
const STATUS_BADGE_CLASS = {
  excellent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  good: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
};

const STATUS_KEY = {
  excellent: 'health_coach.status_excellent',
  good: 'health_coach.status_good',
  warning: 'health_coach.status_warning',
  danger: 'health_coach.status_danger',
};

/**
 * The number, written the way the reader reads numbers.
 */
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

const months = (value) => Number(value || 0).toFixed(1);

/**
 * One row.
 *
 * The value is shown by the caller, because the three ratios are
 * written differently: two of them are percentages and one of them is
 * a number of months. What the row adds is the name and the mark.
 */
const Pill = ({ label, value, status, detail }) => {
  const { t } = useTranslation();
  const safeStatus = STATUS_CLASS[status] ? status : '';
  const statusText = status ? t(STATUS_KEY[status], '') : '';

  return (
    <div
      className="wellness-pill flex items-center justify-between gap-3 flex-wrap"
      title={detail || label}
    >
      {/* The name of the ratio and the value, on one side. */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`wellness-pill__dot ${STATUS_CLASS[safeStatus] || ''}`}
          aria-hidden="true"
        />
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
          {label}
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap shrink-0">
          {value}
        </span>
      </div>

      {/* The mark.

          A compact pill that holds its words. `shrink-0` keeps it
          whole, and the row wraps rather than clipping it. */}
      {statusText ? (
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 whitespace-nowrap ${
            STATUS_BADGE_CLASS[safeStatus] || 'bg-gray-50 text-gray-600 dark:bg-white/10 dark:text-gray-300'
          }`}
        >
          {statusText}
        </span>
      ) : null}
    </div>
  );
};

/**
 * The three ratios, as rows.
 *
 * The ratios themselves come in as the objects the server sent, so
 * nothing here works anything out that the server has not already
 * worked out.
 */
export default function FinancialRatioPills({
  savingsRatio,
  emergencyFund,
  dsrRatio,
  className = '',
}) {
  const { t } = useTranslation();

  if (!savingsRatio && !emergencyFund && !dsrRatio) return null;

  const savingsValue = Number(savingsRatio?.value || 0);
  const emergencyValue = Number(emergencyFund?.value || 0);
  const dsrValue = Number(dsrRatio?.value || 0);

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <Pill
        label={t('health_coach.savings_ratio')}
        value={percent(savingsValue)}
        status={savingsRatio?.status}
        detail={savingsRatio?.description || ''}
      />
      <Pill
        label={t('health_coach.emergency_fund')}
        value={t('health_coach.months').replace('%value%', months(emergencyValue))}
        status={emergencyFund?.status}
        detail={emergencyFund?.description || ''}
      />
      <Pill
        label={t('health_coach.dsr_ratio')}
        value={percent(dsrValue)}
        status={dsrRatio?.status}
        detail={dsrRatio?.description || ''}
      />
    </div>
  );
}

export { FinancialRatioPills, Pill };
