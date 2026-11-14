/*
 * The pills of the ratios.
 *
 * A ratio is a number with a meaning, and the meaning is what the
 * reader needs: "25% of your income is being saved" is a fact, while
 * "25" on its own is a number they have to interpret.
 *
 * Each ratio used to be one row that wrapped everything into the
 * same line - the name, the value, the target, the status - and on
 * a narrow phone the value and the target ran into each other: the
 * value and its target badge were mashed into one unreadable string
 * with no space between them.
 *
 * So each ratio is now its own tactile card, with three rows that
 * can never collide because each lives in its own flex line:
 *
 *   Row 1: the icon and name on the left, the status pill on the
 *          right.
 *   Row 2: the big animated value on the left, the muted target
 *          badge on the right - in its own container, never
 *          concatenated into the same string as the value.
 *   Row 3: a progress bar with a pin marking where the ideal target
 *          sits, so the reader sees at a glance how close they are.
 *
 * The status mark is the one the server worked out, not a guess made
 * here - the server knows the thresholds, and a second copy of them
 * in the browser would drift away from the first.
 */

import { PiggyBank, ShieldHalf, Scale } from 'lucide-react';
import { useTranslation } from '../../i18n';
import CountUpNumber from '../ui/CountUpNumber';

/**
 * The four states the server uses, and the mark for each.
 */
const STATUS_BADGE_CLASS = {
  excellent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  good: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
};

const BAR_FILL_CLASS = {
  excellent: 'bg-emerald-500',
  good: 'bg-sky-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  '': 'bg-gray-300 dark:bg-gray-600',
};

const STATUS_KEY = {
  excellent: 'health_coach.status_excellent',
  good: 'health_coach.status_good',
  warning: 'health_coach.status_warning',
  danger: 'health_coach.status_danger',
};

/** The number, written the way the reader reads numbers. */
const percent = (value) => Number(value || 0);
const months = (value) => Number(value || 0);

/**
 * Where the bar is filled to, and where the target pin sits.
 *
 * Both are worked out from the thresholds the server sent with the
 * ratio (`ideal_min` / `ideal_max`) - never from a copy of those
 * numbers kept here, which would drift away from the verdict the
 * server already made.
 *
 * Two shapes of target, and the bar is drawn differently for each:
 *
 * - "at least this much" (savings, emergency fund): the pin marks
 *   `ideal_min`, and the scale runs to a little past it so a reader
 *   who has cleared the target still sees the pin inside the bar.
 * - "at most this much" (DSR): the pin marks `ideal_max`, and more
 *   is worse, so the bar fills towards the pin rather than past it.
 *
 * When the server sent no thresholds, there is nothing honest to
 * draw, so the pin is left off rather than invented.
 */
const barGeometry = (ratio, value) => {
  const min = Number(ratio?.ideal_min);
  const max = Number(ratio?.ideal_max);
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;

  // "At most" targets start their ideal band at zero.
  const isCeiling = hasMax && (!hasMin || min === 0);
  const target = isCeiling ? max : hasMin ? min : null;
  if (target == null) return { progressPercent: 0, markerPercent: null };

  // The scale runs a quarter past the target, so the pin lands at
  // 80% of the bar and a value beyond it still has room to show.
  const scale = target * 1.25;
  const clamp = (n) => Math.max(0, Math.min(100, n));
  return {
    progressPercent: clamp((Number(value || 0) / scale) * 100),
    markerPercent: clamp((target / scale) * 100),
  };
};

/**
 * One ratio, as its own tactile card.
 *
 * `progressPercent` is how full the bar is drawn (0-100, already
 * clamped by the caller); `markerPercent` is where the pin for the
 * ideal target sits on that same scale. The two are independent, so
 * a ratio that is far past its target still draws a full bar with the
 * pin visible inside it rather than off the edge.
 */
