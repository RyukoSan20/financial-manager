/**
 * A number that counts to its new value.
 *
 * The balance on the dashboard used to jump when the reader changed
 * the date filter or picked another account: the old number was gone
 * and the new one was there, in the same frame. The reader could see
 * that the number changed, but not how much it changed by, because
 * there was nothing to compare it with.
 *
 * So the number counts from the old value to the new one. The digits
 * stay in place while they move, because a column of money that
 * shifts sideways is harder to read than one that does not.
 *
 * Three things this component will not do:
 *
 * - it will not count when the reader has asked for less movement;
 * - it will not count when the two numbers are the same, or when the
 *   difference is too small to see;
 * - it will not count a number that is not a number.
 *
 * The arithmetic is in `utils/countUp.js`, with no React in it, so it
 * can be checked by a script.
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

export default function AnimatedNumber({
  value,
  decimals,
  duration = COUNT_UP_DURATION_MS,
  format = (n) => String(n),
  className = '',
}) {
  const target = Number(value);
  const finite = Number.isFinite(target);

  // How many decimals to show. The caller can say, and otherwise it
  // is worked out from the value itself.
  const places = decimals === undefined ? decimalsOf(target) : decimals;

  // The number that is on the screen right now. It starts at the
  // value itself, so a number that is there from the start is not
  // counted from zero.
  const [shown, setShown] = useState(finite ? target : 0);

  // The value the count started from, kept in a ref so that a rerender
  // in the middle of a count does not restart it.
  const fromRef = useRef(finite ? target : 0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!finite) {
      setShown(0);
      return undefined;
    }

    const from = fromRef.current;

    // Nothing to count through: the number is the same, or the
    // difference is too small to see, or the reader has asked for
    // less movement. The number is simply set.
    if (!shouldAnimate(from, target, places) || prefersReducedMotion()) {
      fromRef.current = target;
      setShown(target);
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
      }
    };

    frameRef.current = requestAnimationFrame(step);

    // If the component goes away in the middle of the count, the
    // frame is cancelled, so the count does not keep running behind
    // a page that is no longer there.
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, places, duration]);

  return (
    <span className={`animated-number tabular-nums ${className}`.trim()}>
      {format(shown)}
    </span>
  );
}
