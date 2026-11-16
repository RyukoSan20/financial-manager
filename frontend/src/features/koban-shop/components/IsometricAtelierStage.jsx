/**
 * The shop floor.
 *
 * The atelier photograph is the stage. Everything on it is placed by
 * percentage, so the same layout holds from a phone to a wide screen:
 * five companions at their posts, three shelf hotspots, and a stream
 * of customers who walk in at the door, pause at a shelf, pay at the
 * counter, and leave.
 *
 * The customers are CSS: a keyframed path from door to shelf to
 * counter, with a speech bubble that offers a puzzle when one of the
 * open requests is theirs. Nothing here is a game loop - the walk is
 * animation, the sale is the engine's.
 */

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { DB, ITEMS, SHELVES, REQUESTS } from '../store/kobanEngine.js';
import { ItemIcon, Pill, fmt } from './ui.jsx';

/**
 * The pixel-art sprite for a companion.
 *
 * The strips live at /koban-assets/sprites/<id>_<anim>.png and are
 * one frame wide per column, so the background is slid by a
 * percentage of the element's own width to step through them.
 */
export const SPRITE_ANIMS = {
  idle: { file: 'idle', frames: 3, ms: 1200 },
  walk: { file: 'walk', frames: 4, ms: 560 },
  celebrate: { file: 'celebrate', frames: 3, ms: 720 },
  work: { file: 'work', frames: 2, ms: 660 },
};

/**
 * The style for a sprite strip.
 *
 * backgroundSize is N frames across the window, which is what makes
 * the percentage maths in koban.css line up: the overflow is then
 * N-1 frames wide and one frame is 1/(N-1) of it.
 */
export function spriteStyle(charId, anim = 'idle') {
  const a = SPRITE_ANIMS[anim] || SPRITE_ANIMS.idle;
  return {
    backgroundImage: `url(/koban-assets/sprites/${charId}_${a.file}.png)`,
    backgroundSize: `${a.frames * 100}% 100%`,
  };
}

/**
 * One sprite, as a window onto a strip.
 *
 * The strip is the whole row of frames; the outer element is the
 * window that clips it. The outer element keeps the frame's shape -
 * a sprite is 48 wide by 64 tall, so it is taller than it is wide.
 */
export function Sprite({ charId, anim = 'idle', className = '', style = {}, ...rest }) {
  return (
    <span
      className={`koban-sprite koban-sprite--${anim} ${className}`}
      style={{ aspectRatio: '48 / 64', ...style }}
      {...rest}
    >
      <span className="koban-sprite__strip" style={spriteStyle(charId, anim)} />
    </span>
  );
}

const CUSTOMER_SPRITES = DB.monsters.length
  ? ['/koban-assets/svg/animals/alpaca_white.svg', '/koban-assets/svg/animals/usagi_white.svg', '/koban-assets/svg/animals/araiguma.svg', '/koban-assets/svg/animals/azarashi.svg', '/koban-assets/svg/animals/alpaca_brown.svg']
  : [];

