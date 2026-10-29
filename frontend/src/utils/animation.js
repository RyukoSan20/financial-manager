/**
 * The animation helpers.
 *
 * These are the small pieces of motion logic that are worth having in
 * one place, because the rules behind them are the same everywhere:
 *
 * - the motion answers a gesture, and nothing moves on its own
 *   except the one thing that is meant to be alive;
 * - a number that changes counts to its new value rather than
 *   jumping (that is `AnimatedNumber`, and the arithmetic is in
 *   `utils/countUp.js`);
 * - a reader who has asked the system for less movement gets none of
 *   it. That is a system setting, so it is read from the browser and
 *   it is checked by every piece of motion in the application.
 *
 * The durations live in `styles/motion.css` and `styles/money.css`,
 * not here. A value in a component would not match the values
 * anywhere else, and the point of a token is that it is shared.
 */

import { useEffect, useState } from 'react';
import { buildFlag } from './featureFlags';

/**
 * The durations, in the same values the stylesheets use.
 *
 * These are here for the cases where a duration has to be computed
 * rather than written into a stylesheet - a stagger, for instance.
 * When the number can simply be written in the stylesheet, it
 * should be.
 */
export const MOTION = {
  press: 150,
  settle: 240,
  slow: 900,
};

/**
 * The easing that fits money.
 *
 * It starts fast and settles slowly, so a movement feels like it is
 * coming to rest rather than like it stopped. A symmetric ease reads
 * as mechanical.
 */
export const EASE_OUT_SOFT = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const EASE_IN_OUT_SOFT = 'cubic-bezier(0.65, 0, 0.35, 1)';

/**
 * Has the reader asked for less movement?
 *
 * This is the system setting, so it is read from the browser. A
 * reader who has asked for less movement gets none of it - no
 * counts, no leans, no waves.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Is the money layer on?
 *
 * The money layer is the one that gives a surface its feel: glass,
 * a card that leans towards the pointer, a liquid fill. It is off by
 * default, behind a build switch.
 */
export function moneyLayerOn() {
  return buildFlag('UI_MONEY');
}

/**
 * The same question, but asked as a React hook, so that turning the
 * switch on changes the page straight away.
 */
export function useMoneyLayer() {
  const [on, setOn] = useState(moneyLayerOn);

  useEffect(() => {
    setOn(moneyLayerOn());
  }, []);

  return on;
}

/**
 * The same question, asked about the reader's motion setting.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    // Safari before 14 only has the old listener API.
    if (query.addEventListener) query.addEventListener('change', onChange);
    else query.addListener(onChange);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', onChange);
      else query.removeListener(onChange);
    };
  }, []);

  return reduced;
}

/**
 * A stagger, for a list that arrives in order.
 *
 * The cap matters: a list of two hundred rows would otherwise take
 * five seconds to finish arriving, and the reader is waiting for
 * the last row, not for the animation.
 */
export function staggerDelay(index, step = 24, cap = 12) {
  return Math.min(index, cap) * step;
}

/**
 * The lean of a card, from where the pointer is.
 *
 * The numbers are the maximum lean in degrees and the fraction of
 * the card's size the pointer is at. Both are small on purpose: a
 * card that swings is a toy, and this is a bank balance.
 */
export function tiltFor(pointerX, pointerY, max = 5) {
  return {
    rotateX: (0.5 - pointerY) * max * 2,
    rotateY: (pointerX - 0.5) * max * 2,
  };
}
