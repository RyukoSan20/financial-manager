/**
 * A bar that fills to where it should be.
 *
 * A progress bar that is already full when the page appears tells the
 * reader nothing about how it got there. A bar that fills from nothing
 * to its place tells them two things at once: where the line is, and
 * that the line moved.
 *
 * The bar's colour says whether the line is good news:
 *
 * - under eighty per cent, it is calm - green when it is a spending
 *   bar, purple when it is a saving;
 * - over eighty per cent it is amber, because it is getting close;
 * - over a hundred per cent it is coral and it pulses, because the
 *   money is spent and the reader needs to know that now.
 *
 * And there is a marker on the bar for where the reader *should* be
 * today. "Hari 8 dari 30" means the bar is not just about how much
 * has been spent, but how much of the month has gone. Spending a
 * third of the money in the first third of the month is on plan;
 * spending half of it in the first third is not, even though half is
 * under the limit.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  BAR_STATE_CLASSES,
  barColorState,
} from '../../utils/progressColors';

// The colours are in `utils/progressColors.js`, with no React in it,
// so they can be checked by a script. They are re-exported here so
// that a caller can ask for them from either place.
export { BAR_STATE_CLASSES, barColorState };

/**
 * @param {object} props
 * @param {number} props.percent        How full, from 0 to 100 or more
 * @param {string} [props.label]        The name of the bar
 * @param {string} [props.overText]     What is written when it is over
 * @param {boolean} [props.over]        Whether the bar measures a limit
 * @param {number} [props.day]          Which day of the period it is
 * @param {number} [props.totalDays]    How many days the period has
 * @param {string} [props.className]
 */
export default function AnimatedProgressBar({
  percent = 0,
  label,
  overText,
  over = true,
  day,
  totalDays,
  className = '',
}) {
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);

  const target = useMemo(() => {
    const value = Number(percent);
    if (!Number.isFinite(value)) return 0;
    // A bar that goes past its end is full - the reader needs to see
    // that it is over, which the colour says.
    return Math.max(0, Math.min(100, value));
  }, [percent]);

  useEffect(() => {
    // The first time, the bar is drawn empty and then fills. That is
    // the point of it: the reader sees where the line is.
    if (!mounted.current) {
      mounted.current = true;
      const frame = requestAnimationFrame(() => setWidth(target));
      return () => cancelAnimationFrame(frame);
    }

    setWidth(target);
    return undefined;
  }, [target]);

  const state = barColorState(percent, { over });
  const fillClass = BAR_STATE_CLASSES[state] || BAR_STATE_CLASSES.idle;

  // Where the reader should be, by the days that have gone.
  const pacingPercent =
    Number.isFinite(day) && Number.isFinite(totalDays) && totalDays > 0
      ? Math.min(100, (day / totalDays) * 100)
      : null;

  const showPacing = pacingPercent !== null && pacingPercent > 0 && pacingPercent < 100;

  return (
    <div className={`w-full ${className}`} data-testid="animated-progress-bar">
      {(label || overText) && (
        <div className="flex items-baseline justify-between gap-2 mb-1">
          {label ? (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
              {label}
            </span>
          ) : (
            <span />
          )}
          {overText ? (
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0">
              {overText}
            </span>
          ) : null}
        </div>
      )}

      <div
        className="relative w-full h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(Number(percent) || 0)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || undefined}
        data-state={state}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${fillClass}`}
          style={{ width: `${width}%` }}
          data-testid="animated-progress-fill"
          data-percent={Math.round(Number(percent) || 0)}
        />

        {/* Where the reader should be today. */}
        {showPacing ? (
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-500/70 dark:bg-gray-300/70"
            style={{ left: `${pacingPercent}%` }}
            aria-hidden="true"
            data-testid="pacing-marker"
          />
        ) : null}
      </div>
    </div>
  );
}

export { AnimatedProgressBar };