export default function IsometricAtelierStage({ state, nowMs, onShelfTap, onCustomerTap, celebratingId = null }) {
  const bell = state.activeBuffs.konekoBellUntil > nowMs;
  const fever = state.feverModeUntil > nowMs;

  // The companion whose skill is running right now works at their
  // post. The rest breathe.
  const workingId = useMemo(() => {
    const running = DB.characters.find((c) => (state.skills[c.id]?.activeUntilMs || 0) > nowMs);
    return running ? running.id : null;
  }, [state.skills, nowMs]);

  // Which open requests can walk in. One customer per open request
  // in the current chapter, up to three on the floor at once.
  const openRequests = useMemo(
    () => DB.customerRequests.filter((r) => r.chapter <= state.chapter && !state.solvedRequests.includes(r.id)).slice(0, 3),
    [state.chapter, state.solvedRequests]
  );

  // The walkers. A pool that restarts its CSS walk on a timer, faster
  // while the bell is ringing.
  const [wave, setWave] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setWave((w) => w + 1), bell ? 4000 : 9000);
    return () => window.clearInterval(id);
  }, [bell]);

  const walkers = useMemo(() => {
    const n = bell ? 3 : 2;
    return new Array(n).fill(0).map((_, i) => ({
      id: `${wave}-${i}`,
      sprite: CUSTOMER_SPRITES[(wave + i) % CUSTOMER_SPRITES.length],
      delay: i * 1.3,
      request: openRequests[i] || null,
      target: SHELVES[(wave + i) % SHELVES.length],
    }));
  }, [wave, bell, openRequests]);

  const stageChars = DB.characters.filter((c) => c.stageCoords.scene === 'atelier');

  return (
    <div className="koban-stage-wrap">
    <div
      className={clsx('koban-stage relative aspect-[3/4] w-full overflow-hidden sm:aspect-[16/9] rounded-[22px] border-2 border-[#4A3540] shadow-[0_6px_0_#DFD3C3]', fever && 'koban-stage--fever')}
      style={{ backgroundImage: `url(${DB.meta.scenes.atelier})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      data-testid="atelier-stage"
    >
      {fever ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center">
          <Pill tone="terracotta" className="koban-fever-badge text-[12px]">👑 ROYAL FEVER · harga 2×</Pill>
        </div>
      ) : null}

      {/* The companions at their posts. */}
      {stageChars.map((c) => {
        // A companion whose skill is running works at their post; the
        // rest breathe. The one who just fired a skill celebrates.
        const celebrating = celebratingId === c.id;
        const anim = celebrating ? 'celebrate' : workingId === c.id ? 'work' : 'idle';
        return (
          <Sprite
            key={c.id}
            charId={c.id}
            anim={anim}
            role="img"
            aria-label={c.name}
            title={`${c.role} — ${c.skill.name}`}
            data-testid={`stage-chara-${c.id}`}
            className="koban-sprite--standing pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full drop-shadow-[0_6px_6px_rgba(44,34,30,0.35)]"
            style={{
              left: `${c.stageCoords.xPercent}%`,
              top: `${c.stageCoords.yPercent}%`,
              width: '9.5%',
              animationDelay: `${(c.stageCoords.xPercent % 7) * 0.3}s`,
            }}
          />
        );
      })}

      {/* The customers walking in. */}
      {walkers.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => w.request && onCustomerTap(w.request.id)}
          data-testid={w.request ? `customer-${w.request.id}` : undefined}
          className={clsx('koban-walker absolute bottom-[6%] z-20 flex flex-col items-center', w.request ? 'cursor-pointer' : 'pointer-events-none')}
          style={{ '--walk-to': `${w.target.xPercent}%`, animationDelay: `${w.delay}s`, animationDuration: bell ? '7s' : '12s' }}
          aria-label={w.request ? `Pelanggan: ${w.request.customerName}` : undefined}
        >
          {w.request ? <span className="koban-ask mb-0.5 rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-1.5 text-[11px] font-extrabold text-[#9E3B24]">( ? )</span> : null}
          <img src={w.sprite} alt="" className="h-9 w-9 sm:h-12 sm:w-12" style={{ imageRendering: 'pixelated' }} />
        </button>
      ))}

      {/* Open requests, named, so the floor is readable without
          catching a walker mid-stride. */}
      {openRequests.length > 0 ? (
        <div className="absolute bottom-1 left-1 z-30 flex max-w-[70%] flex-wrap gap-1 sm:bottom-2 sm:left-2 sm:max-w-[60%]">
          {openRequests.map((r) => (
            <button key={r.id} type="button" onClick={() => onCustomerTap(r.id)} className="rounded-full border border-[#4A3540] bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#4A3540] active:scale-95">
              ( ? ) {r.customerName.split(' ')[0]}
            </button>
          ))}
        </div>
      ) : null}
    </div>

        {/* The shelves.
            *
            * ONE set of buttons, placed two ways. On a desktop they sit
            * over the room where the furniture is. On a phone they leave
            * the room entirely and become a row underneath it, because a
            * 358-pixel stage cannot hold a shelf label, a character and
            * a bubble without one of them landing on another.
            *
            * The coordinates travel as custom properties, so the CSS can
            * choose the placement without the markup changing. */}
        <div className="koban-shelves">
          {SHELVES.map((shelf) => {
            const slot = state.shelves.find((s) => s.id === shelf.id);
            const empty = !slot.itemId || slot.qty <= 0;
            return (
              <button
                key={shelf.id}
                type="button"
                onClick={() => onShelfTap(shelf.id)}
                data-testid={`shelf-${shelf.id}`}
                className={clsx(
                  'koban-hotspot z-20 rounded-xl border-2 px-1.5 py-0.5 text-left transition-transform active:scale-95 sm:rounded-2xl sm:px-2 sm:py-1',
                  empty ? 'koban-hotspot--empty border-[#D96B43] bg-[#FFF6D6]' : 'border-[#4A3540] bg-white/95'
                )}
                style={{ '--sx': `${shelf.xPercent}%`, '--sy': `${shelf.yPercent}%` }}
              >
                <span className="block text-[8px] font-extrabold uppercase tracking-[0.06em] text-[#8A7F72] sm:text-[9px] sm:tracking-[0.08em]">{shelf.name}</span>
                {empty ? (
                  <span className="flex items-center gap-1 text-[11px] font-extrabold text-[#9E3B24]"><span className="koban-blink">( ! )</span> Stok Habis</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ItemIcon id={slot.itemId} size={22} />
                    <span className="text-[11px] font-bold text-[#2C221E]">{slot.qty}× · {fmt(slot.unitPrice)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
    </div>
  );
}

export { REQUESTS, ITEMS };
