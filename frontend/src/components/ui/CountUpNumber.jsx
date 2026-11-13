/**
 * A number that rolls to its new value.
 *
 * A number that changes from one value to another, with the old one
 * still there for a moment, is a number the reader can follow. A
 * number that is simply replaced is a number the reader has to notice
 * and then read again.
 *
 * So the number counts: it starts at the old value, moves to the new
 * one over six hundred milliseconds, and eases out at the end so it
 * settles rather than stops.
 *
 * The digits are in a fixed-width font, so the number does not shift
 * sideways as it counts. A number whose width changes while it rolls
 * is a number the eye has to chase.
 *
 * The arithmetic is the same one the dashboard's balance uses - it is
 * in `utils/countUp.js`, with no React in it, so it can be checked by
 * a script. This is the same idea with the formatting in the caller's
 * hands, so that a card can roll a rupiah amount, a percentage or a
 * score without each of them growing its own copy of the easing.
 */

import { useEffect, useRef, useState } from 'react';

import {
  COUNT_UP_DURATION_MS,
  countUpValue,
  decimalsOf,
  shouldAnimate,
} from '../../utils/countUp';

/**
 * Has the reader asked for less movement?
 *
 * This is the system setting, so it is read from the browser. A
 * reader who has asked for less movement gets the number straight
 * away, with no count at all.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * @param {object} props
 * @param {number} props.value       The number to show
 * @param {number} [props.duration]   How long the roll takes, in ms
 * @param {number} [props.decimals]   How many decimals to show
 * @param {Function} [props.format]   How the number is written
 * @param {string} [props.className]
 * @param {Function} [props.onDone]   Called when the roll finishes
 */
export default function CountUpNumber({
  value = 0,
  duration = COUNT_UP_DURATION_MS,
  decimals,
  format = (n) => String(n),
  className = '',
  onDone,
  // Where the count starts from, when it is not the old value.
  //
  // A number that changes from one value to another starts at the old
  // one, because the old one is what was on the screen. A number that
  // appears for the first time - a score, a total that was never
  // there - has no old value, and starting at the new one means it
  // simply appears. Saying where to start from lets it count up from
  // nothing instead.
  from,
}) {
  const target = Number(value);
  const finite = Number.isFinite(target);

  // How many decimals to show. The caller can say, and otherwise it
  // is worked out from the value itself.
  const places = decimals === undefined ? decimalsOf(target) : decimals;

  // Where the count starts from, and whether it has been told to
  // start from somewhere other than the number itself.
  const start = Number.isFinite(Number(from)) ? Number(from) : target;

  // The number that is on the screen right now.
  const [shown, setShown] = useState(finite ? start : 0);

  // Where the count starts from, kept in a ref so that a rerender in
  // the middle of a count does not restart it.
  const fromRef = useRef(finite ? start : 0);
  const frameRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!finite) {
      setShown(0);
      return undefined;
    }

    const from = fromRef.current;

    // Nothing to count through: the number is the same, the
    // difference is too small to see, or the reader has asked for
    // less movement. The number is simply set.
    if (from === target || !shouldAnimate(from, target, places) || prefersReducedMotion()) {
      fromRef.current = target;
      setShown(target);
      doneRef.current?.();
      return undefined;
    }

    let start = null;

    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);

      setShown(countUpValue(from, target, progress, places));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        // The count is over. The number is the number, not a number
        // that is very nearly it.
        frameRef.current = null;
        fromRef.current = target;
        setShown(target);
        doneRef.current?.();
      }
    };

    frameRef.current = requestAnimationFrame(step);

    // If the component goes away in the middle of the count, the
    // frame is cancelled, so the count does not keep running behind a
    // page that is no longer there.
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, places, duration, finite]);

  // The vertical slide that goes with the roll.
  //
  // The count alone changes the digits in place. When the whole set
  // of numbers on a page is replaced at once - a new date range on
  // the analytics page, a new chapter on the financial profile - the
  // reader needs to see that these are *new* numbers, not the old
  // ones twitching. So the number also slides up into place as it
  // rolls, and the slide replays every time the target changes.
  //
  // The replay works by changing the key on the element: React
  // remounts it, and a remounted element runs its entrance animation
  // again. A class toggled on the same element would not re-run.
  const rollRef = useRef(0);
  const lastTargetRef = useRef(target);
  if (lastTargetRef.current !== target) {
    lastTargetRef.current = target;
    rollRef.current += 1;
  }

  return (
    <span
      key={rollRef.current}
      className={`count-up-number motion-roll-in tabular-nums ${className}`.trim()}
      data-testid="count-up-number"
      data-value={finite ? target : 0}
    >
      {format(shown)}
    </span>
  );
}

export { CountUpNumber };
