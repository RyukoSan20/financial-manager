/**
 * The real companion, and the physics around it.
 *
 * The companion is not drawn here. It is the artwork in
 * /koban-assets/chara/ - the high-resolution chibi sticker of each of
 * the six - and the expression sheets in /koban-assets/motion/. This
 * file is the part that makes it a thing the reader can pick up:
 *
 *   - Pointer Events, so it works with a finger, a mouse and a pen
 *     with one code path. `setPointerCapture` keeps the drag alive
 *     when the pointer leaves the figure, which is what makes it feel
 *     like the figure is being held rather than a cursor crossing it.
 *   - A sparkle trail while it is being dragged. Four-point shoujo
 *     glints, pastel stars and golden koban, left behind at the
 *     pointer and drifting up.
 *   - A squash and stretch on release, and a change of expression.
 *   - A shower of confetti and sakura petals.
 *
 * The drag is on the transform, never on the layout: the figure moves
 * inside its own box and nothing else on the page shifts.
 *
 * The sparkles and the confetti are DOM, not canvas. They are few
 * (a couple of dozen at a time), they live for under a second, and
 * they are ordinary elements, so they cost nothing and they can be
 * styled with the same tokens as everything else.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

/** The six, and what each of them is called. */
export const REAL_CAST = Object.freeze({
  koneko: { name: 'Koneko', kanji: '貯猫', role: 'Front Storekeeper & Kasir' },
  minori: { name: 'Minori', kanji: '実り', role: 'Master Crafter & Peracik' },
  kaneru: { name: 'Kaneru', kanji: '奏る', role: 'Royal Ledger & Akuntan' },
  kogane: { name: 'Kogane', kanji: '黄金', role: 'VIP Appraiser & Broker' },
  mone: { name: 'Mone', kanji: '萌音', role: 'Merchant Supplier & Vault Banker' },
  zenimaru: { name: 'Zenimaru', kanji: '銭丸', role: 'Guild Captain & Mercenary Leader' },
});

export const CAST_IDS = Object.keys(REAL_CAST);

/**
 * The picture for a character in a mood.
 *
 * The motion sheets hold four poses: happy, walking, sweating and
 * thinking. So "idle" and "happy" both use the happy pose, "alert"
 * uses the sweating pose, and "thinking" uses the thinking one.
 */
export function artFor(persona, mood = 'idle') {
  const id = REAL_CAST[persona] ? persona : 'koneko';
  const pose =
    mood === 'alert' || mood === 'sweating'
      ? 'sweating'
      : mood === 'thinking'
      ? 'thinking'
      : mood === 'walking'
      ? 'walking'
      : 'happy';
  return `/koban-assets/motion/${id}_${pose}.webp`;
}

export function stickerFor(persona) {
  const id = REAL_CAST[persona] ? persona : 'koneko';
  return `/koban-assets/chara/${id}.png`;
}

/** The three things the trail is made of. */
const TRAIL_KINDS = ['glint', 'star', 'koban'];

const TRAIL_COLOURS = {
  glint: ['#FFFFFF', '#FFF0F6', '#E9F6FF'],
  star: ['#F7C8D8', '#FFE9A8', '#C8E8D8', '#D8C8F0'],
  koban: ['#F4E285', '#E8B84B', '#FFF0B8'],
};

let sparkSerial = 0;

/**
 * A short-lived particle.
 *
 * The position is written straight to the element's style, not to
 * React state: a drag fires dozens of moves a second, and a render
 * for each of them would put the drag behind the pointer.
 */
function useParticles() {
  const [particles, setParticles] = useState([]);

  const spawn = useCallback((items) => {
    setParticles((current) => [...current, ...items].slice(-40));
  }, []);

  const retire = useCallback((id) => {
    setParticles((current) => current.filter((p) => p.id !== id));
  }, []);

  return { particles, spawn, retire };
}

/**
 * The draggable companion.
 *
 * Props:
 *   persona     one of the six
 *   mood        idle, happy, celebrate, alert, thinking, walking
 *   size        the height of the figure in pixels
 *   draggable   whether the reader can pick it up
 *   hint        the little pill that says so
 *   onTap       called when it is tapped rather than dragged
 */
