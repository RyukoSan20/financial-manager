/**
 * The shape language of the aurora layer.
 *
 * The application used one shape for everything: a white rectangle
 * with a grey border, the same corners, the same shadow, the same
 * padding. A page built from twenty of those reads as a wall, because
 * there is nothing to tell the eye which thing is the point and which
 * thing is the detail.
 *
 * Aurora has a few tiers instead of one:
 *
 * - `hero` — the one number the page is about. Larger, deeper, and
 *   standing apart from everything else.
 * - `tile` — a metric that is read at a glance. Small, tinted with
 *   its own hue, with a coloured spine along the top edge.
 * - `panel` — a block of content. Quiet, with a hairline edge.
 * - `row` — one line of a list. Flat, no edge of its own.
 *
 * The hue is how a tile says what its number means: money in is teal,
 * money out is rose, a total is emerald. The reader's chosen accent
 * still draws the buttons and the active tab, so nothing they picked
 * is taken away from them.
 *
 * The switch is read in ONE place - `auroraIsOn` below - so it can be
 * honoured on one screen and ignored on another only by a mistake.
 */

import { clsx } from 'clsx';
import { buildFlag } from '../../utils/featureFlags.js';

/**
 * The aurora switch.
 *
 * A build switch, read from the environment when the bundle is built.
 * It is off unless the build turned it on, so a reader who has not
 * asked for the new shapes sees exactly what they saw before.
 */
export function auroraIsOn() {
  return buildFlag('UI_AURORA');
}

/**
 * The tiers.
 *
 * `hue` names the meaning of the number in the tile. It is written
 * out in full rather than built at runtime, so Tailwind's scanner sees
 * the class and it reaches the stylesheet.
 */
const HUES = {
  emerald: 'aurora-hue-emerald',
  teal: 'aurora-hue-teal',
  sky: 'aurora-hue-sky',
  violet: 'aurora-hue-violet',
  rose: 'aurora-hue-rose',
  amber: 'aurora-hue-amber',
  slate: 'aurora-hue-slate',
};

/**
 * A card in the aurora layer.
 *
 * When the switch is off this is the ordinary card, exactly as it was
 * before, so a page does not have to know whether the layer is on.
 */
export const AuroraCard = ({
  children,
  tier = 'panel',
  hue = 'slate',
  lift = false,
  className,
  ...props
}) => {
  const on = auroraIsOn();

  if (!on) {
    return (
      <div
        className={clsx(
          'bg-white rounded-xl shadow-sm border border-gray-100',
          lift && 'card-hover cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'aurora-card',
        tier === 'tile' && 'aurora-card--tile',
        tier === 'hero' && 'aurora-card--hero',
        tier === 'row' && 'aurora-card--row',
        HUES[hue] || HUES.slate,
        lift && 'aurora-lift cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * The page canvas.
 *
 * A wash of the accent at the top of the page, fading out before the
 * middle, so the content sits on something rather than floating on a
 * flat colour.
 */
export const AuroraCanvas = ({ children, className, ...props }) => {
  const on = auroraIsOn();

  if (!on) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div className={clsx('aurora-canvas', className)} {...props}>
      {children}
    </div>
  );
};

/**
 * A navigation item.
 *
 * With the layer on, the active item is marked by a spine on its left
 * edge rather than by a filled box, so the menu does not compete with
 * the content of the page for attention.
 */
export const auroraNavClass = ({ active }) => {
  const on = auroraIsOn();

  if (!on) {
    return active
      ? 'bg-primary-50 text-primary-600 font-medium shadow-sm dark:bg-primary-900/30 dark:text-primary-400'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white';
  }

  return clsx(
    'aurora-nav-item',
    active && 'aurora-nav-item--active font-medium',
    !active &&
      'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
  );
};

export default AuroraCard;
