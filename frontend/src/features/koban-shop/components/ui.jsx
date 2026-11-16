/**
 * Shared pieces of the Koban & Co. interface.
 *
 * The game uses the same stationery vocabulary as the rest of the
 * app - cream paper, espresso ink, flat offset shadows - so it reads
 * as a room in the same house rather than an embedded foreign thing.
 */

import { clsx } from 'clsx';
import { ITEMS, RAW } from '../store/kobanEngine.js';

export const fmt = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n || 0));

export const secondsLeft = (untilMs, nowMs) => Math.max(0, Math.ceil((untilMs - nowMs) / 1000));

export const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** An item or raw material icon with its 8-bit SVG. */
export function ItemIcon({ id, size = 40, className = '' }) {
  const def = ITEMS[id] || RAW[id];
  if (!def) return <span className={clsx('inline-block rounded bg-[#F0EAE0]', className)} style={{ width: size, height: size }} />;
  return (
    <img
      src={def.icon}
      alt={def.name}
      width={size}
      height={size}
      loading="lazy"
      className={clsx('inline-block object-contain', className)}
      style={{ imageRendering: 'pixelated', width: size, height: size }}
    />
  );
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={clsx(
        'rounded-[20px] border-2 border-[#4A3540] bg-white shadow-[0_5px_0_#DFD3C3]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Pill({ tone = 'cream', className = '', children, ...rest }) {
  const tones = {
    cream: 'bg-[#FFF6D6] text-[#2C221E] border-[#4A3540]',
    sage: 'bg-[#E3F2EA] text-[#1F3A2E] border-[#2F4842]',
    terracotta: 'bg-[#D96B43] text-white border-[#4A3540]',
    sakura: 'bg-[#FDE8E4] text-[#9E3B24] border-[#4A3540]',
    ink: 'bg-[#2F4842] text-white border-[#4A3540]',
    ghost: 'bg-white text-[#5C6460] border-[#4A3540]/30',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold', tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}

export function Button({ tone = 'ink', size = 'md', className = '', disabled, children, ...rest }) {
  const tones = {
    ink: 'bg-[#2F4842] text-white',
    terracotta: 'bg-[#D96B43] text-white',
    cream: 'bg-[#FFF6D6] text-[#2C221E]',
    ghost: 'bg-white text-[#4A3540]',
  };
  const sizes = { sm: 'px-3 py-1 text-[11px]', md: 'px-4 py-2 text-[12.5px]', lg: 'px-5 py-2.5 text-[13.5px]' };
  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-[#4A3540] font-bold',
        'shadow-[0_3px_0_#4A3540] transition-transform active:translate-y-0.5 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
        tones[tone], sizes[size], className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ badge, title, lead }) {
  return (
    <header className="koban-section-title mb-3">
      <Pill>{badge}</Pill>
      <h2 className="mt-1.5 text-[1.1rem] font-extrabold tracking-[0.02em] text-[#2C221E]">{title}</h2>
      {lead ? <p className="mt-0.5 text-[12px] text-[#5C6460]">{lead}</p> : null}
    </header>
  );
}

/** A bottom sheet / modal that is viewport-safe on phones. */
export function Sheet({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#2C221E]/55 p-3 sm:items-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={clsx(
          'koban-sheet max-h-[88vh] w-full overflow-y-auto rounded-[22px] border-2 border-[#4A3540] bg-[#FFFDF9] p-4 shadow-[0_8px_0_#4A3540]',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[1rem] font-extrabold text-[#2C221E]">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full border-2 border-[#4A3540] bg-white px-2.5 py-0.5 text-[12px] font-extrabold text-[#4A3540] active:scale-95">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
