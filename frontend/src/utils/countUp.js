/**
 * The arithmetic of a number that counts to its new value.
 *
 * A balance on the dashboard changes when the reader changes the date
 * filter or picks another account. It used to jump: the old number was
 * replaced by the new one in one frame. The reader saw the number
 * change, but did not see *what* it changed from, so the size of the
 * change was not readable.
 *
 * So the number counts. It moves from the old value to the new one
 * over a short time, and the digits stay in place while they move.
 *
 * This file holds the arithmetic, with no React in it, so it can be
 * checked by a script. The component that draws it is in
 * `components/common/AnimatedNumber.jsx`.
 */

/**
 * How long a number takes to reach its new value.
 *
 * Short enough that the reader is not waiting for it, long enough to
 * see the direction of the change. Six hundred milliseconds is about
 * the time it takes to read a number and look up.
 */
export const COUNT_UP_DURATION_MS = 600;

/**
 * The easing.
 *
 * `easeOutCubic` starts fast and settles slowly, so the number
 * arrives rather than stops. A linear count looks mechanical, and a
 * number that overshoots and comes back looks like it is lying.
 */
export function easeOutCubic(progress) {
  const t = clampProgress(progress);
  return 1 - (1 - t) ** 3;
}

/**
 * Keep the progress between nothing and everything.
 *
 * A progress below zero or above one would take the count outside the
 * two values it is between, so it is pulled back in.
 */
export function clampProgress(progress) {
  const value = Number(progress);
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * The number at a point in the count.
 *
 * `from` is the old value, `to` is the new one, and `progress` is how
 * far along the count is, from nothing to everything.
 *
 * The result is rounded to the number of decimals the currency has, so
 * a rupiah count never shows a fraction of a rupiah. The rounding is
 * done on the value and not on the progress, so the count never
 * arrives at a number that is not the number it was going to.
 */
export function countUpValue(from, to, progress, decimals = 0) {
  const start = Number(from) || 0;
  const end = Number(to) || 0;
  const eased = easeOutCubic(progress);
  const value = start + (end - start) * eased;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Is this a change worth counting through?
 *
 * Two numbers that are the same do not need a count, and neither does
 * a number that is not a number. A change of less than the smallest
 * visible step is not a change the reader can see, so counting it
 * would be movement for its own sake.
 */
export function shouldAnimate(from, to, decimals = 0) {
  const start = Number(from);
  const end = Number(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start === end) return false;
  const factor = 10 ** decimals;
  return Math.abs(end - start) * factor >= 1;
}

/**
 * The number of decimals a value is worth showing.
 *
 * A whole number shows none, so a rupiah amount is not written with
 * "0.00" at the end of it.
 */
export function decimalsOf(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (Number.isInteger(number)) return 0;
  const text = String(number);
  const point = text.indexOf('.');
  if (point < 0) return 0;
  return Math.min(6, text.length - point - 1);
}

export default {
  COUNT_UP_DURATION_MS,
  easeOutCubic,
  clampProgress,
  countUpValue,
  shouldAnimate,
  decimalsOf,
};
