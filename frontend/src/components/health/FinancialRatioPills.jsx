/*
 * The pills of the ratios.
 *
 * A ratio is a number with a meaning, and the meaning is what the
 * reader needs: "25% of your income is being saved" is a fact, while
 * "25" on its own is a number they have to interpret.
 *
 * So each pill carries three things: the name of the ratio, the
 * value, and a mark that says whether the value is good. The mark is
 * the status the server worked out, not a guess made here - the
 * server knows the thresholds, and a second copy of them in the
 * browser would drift away from the first.
 *
 * The dot is not the only signal. The word beside it says the same
 * thing in words, so a reader who cannot tell green from amber still
 * gets the answer.
 */

import { useTranslation } from '../../i18n';

/**
 * The four states the server uses, and the word for each.
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

const STATUS_TEXT_CLASS = {
  excellent: 'text-emerald-600 dark:text-emerald-300',
  good: 'text-sky-600 dark:text-sky-300',
  warning: 'text-amber-600 dark:text-amber-300',
  danger: 'text-rose-600 dark:text-rose-300',
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
 * One pill.
 *
 * The value is shown by the caller, because the three ratios are
 * written differently: two of them are percentages and one of them is
 * a number of months. What the pill adds is the label and the mark.
 */
const Pill = ({ label, value, status, detail }) => {
  const { t } = useTranslation();
  const safeStatus = STATUS_CLASS[status] ? status : '';
  const statusText = status ? t(STATUS_KEY[status], '') : '';

  return (
    <div className="wellness-pill" title={detail || label}>
      <span
        className={`wellness-pill__dot ${STATUS_CLASS[safeStatus] || ''}`}
        aria-hidden="true"
      />
      <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
        {value}
      </span>
      {statusText ? (
        <span
          className={`text-[11px] font-medium ${STATUS_TEXT_CLASS[safeStatus] || 'text-gray-500'}`}
        >
          {statusText}
        </span>
      ) : null}
    </div>
  );
};

/**
 * The three ratios, as pills.
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
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
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