export default function DraggableSparkleMascot({
  persona = 'koneko',
  mood = 'idle',
  size = 120,
  draggable = true,
  hint = '',
  label,
  className = '',
  onTap,
  onCelebrate,
  ...rest
}) {
  const [drag, setDrag] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [bouncing, setBouncing] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [hovered, setHovered] = useState(false);
  const [activeMood, setActiveMood] = useState(mood);

  const pointerRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const spawnedAt = useRef({ distance: 0 });
  const { particles, spawn, retire } = useParticles();

  const member = REAL_CAST[persona] || REAL_CAST.koneko;
  const art = artFor(persona, activeMood);
  const sticker = stickerFor(persona);

  // The expression follows the mood, except while a drag is running -
  // a character that changes expression mid-drag looks like it is
  // glitching.
  useEffect(() => {
    if (!drag) setActiveMood(mood);
  }, [mood, drag]);

  const burst = useCallback((x, y) => {
    const items = [];
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const kind = i % 3 === 0 ? 'glint' : i % 3 === 1 ? 'star' : 'koban';
      const colours = TRAIL_COLOURS[kind];
      items.push({
        id: `cf-${sparkSerial += 1}`,
        kind,
        colour: colours[i % colours.length],
        x,
        y,
        // The fall is downwards; the sway is sideways; the spin is
        // how fast the piece turns.
        dx: (Math.random() - 0.5) * 160,
        drift: (Math.random() - 0.5) * 90,
        spin: (Math.random() - 0.5) * 720,
        delay: Math.random() * 220,
        duration: 1100 + Math.random() * 900,
        life: 2200,
        fall: true,
      });
    }
    setConfetti((current) => [...current, ...items].slice(-30));
    setTimeout(() => {
      setConfetti((current) => current.filter((c) => !items.includes(c)));
    }, 2300);
    onCelebrate?.();
  }, [onCelebrate]);

  const onPointerDown = useCallback(
    (event) => {
      if (!draggable) return;
      // Only the primary button, so a right-click does not grab it.
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerRef.current = event.pointerId;
      originRef.current = { x: event.clientX, y: event.clientY };
      movedRef.current = false;
      spawnedAt.current = { distance: 0 };
      setDrag({ x: event.clientX, y: event.clientY });
    },
    [draggable]
  );

  const onPointerMove = useCallback(
    (event) => {
      if (!drag || pointerRef.current !== event.pointerId) return;
      const dx = event.clientX - originRef.current.x;
      const dy = event.clientY - originRef.current.y;
      if (!movedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        movedRef.current = true;
        // Carried about, the character switches to its walking pose.
        setActiveMood('walking');
      }

      setOffset({ x: dx, y: dy });
      // The figure leans into the direction of the drag, up to about
      // a tenth of a turn.
      setTilt(Math.max(-12, Math.min(12, dx * 0.06)));

      // A glint every few pixels of travel, so the trail is a trail
      // and not a cloud.
      const travelled = Math.hypot(dx, dy);
      if (travelled - (spawnedAt.current?.distance || 0) > 14) {
        spawnedAt.current = { distance: travelled };
        const kind = TRAIL_KINDS[sparkSerial % TRAIL_KINDS.length];
        const colours = TRAIL_COLOURS[kind];
        spawn([
          {
            id: `tr-${sparkSerial += 1}`,
            kind,
            colour: colours[sparkSerial % colours.length],
            x: event.clientX,
            y: event.clientY,
            dx: (Math.random() - 0.5) * 26,
            drift: (Math.random() - 0.5) * 18,
            spin: (Math.random() - 0.5) * 180,
            delay: 0,
            duration: 620 + Math.random() * 320,
            life: 1000,
            fall: false,
          },
        ]);
      }
    },
    [drag, spawn]
  );

  const onPointerUp = useCallback(
    (event) => {
      if (!drag) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      pointerRef.current = null;
      setDrag(null);
      setTilt(0);

      if (movedRef.current) {
        // It was dragged, so it lands: a squash, a bounce, and a
        // shower.
        setBouncing(true);
        setTimeout(() => setBouncing(false), 560);
        setActiveMood('celebrate');
        setTimeout(() => setActiveMood(mood), 1400);
        burst(event.clientX, event.clientY);
      } else {
        // It was tapped.
        setBouncing(true);
        setTimeout(() => setBouncing(false), 560);
        setActiveMood('happy');
        setTimeout(() => setActiveMood(mood), 1200);
        burst(event.clientX, event.clientY);
        onTap?.();
      }

      // It goes home, but not instantly - the spring reads better.
      setOffset({ x: 0, y: 0 });
    },
    [drag, mood, burst, onTap]
  );

  const cancelDrag = useCallback(() => {
    pointerRef.current = null;
    setDrag(null);
    setTilt(0);
    setOffset({ x: 0, y: 0 });
  }, []);

  // A keyboard is a pointer too. Space picks the figure up, the
  // arrows move it, space lets it go.
  const onKeyDown = useCallback(
    (event) => {
      if (!draggable) return;
      const step = 16;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setOffset((o) => ({ ...o, x: o.x - step }));
        movedRef.current = true;
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setOffset((o) => ({ ...o, x: o.x + step }));
        movedRef.current = true;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setOffset((o) => ({ ...o, y: o.y - step }));
        movedRef.current = true;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOffset((o) => ({ ...o, y: o.y + step }));
        movedRef.current = true;
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setBouncing(true);
        setTimeout(() => setBouncing(false), 560);
        setActiveMood('celebrate');
        setTimeout(() => setActiveMood(mood), 1400);
        const box = event.currentTarget.getBoundingClientRect();
        burst(box.left + box.width / 2, box.top + box.height / 2);
        onTap?.();
      }
    },
    [draggable, mood, burst, onTap]
  );

  const trail = particles;

  return (
    <span
      className={clsx('koban-mascot relative inline-flex select-none items-center justify-center', className)}
      data-testid="draggable-mascot"
      data-persona={persona}
      data-mood={activeMood}
      data-dragging={drag ? 'true' : 'false'}
      {...rest}
    >
      {/* The trail and the confetti live in the page, not in the
          figure, because they are positioned against the pointer. */}
      <span className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
        {trail.map((p) => (
          <span
            key={p.id}
            className={clsx('koban-particle', p.kind === 'glint' && 'is-glint', p.kind === 'star' && 'is-star')}
            style={{
              left: p.x,
              top: p.y,
              color: p.colour,
              animationDuration: `${p.duration}ms`,
              animationDelay: `${p.delay}ms`,
              '--dx': `${p.dx}px`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
              '--fall': p.fall ? '1' : '0',
            }}
            onAnimationEnd={() => retire(p.id)}
          />
        ))}
        {confetti.map((p) => (
          <span
            key={p.id}
            className={clsx('koban-confetti', p.kind === 'glint' && 'is-glint', p.kind === 'star' && 'is-star')}
            style={{
              left: p.x,
              top: p.y,
              color: p.colour,
              backgroundColor: p.kind === 'koban' ? p.colour : 'transparent',
              borderColor: p.colour,
              animationDuration: `${p.duration}ms`,
              animationDelay: `${p.delay}ms`,
              '--dx': `${p.dx}px`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
            }}
          />
        ))}
      </span>

      <button
        type="button"
        className={clsx(
          'koban-mascot-figure relative block rounded-2xl border-0 bg-transparent p-0',
          draggable && (drag ? 'cursor-grabbing' : 'cursor-grab'),
          bouncing && 'petit-poyo-bounce'
        )}
        style={{
          width: size * 0.82,
          height: size,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${tilt}deg)`,
          touchAction: 'none',
          transition: drag ? 'none' : 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelDrag}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={label || `${member.name} - ${member.role}`}
        data-testid="draggable-mascot-figure"
      >
        {/* One picture: the pose from the motion sheet for the current
            mood. Each pose is a whole figure, so it is never layered
            over the sticker. If a pose is missing, the sticker stands in. */}
        <img
          key={art}
          src={art}
          alt=""
          className="koban-mascot-art pointer-events-none absolute inset-0 h-full w-full"
          draggable="false"
          data-testid="draggable-mascot-art"
          onError={(event) => {
            if (!event.currentTarget.src.endsWith(sticker)) event.currentTarget.src = sticker;
          }}
        />
      </button>

      {draggable && (hovered || drag) && hint ? (
        <span
          className="koban-mascot-hint absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-[#4A3540] bg-[#FFF6D6] px-2.5 py-0.5 text-[10px] font-extrabold text-[#2C221E] shadow-[0_2px_0_#4A3540]"
          data-testid="draggable-mascot-hint"
        >
          {hint}
        </span>
      ) : null}
    </span>
  );
}

export { DraggableSparkleMascot };