const RatioCard = ({
  icon,
  label,
  value,
  suffix,
  status,
  detail,
  benchmarkLabel,
  progressPercent,
  markerPercent,
}) => {
  const { t } = useTranslation();
  const safeStatus = STATUS_BADGE_CLASS[status] ? status : '';
  const statusText = status ? t(STATUS_KEY[status], '') : '';
  const barFill = BAR_FILL_CLASS[safeStatus] || BAR_FILL_CLASS[''];
  const clampedProgress = Math.max(0, Math.min(100, progressPercent ?? 0));
  const clampedMarker = markerPercent == null ? null : Math.max(2, Math.min(98, markerPercent));

  return (
    <div
      className="wellness-ratio-card flex flex-col gap-2 p-4 pb-6 leading-relaxed rounded-2xl border border-[#EAE6DF] dark:border-slate-700 bg-white/70 dark:bg-slate-800/60"
      title={detail || label}
      data-testid="ratio-card"
    >
      {/* Row 1: the icon and the name, left; the status pill, right. */}
      <div className="flex items-center justify-between gap-3" data-testid="ratio-row-head">
        <span className="flex items-center gap-2 min-w-0 text-xs font-bold uppercase tracking-[0.06em] text-[#52796F] dark:text-emerald-300">
          <span className="shrink-0" aria-hidden="true">{icon}</span>
          <span className="whitespace-normal break-words">{label}</span>
        </span>
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

      {/* Row 2: the big value, then the target. On a narrow screen the
          two stack onto separate lines: both are whitespace-nowrap, so
          side by side at 390px they could not overlap but they did
          overflow the card, which is what pushed "58.8 bulan" and
          "Target ideal: 3-6 bulan" into each other visually. */}
      <div
        className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 mt-1.5"
        data-testid="ratio-row-value"
      >
        <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-[#1F2421] dark:text-[#FAF9F6] whitespace-nowrap">
          <CountUpNumber value={value} from={0} format={(n) => n.toFixed(1)} />
          {suffix}
        </p>
        {benchmarkLabel ? (
          <span
            className="self-start text-[11px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap px-2 py-0.5 rounded-full bg-[#F4F1EA] dark:bg-slate-700/60"
            data-testid="ratio-benchmark"
          >
            {benchmarkLabel}
          </span>
        ) : null}
      </div>

      {/* Row 3: the scrubbing progress bar, with a pin marking the
          ideal target so the reader sees where they sit relative to
          it at a glance. */}
      <div className="mt-2.5 relative" data-testid="ratio-row-bar">
        <div className="motion-scrub-bar h-2.5 rounded-full bg-[#EAE6DF] dark:bg-slate-700 overflow-hidden relative">
          <div
            className={`motion-scrub-bar__fill h-full rounded-full ${barFill}`}
            style={{ width: `${clampedProgress}%` }}
          />
          {clampedMarker != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#2F4842] dark:bg-white/80 rounded-full"
              style={{ left: `${clampedMarker}%` }}
              aria-hidden="true"
              data-testid="ratio-target-marker"
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * The three ratios, as cards.
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

  const savingsValue = percent(savingsRatio?.value);
  const emergencyValue = months(emergencyFund?.value);
  const dsrValue = percent(dsrRatio?.value);

  return (
    <div className={`flex flex-col gap-3 ${className}`.trim()}>
      <RatioCard
        icon={<PiggyBank className="w-3.5 h-3.5" aria-hidden="true" />}
        label={t('health_coach.savings_ratio')}
        value={savingsValue}
        suffix="%"
        status={savingsRatio?.status}
        detail={savingsRatio?.description || ''}
        benchmarkLabel={t('health_coach.benchmark_savings', 'Target ideal: ≥ 20%')}
        {...barGeometry(savingsRatio, savingsValue)}
      />
      <RatioCard
        icon={<ShieldHalf className="w-3.5 h-3.5" aria-hidden="true" />}
        label={t('health_coach.emergency_fund')}
        value={emergencyValue}
        suffix={` ${t('health_coach.months_unit', 'bulan')}`}
        status={emergencyFund?.status}
        detail={emergencyFund?.description || ''}
        benchmarkLabel={t('health_coach.benchmark_emergency', 'Target ideal: 3-6 bulan')}
        {...barGeometry(emergencyFund, emergencyValue)}
      />
      <RatioCard
        icon={<Scale className="w-3.5 h-3.5" aria-hidden="true" />}
        label={t('health_coach.dsr_ratio')}
        value={dsrValue}
        suffix="%"
        status={dsrRatio?.status}
        detail={dsrRatio?.description || ''}
        benchmarkLabel={t('health_coach.benchmark_dsr', 'Target ideal: ≤ 30%')}
        {...barGeometry(dsrRatio, dsrValue)}
      />
    </div>
  );
}

export { FinancialRatioPills, RatioCard };
