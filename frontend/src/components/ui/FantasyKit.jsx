/**
 * Theme-aware building blocks. None of them carries a colour: each is a
 * semantic class (styles/multi-theme.css) that the active app theme -
 * corporate, medieval or jade - draws in its own way.
 *
 *   <ThemePage>      page shell
 *   <ThemeCard>      a content card
 *   <ThemeButton>    the primary action
 *   <MerchantChest>  the empty state: a drawn strongbox with a real 8-bit gem
 *
 * The chest is a drawn tile (scripts/build_koban_tiles.py); the gem on it
 * is one of the real 8-bit icons.
 */

import { clsx } from 'clsx';

export function ThemePage({ className = '', children, ...rest }) {
  return <div className={clsx('theme-page-shell', className)} {...rest}>{children}</div>;
}

export function ThemeCard({ as: Tag = 'section', ticket = false, className = '', children, ...rest }) {
  return <Tag className={clsx(ticket ? 'theme-ticket-card hh-card-forest' : 'theme-card', className)} {...rest}>{children}</Tag>;
}

export function ThemeButton({ ghost = false, className = '', children, type = 'button', ...rest }) {
  return <button type={type} className={clsx(ghost ? 'theme-btn-ghost' : 'theme-btn-primary', className)} {...rest}>{children}</button>;
}

export const GEMS = {
  gold: '/koban-assets/svg/accessories/ring_gold_red.svg',
  ruby: '/koban-assets/svg/accessories/jewelry_oval_red.svg',
  emerald: '/koban-assets/svg/accessories/jewelry_emerald_green.svg',
  sapphire: '/koban-assets/svg/accessories/jewelry_round_blue.svg',
};

export function MerchantChest({ title, hint, gem = 'ruby', action, className = '' }) {
  return (
    <div className={clsx('theme-chest', className)} data-testid="merchant-chest">
      <div className="theme-chest__art" aria-hidden="true">
        <img src="/koban-assets/tiles/tile_chest.png" alt="" draggable="false" />
        <img src={GEMS[gem] || GEMS.ruby} alt="" className="theme-chest__gem" draggable="false" />
      </div>
      <p className="theme-chest__title">{title}</p>
      {hint ? <p className="theme-chest__hint">{hint}</p> : null}
      {action || null}
    </div>
  );
}
