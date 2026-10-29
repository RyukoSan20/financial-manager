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
    return (
      <div
        className={clsx(
          'bg-white rounded-xl shadow-sm border border-gray-100',
          hover && 'card-hover cursor-pointer',
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
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4 border-b border-gray-100', className)} {...props}>
    {children}
  </div>
);

export const CardBody = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-4', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div className={clsx('px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl', className)} {...props}>
    {children}
  </div>
);
