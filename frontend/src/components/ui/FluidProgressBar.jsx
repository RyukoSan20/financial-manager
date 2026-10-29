import { clsx } from 'clsx';

/**
 * A progress bar that fills like a liquid.
 *
 * The bar in the application slid from left to right, which reads
 * as a block being dragged into place. This one fills, and the
 * surface of the liquid moves.
 *
 * The width of the fill is set as a style, and the wave is drawn by
 * a pseudo-element inside it. The width animates on the compositor
 * because it is a transform-free layout change inside an element
 * that has its own overflow clip - but the wave itself is a
 * transform, so it never touches layout at all.
 *
 * A reader who has asked for less movement gets a plain bar. The
 * guard for that is in the stylesheet, because that is where the
 * animation lives.
 */
export default function FluidProgressBar({
  value,
  max = 100,
  colour = 'rgb(16 185 129)',
  size = 'md',
  className = '',
  trackClassName = '',
  label,
}) {
  const percentage = Math.min(100, Math.max(0, (max ? (value / max) * 100 : 0)));

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className={clsx('w-full', className)}>
      {label ? (
        <div className="flex justify-between mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span>{label}</span>
          <span className="tabular-nums">{percentage.toFixed(0)}%</span>
        </div>
      ) : null}

      {/*
        The track clips the wave. The wave is drawn by a
        pseudo-element that is wider than the bar, so without a clip
        on the track it would spread over the page.
      */}
      <div
        className={clsx(
          'relative w-full rounded-full overflow-hidden bg-gray-200/70 dark:bg-white/10',
          heights[size],
          trackClassName
        )}
      >
        <div
          className="money-liquid-fill h-full"
          style={{
            width: `${percentage}%`,
            '--money-liquid-colour': colour,
          }}
        />
      </div>
    </div>
  );
}
