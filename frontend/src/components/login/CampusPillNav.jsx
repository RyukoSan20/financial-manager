/**
 * The campus pill navbar.
 *
 * Taken from the shape mycampus.jue.ac.jp uses: the bar is not a
 * band across the top of the page, it is a capsule floating over it,
 * and the links inside it are themselves capsules.
 *
 * On a phone the links scroll sideways inside the pill rather than
 * wrapping onto a second line, which would make the bar two storeys
 * tall and eat the first screen. The row that scrolls is the links
 * row only - the page itself never scrolls sideways.
 */

import { clsx } from 'clsx';
import PixelArtBusinessIcon from '../ui/PixelArtBusinessIcon';
import { campusCopy } from './campusCopy.js';

/** Move to a section without the jump a bare anchor makes. */
const scrollToSection = (id) => {
  const target = document.getElementById(id);
  if (!target) return;
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
};

export default function CampusPillNav({ language = 'id', onGuest, busy = false }) {
  const C = campusCopy(language);

  const links = [
    { id: 'CeritaTeman', label: C.nav_snap, icon: 'smartphone' },
    { id: 'MiniGame', label: C.nav_game, icon: 'coin' },
    { id: 'Simulator', label: C.nav_sim, icon: 'calculator' },
    { id: 'Maskot', label: C.nav_cast, icon: 'lightbulb' },
  ];

  return (
    <nav
      className={clsx(
        'campus-pill-nav sticky top-3 z-40 mx-auto flex w-[calc(100%-1.5rem)] max-w-6xl',
        'items-center justify-between gap-2 rounded-full border-2 border-[#4A3540]',
        'bg-[#FFFDF9]/95 px-3 py-2 shadow-[0_5px_0_#E5DAC9] backdrop-blur-md sm:px-6 sm:py-2.5'
      )}
      data-testid="campus-pill-nav"
      aria-label="FinManager"
    >
      {/* The wordmark. Espresso ink, never white - this is the text
          that was invisible on the cream canvas. */}
      <span className="campus-nav__brand flex shrink-0 items-center gap-1.5">
        <PixelArtBusinessIcon name="ledger_green" size={20} badge={false} />
        <span className="campus-nav__wordmark text-[0.95rem] font-extrabold tracking-[0.02em] text-[#2C221E]">
          FinManager
        </span>
        <span className="campus-star text-[11px] text-[#E8B84B]" aria-hidden="true">
          ✦
        </span>
      </span>

      {/* The links. `no-scrollbar` keeps the grey bar off the design
          while the row still scrolls with a thumb on a phone. */}
      <span className="campus-nav__links no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => scrollToSection(link.id)}
            className={clsx(
              'campus-nav__link flex shrink-0 items-center gap-1.5 rounded-full',
              'border border-[#4A3540]/25 bg-white px-3 py-1 text-[11.5px] font-bold text-[#4A3540]',
              'transition-transform hover:border-[#4A3540] hover:bg-[#FFF6D6] active:scale-95'
            )}
          >
            <PixelArtBusinessIcon name={link.icon} size={13} badge={false} />
            {link.label}
          </button>
        ))}
      </span>

      {/* The way in, always reachable however far the reader has
          scrolled. */}
      <button
        type="button"
        onClick={onGuest}
        disabled={busy}
        data-testid="campus-nav-guest"
        className={clsx(
          'campus-nav__cta flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[#4A3540]',
          'bg-[#D96B43] px-3 py-1.5 text-[11.5px] font-bold text-white shadow-[0_3px_0_#4A3540]',
          'transition-transform active:translate-y-0.5 disabled:opacity-60 sm:px-4'
        )}
      >
        <PixelArtBusinessIcon name="ledger_blue" size={13} badge={false} />
        <span className="hidden sm:inline">{C.nav_cta}</span>
        <span className="sm:hidden">Tamu</span>
      </button>
    </nav>
  );
}
