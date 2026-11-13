/**
 * The Kakeibo hover board.
 *
 * A small stationery postcard that opens beside whatever it belongs
 * to. It is the tooltip of the application: a title, a line under it,
 * a badge, a few figures, and sometimes a button.
 *
 * Two things it has to do well:
 *
 * - it must never be clipped off the edge of the screen, so it
 *   measures where its anchor is and flips to the other side when it
 *   would run off;
 * - it must feel like paper, not like a tooltip bubble - a warm
 *   cream card with a drawn outline, the way a note card is.
 *
 * The colours are the Kakeibo ones: a warm cream surface, a warm
 * stationery brown outline, and a sage accent.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/**
 * How close to the right edge the anchor has to be before the board
 * flips to the other side. Measured from the right of the window.
 */
const EDGE_MARGIN = 280;

const POSITIONS = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * The board.
 *
 * `title` is the headline. `subtitle` is the one line under it.
 * `badge` is the small tag in the corner. `metrics` is a list of
 * `{ label, value }` pairs. `actionLabel` and `onAction` are the
 * button. `position` is where it opens: `top`, `bottom`, `left` or
 * `right`.
 */
export function KakeiboHoverBoard({
  title,
  subtitle,
  badge,
  metrics = [],
  actionLabel,
  onAction,
  position = 'top',
  children,
  className = '',
  visible = true,
}) {
  const boardRef = useRef(null);
  const [flip, setFlip] = useState(false);

  // The board opens away from the edge of the window. The anchor is
  // the nearest positioned ancestor; when there is none, the window
  // itself is the edge to stay away from.
  const checkEdge = useCallback(() => {
    const node = boardRef.current;
    if (!node) return;
    const anchor = node.offsetParent;
    const rect = anchor && anchor.getBoundingClientRect
      ? anchor.getBoundingClientRect()
      : null;
    const boardRect = node.getBoundingClientRect();
    const right = rect ? rect.right : window.innerWidth;
    const left = rect ? rect.left : 0;
    // Near the right edge the board would hang off, so it opens to
    // the left instead. The same on the other side.
    setFlip(right + boardRect.width > window.innerWidth - EDGE_MARGIN && right > window.innerWidth / 2);
    if (left < EDGE_MARGIN && left < window.innerWidth / 2) {
      // Near the left edge it opens to the right; handled by the
      // alignment classes, so nothing to do here.
    }
  }, []);

  // The measurement is a layout effect, but the board is also drawn on
  // the server, where a layout effect cannot run. React warns about
  // that on the server, so the effect is swapped for a passive one
  // there.
  const canMeasure = typeof window !== 'undefined' && typeof document !== 'undefined';
  const MeasureEffect = canMeasure ? useLayoutEffect : useEffect;

  MeasureEffect(() => {
    if (!visible || !canMeasure) return undefined;
    checkEdge();
    window.addEventListener('resize', checkEdge);
    window.addEventListener('scroll', checkEdge, true);
    return () => {
      window.removeEventListener('resize', checkEdge);
      window.removeEventListener('scroll', checkEdge, true);
    };
  }, [visible, checkEdge, canMeasure]);

  useEffect(() => {
    if (!visible || !canMeasure) return undefined;
    // The board is measured again when it opens, because the content
    // decides how wide it is.
    const frame = requestAnimationFrame(checkEdge);
    return () => cancelAnimationFrame(frame);
  }, [visible, title, subtitle, metrics, checkEdge, canMeasure]);

  if (!visible) return null;

  const base = POSITIONS[position] || POSITIONS.top;
  // The flipped board opens to the left of its anchor rather than
  // centred on it, so it never hangs off the right of the screen.
  const aligned = flip
    ? base.replace('left-1/2 -translate-x-1/2', 'right-0 translate-x-0')
    : base;

  return (
    <div
      ref={boardRef}
      data-kakeibo-hover-board
      role="tooltip"
      // The board is also how the companion speaks, so it announces
      // what it says to a screen reader.
      aria-live="polite"
      className={clsx(
        'kanahei-board absolute z-40 min-w-[200px] max-w-[260px] whitespace-normal break-words',
        'rounded-[18px] border-[1.5px] border-[#4A3F35] dark:border-[#3D5A52]',
        'bg-[#FFFDF9] dark:bg-[#1E2624] text-[#2D312E] dark:text-[#ECEFEC]',
        'px-4 py-3 shadow-[0_10px_26px_-4px_rgba(74,63,53,0.14)]',
        'opacity-0 translate-y-1',
        'transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        'animate-[kanaheiBoardIn_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]',
        aligned,
        className
      )}
    >
      {badge ? (
        <span className="inline-flex items-center rounded-full bg-[#D8F3DC] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1B3B32]">
          {badge}
        </span>
      ) : null}

      {title ? (
        <p className="mt-1.5 text-sm font-bold leading-snug" data-board-title>
          {title}
        </p>
      ) : null}

      {subtitle ? (
        <p className="mt-1 text-xs leading-relaxed text-[#5C6460] dark:text-[#9DB5A8]" data-board-subtitle>
          {subtitle}
        </p>
      ) : null}

      {metrics.length ? (
        <dl className="mt-2.5 space-y-1 border-t border-dashed border-[#EAE6DF] dark:border-[#2A332E] pt-2.5">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline justify-between gap-3">
              <dt className="truncate text-[11px] text-[#5C6460] dark:text-[#9DB5A8]">{metric.label}</dt>
              <dd className="shrink-0 text-[11px] font-bold tabular-nums text-[#2F4842] dark:text-[#D8F3DC]">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children ? <div className="mt-2.5 text-xs leading-relaxed">{children}</div> : null}

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex w-full items-center justify-center rounded-full border-[1.5px] border-[#4A3F35] bg-[#F4F1EA] px-3 py-1.5 text-[11px] font-bold text-[#2D312E] transition-transform duration-150 hover:-translate-y-px active:scale-95 dark:border-[#3D5A52] dark:bg-[#26312D] dark:text-[#ECEFEC]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default KakeiboHoverBoard;
