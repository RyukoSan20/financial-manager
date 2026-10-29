import { clsx } from 'clsx';
import { moneyLayerOn } from '../../utils/animation';

/**
 * A bento grid.
 *
 * The dashboard was a stack of rows, each row the same height, each
 * card the same width. The eye reads that as a list of equals, so
 * nothing on the page says what matters most.
 *
 * A bento grid lets the important things be big and the rest fit in
 * around them. The layout is described by the items themselves, so a
 * page can be rearranged without touching this component.
 *
 * The grid collapses to one column on a phone, two on a tablet, and
 * six on a wide screen. The spans are in the component's own
 * vocabulary, so the same item reads the same way on every page.
 *
 * With the money layer off, the grid falls back to the columns it
 * had before, so the page is not left with no layout at all.
 */

/**
 * The span vocabulary.
 *
 * The spans are sixths of the row. `half` is three sixths - the
 * balance, which is the widest thing on the page. `full` is the
 * whole row. Everything else is one cell.
 */
const SPANS = {
  full: 'fm-span-full',
  half: 'fm-span-half',
  third: 'fm-span-third',
  twoThirds: 'fm-span-two-thirds',
  tall: 'fm-span-tall',
};

export default function BentoGrid({ children, className = '', fallbackColumns }) {
  // The columns the page used before the bento grid existed: as
  // many as fit, each at least 240px wide, so an amount is never
  // cut off.
  const fallback =
    fallbackColumns || 'repeat(auto-fit, minmax(240px, 1fr))';

  if (!moneyLayerOn()) {
    return (
      <div className={clsx('grid gap-4', className)} style={{ gridTemplateColumns: fallback }}>
        {children}
      </div>
    );
  }

  return <div className={clsx('fm-bento', className)}>{children}</div>;
}

/**
 * One cell of the grid.
 *
 * `span` says how much room it takes; `order` says where it sits
 * when the grid is narrow, which is how the balance stays above the
 * fold on a phone.
 */
export function BentoItem({
  children,
  span = 'normal',
  order,
  className = '',
  ...rest
}) {
  return (
    <div
      className={clsx('fm-bento-item', SPANS[span] || '', className)}
      style={order === undefined ? undefined : { order }}
      {...rest}
    >
      {children}
    </div>
  );
}
