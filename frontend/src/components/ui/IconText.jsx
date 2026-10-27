/**
 * A word with a drawing beside it.
 *
 * Many headings in the application start with a small drawing: a
 * chart, a wallet, a warning sign. The drawing used to be an emoji,
 * which meant it was drawn by the phone's font, looked different on
 * every machine, and did not follow the colour scheme.
 *
 * This puts the drawing in the icon family the rest of the
 * application uses. The emoji is still used when the polish switch
 * is off, so the page is unchanged until the switch is turned on.
 */

import { ICONS } from '../../utils/icons';

/**
 * @param {string} name   what the drawing stands for, e.g. "chart"
 * @param {string} emoji  the drawing to use when the switch is off
 * @param {boolean} on    whether the switch is on
 * @param {string} className  the class for the drawing
 */
export const IconText = ({ name, emoji, on, className = 'w-4 h-4', children }) => {
  if (!on) {
    return (
      <>
        {emoji ? <span aria-hidden="true">{emoji}</span> : null}
        {children}
      </>
    );
  }

  const Icon = ICONS[name];

  if (!Icon) {
    // An unknown name should not make the page blank. Fall back to
    // the emoji, which is what the page showed before.
    return (
      <>
        {emoji ? <span aria-hidden="true">{emoji}</span> : null}
        {children}
      </>
    );
  }

  return (
    <span className="icon-inline">
      <Icon className={className} aria-hidden="true" />
      {children}
    </span>
  );
};

export default IconText;
