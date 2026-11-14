/**
 * The greeter.
 *
 * The first screen needs someone on it. This card puts a companion
 * beside the sign-in form, large enough to read as a character
 * rather than an icon, with its question pills laid out INSIDE the
 * card: the floating board used to drop over the simulators below,
 * and a board that is part of the card cannot cover anything.
 *
 * The reader can switch between the two companions who own this
 * page, so the first thing the application does is let them choose
 * something.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import ClampShoujoMascot from '../mascot/ClampShoujoMascot';
import { PETIT_CHIBI_CAST } from '../mascot/petitChibiCast';
import { campusCopy } from './campusCopy.js';
import { MemphisBead } from './CampusKit.jsx';

/** The two who own the sign-in page. */
const GREETERS = ['mone', 'kaneru'];

export default function MascotGreeterCard({ className = '' }) {
  const { language } = useTranslation();
  const C = campusCopy(language);
  const [who, setWho] = useState('mone');

  return (
    <article
      className={clsx(
        'campus-greeter-card relative overflow-visible rounded-[24px] border-2 border-[#4A3540]',
        'bg-white px-3 pb-4 pt-6 shadow-[0_8px_0_#E2D6C3] sm:px-4',
        className
      )}
      data-testid="mascot-greeter-card"
    >
      <span className="absolute -left-2 -top-2 z-10" aria-hidden="true">
        <MemphisBead kind="star" colour="#8FBFA8" size={18} />
      </span>

      <header className="flex items-start justify-between gap-2">
        <span>
          <p className="inline-flex rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-0.5 text-[9.5px] font-extrabold tracking-[0.12em] text-[#2C221E] shadow-[0_2px_0_#4A3540]">
            {C.greeter_badge}
          </p>
          <h3 className="mt-1.5 text-[1rem] font-extrabold tracking-[0.02em] text-[#2C221E]">
            {C.greeter_title}
          </h3>
        </span>
        {/* Who is standing there. */}
        <span className="flex shrink-0 gap-1" role="group" aria-label={C.greeter_switch}>
          {GREETERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setWho(id)}
              data-testid={`greeter-pick-${id}`}
              aria-pressed={who === id}
              className={clsx(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold transition-transform active:scale-95',
                who === id
                  ? 'border-[#4A3540] bg-[#2F4842] text-white'
                  : 'border-[#4A3540]/30 bg-white text-[#5C6460]'
              )}
            >
              {PETIT_CHIBI_CAST[id].name}
            </button>
          ))}
        </span>
      </header>

      <p className="mt-1.5 text-[11.5px] leading-snug text-[#5C6460]">{C.greeter_lead}</p>

      {/* The companion, large, with its questions laid out beside it
          rather than floating over the page. */}
      <div className="mt-2 flex justify-center overflow-visible pt-2">
        <ClampShoujoMascot
          key={who}
          persona={who}
          size={130}
          mood="happy"
          inline
          interactive
          label={PETIT_CHIBI_CAST[who].name}
        />
      </div>
    </article>
  );
}
