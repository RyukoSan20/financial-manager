import { clsx } from 'clsx';
import { auroraIsOn } from './AuroraCard';

/**
 * A card.
 *
 * With the aurora layer off this is the card the application has
 * always had: a white rectangle with a grey border.
 *
 * With the layer on it takes a tier from the shape language - `hero`
 * for the one number a page is about, `tile` for a metric read at a
 * glance, `panel` for a block of content, `row` for one line of a
 * list - and a `hue` that says what the number means. The shape and
 * the depth follow from the tier, so a page built from many cards
 * reads as a set of pieces of different importance rather than a set
 * of copies.
 *
 * The tier defaults to `panel`, so a card that says nothing about
 * itself gets the quiet shape rather than a loud one.
 */
export const Card = ({
  children,
  className,
  hover = false,
  tier = 'panel',
  hue = 'slate',
  ...props
}) => {
  const on = auroraIsOn();

  if (!on) {
    // One shape for every card in the application.
    //
    // It used to be `bg-white rounded-xl shadow-sm border
    // border-gray-100`, which is a white rectangle with a grey line
    // around it. The hairline is now a touch softer and the shadow
    // is deeper and softer at the same time, so the card sits on the
    // page rather than being cut out of it.
    return (
      <div
        className={clsx(
          'shape-card',
          hover && 'shape-card--interactive',
          hover && 'settle-in',
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
        tier === 'hero' && 'aurora-card--hero',
        tier === 'tile' && 'aurora-card--tile',
        tier === 'row' && 'aurora-card--row',
        `aurora-hue-${hue}`,
        hover && 'aurora-lift cursor-pointer',
        hover && 'settle-in',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4 border-b border-gray-100/80 dark:border-white/10', className)} {...props}>
    {children}
  </div>
);

export const CardBody = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div
    className={clsx(
      'px-5 py-3 border-t border-gray-100/80 dark:border-white/10 bg-gray-50/70 dark:bg-white/5 rounded-b-[inherit]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
