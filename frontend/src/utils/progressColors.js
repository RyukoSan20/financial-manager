/**
 * The colour of a progress bar.
 *
 * A bar that measures a limit - spending, a budget - says something
 * different as it fills:
 *
 * - under eighty per cent, it is calm. Green, because there is room.
 * - over eighty per cent, it is amber. Close now.
 * - over a hundred per cent, it is coral and it pulses. The money is
 *   spent and the reader needs to know that now.
 *
 * A bar that measures a gain - savings, a score - never goes over, so
 * it stays green and only turns amber when it is nearly full.
 *
 * The arithmetic is here, with no React in it, so it can be checked by
 * a script. The component that draws it is in
 * `components/ui/AnimatedProgressBar.jsx`.
 */

/**
 * The state of the bar.
 *
 * `over` is for a bar that measures a limit. A bar that measures a
 * gain never goes over, so it stays green.
 */
export function barColorState(percent, { over = true } = {}) {
  const value = Number(percent);

  // A number that is not a number has no state. It is drawn empty,
  // which is honest: the reader is not told a number that is not
  // there.
  if (!Number.isFinite(value)) return 'idle';

  if (over && value > 100) return 'over';
  if (value > 80) return 'warn';
  if (value > 0) return 'good';
  return 'idle';
}

/**
 * The classes for each state.
 */
export const BAR_STATE_CLASSES = {
  idle: 'bg-gray-300 dark:bg-gray-600',
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  over: 'bg-rose-500 animate-pulse',
};

/**
 * The colour of a day on the spending calendar.
 *
 * The days are coloured by rank among the days that have spending on
 * them, so the reader always sees a spread from the quietest day to
 * the worst one. A reader whose worst day was sixty thousand and a
 * reader whose worst day was six million are both shown their worst
 * day, which is the point of the calendar.
 */
export function heatLevel(amount, max, hasSpending) {
  if (!hasSpending || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return 'empty';
  }
  const value = Number(amount);
  const highest = Number(max);
  if (!highest || !Number.isFinite(highest) || value >= highest) return 'highest';
  if (value >= highest * 0.6) return 'high';
  if (value >= highest * 0.25) return 'medium';
  return 'low';
}

export const HEAT_CLASSES = {
  empty: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
  low: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200',
  medium: 'bg-amber-200 dark:bg-amber-900/50 text-amber-950 dark:text-amber-100',
  high: 'bg-orange-300 dark:bg-orange-900/60 text-orange-950 dark:text-orange-100',
  highest: 'bg-rose-400 dark:bg-rose-900/70 text-white font-bold ring-2 ring-rose-500',
};

export default {
  barColorState,
  BAR_STATE_CLASSES,
  heatLevel,
  HEAT_CLASSES,
};
