/**
 * The small parts of the guild-hall theme (styles/fantasy-rpg.css).
 *
 *   <FantasyPage>      the page wrapper: carries the theme down
 *   <PlaqueTitle>      the pixel plaque a page opens with
 *   <FantasyCard>      the double gold frame
 *   <FantasyButton>    the metallic button
 *   <MerchantChest>    the empty state: a strongbox with a gem
 *
 * The chest is a drawn tile (scripts/build_koban_tiles.py); the gem on
 * it is one of the real 8-bit icons.
 */

import { clsx } from 'clsx';

export function FantasyPage({ className = '', children, ...rest }) {
  return <div className={clsx('fantasy-scope', className)} data-fantasy="page" {...rest}>{children}</div>;
}

export function PlaqueTitle({ as: Tag = 'h1', icon, className = '', children, ...rest }) {
  return (
    <Tag className={clsx('fantasy-plaque text-xl', className)} {...rest}>
      {icon || null}{children}
    </Tag>
  );
}

export function FantasyCard({ as: Tag = 'section', className = '', children, ...rest }) {
  return <Tag className={clsx('fantasy-card', className)} {...rest}>{children}</Tag>;
}

export function FantasyButton({ glow = false, ghost = false, className = '', children, type = 'button', ...rest }) {
  return (
    <button type={type} className={clsx('fantasy-btn', glow && 'fantasy-btn--glow', ghost && 'fantasy-btn--ghost', className)} {...rest}>
      {children}
    </button>
  );
}

export const GEMS = {
  gold: '/koban-assets/svg/accessories/ring_gold_red.svg',
  ruby: '/koban-assets/svg/accessories/jewelry_oval_red.svg',
  emerald: '/koban-assets/svg/accessories/jewelry_emerald_green.svg',
  sapphire: '/koban-assets/svg/accessories/jewelry_round_blue.svg',
};

export function MerchantChest({ title, hint, gem = 'ruby', action, className = '' }) {
  return (
    <div className={clsx('fantasy-chest', className)} data-testid="merchant-chest">
      <div className="fantasy-chest__art" aria-hidden="true">
        <img src="/koban-assets/tiles/tile_chest.png" alt="" draggable="false" />
        <img src={GEMS[gem] || GEMS.ruby} alt="" className="fantasy-chest__gem" draggable="false" />
      </div>
      <p className="fantasy-chest__title">{title}</p>
      {hint ? <p className="fantasy-chest__hint">{hint}</p> : null}
      {action || null}
    </div>
  );
}
