/**
 * The campus furniture.
 *
 * The three reference pages share a vocabulary: a heading is never a
 * bare line of text, it is a capsule badge with a bold wide-tracked
 * line under it; a photograph is never a bare rectangle, it is a
 * polaroid held down by tape; and the space between sections is
 * decorated with small geometric beads rather than left empty.
 *
 * Those three pieces are written once here and used by every section,
 * so the page reads as one design rather than four.
 */

import { clsx } from 'clsx';
import { editorialFallback } from '../editorial/editorialFallback.js';

/* ---------------------------------------------------------------------------
   The capsule overline and the heading under it
   --------------------------------------------------------------------------- */

/**
 * A section heading.
 *
 * The badge above the heading is what makes the page scannable: a
 * reader flicking past at speed reads four short capsules, not four
 * sentences. The heading itself is always espresso ink on a light
 * ground - never white, which is the bug this page had.
 */
export function CampusHeading({
  badge,
  title,
  lead = '',
  align = 'left',
  className = '',
  id,
}) {
  return (
    <header
      className={clsx(
        'campus-heading',
        align === 'center' ? 'text-center' : 'text-left',
        className
      )}
      id={id}
    >
      <p
        className={clsx(
          'campus-overline inline-flex items-center gap-1.5 rounded-full px-4 py-1',
          'border-2 border-[#4A3540] bg-[#FFF6D6] text-[#2C221E]',
          'text-[11px] font-extrabold tracking-[0.12em] shadow-[0_3px_0_#4A3540]'
        )}
      >
        <span aria-hidden="true" className="campus-star">✦</span>
        {badge}
      </p>
      <h2 className="campus-heading__title mt-3 text-[clamp(1.5rem,4.2vw,2.3rem)] font-extrabold leading-[1.12] tracking-[0.04em] text-[#2C221E]">
        {title}
      </h2>
      {lead ? (
        <p
          className={clsx(
            'mt-2 max-w-[42rem] text-[0.95rem] leading-relaxed text-[#5C6460]',
            align === 'center' && 'mx-auto'
          )}
        >
          {lead}
        </p>
      ) : null}
    </header>
  );
}

/* ---------------------------------------------------------------------------
   The Memphis beads
   --------------------------------------------------------------------------- */

/**
 * The small geometric ornaments that float around the cards.
 *
 * They are drawn rather than loaded, they are marked aria-hidden, and
 * they sit in a `pointer-events-none` layer, so they decorate the
 * section without ever being in the way of a tap.
 */
export function MemphisBeads({ className = '', seed = 0 }) {
  // A fixed set per seed rather than a random one: a decoration that
  // moves every render is a decoration that flickers.
  const sets = [
    [
      { kind: 'dot', x: '4%', y: '12%', c: '#F9C6B0', s: 14 },
      { kind: 'ring', x: '92%', y: '18%', c: '#8FBFA8', s: 18 },
      { kind: 'zig', x: '88%', y: '72%', c: '#E8B84B', s: 26 },
      { kind: 'star', x: '8%', y: '78%', c: '#D96B43', s: 16 },
    ],
    [
      { kind: 'star', x: '6%', y: '20%', c: '#8FBFA8', s: 18 },
      { kind: 'dot', x: '94%', y: '34%', c: '#E8B84B', s: 12 },
      { kind: 'check', x: '90%', y: '80%', c: '#F9C6B0', s: 24 },
      { kind: 'ring', x: '10%', y: '86%', c: '#D96B43', s: 16 },
    ],
  ];
  const beads = sets[seed % sets.length];

  return (
    <div
      className={clsx('memphis-bead-layer pointer-events-none absolute inset-0', className)}
      aria-hidden="true"
    >
      {beads.map((bead, index) => (
        <span
          key={`${bead.kind}-${index}`}
          className="memphis-float absolute"
          style={{
            left: bead.x,
            top: bead.y,
            // Each bead drifts on its own clock, so the group never
            // pulses in unison like a loading state.
            animationDelay: `${index * 0.7}s`,
          }}
        >
          <MemphisBead kind={bead.kind} colour={bead.c} size={bead.s} />
        </span>
      ))}
    </div>
  );
}

function MemphisBead({ kind, colour, size }) {
  if (kind === 'dot') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill={colour} />
      </svg>
    );
  }
  if (kind === 'ring') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke={colour} strokeWidth="3" />
      </svg>
    );
  }
  if (kind === 'zig') {
    return (
      <svg width={size} height={size * 0.5} viewBox="0 0 32 16">
        <path
          d="M1 12 L7 4 L13 12 L19 4 L25 12 L31 4"
          fill="none"
          stroke={colour}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg width={size} height={size * 0.6} viewBox="0 0 24 14">
        {[0, 1, 2, 3].map((column) =>
          [0, 1].map((row) => (
            <rect
              key={`${column}-${row}`}
              x={column * 6}
              y={row * 7}
              width="6"
              height="7"
              fill={(column + row) % 2 === 0 ? colour : 'transparent'}
            />
          ))
        )}
      </svg>
    );
  }
  // the four-point sparkle
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path
        d="M8 0 C8.8 5.2 10.8 7.2 16 8 C10.8 8.8 8.8 10.8 8 16 C7.2 10.8 5.2 8.8 0 8 C5.2 7.2 7.2 5.2 8 0 Z"
        fill={colour}
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   The polaroid
   --------------------------------------------------------------------------- */

/**
 * A photograph taped into the page.
 *
 * `eager` is not a default: the one above the fold must be fetched
 * immediately or the first screen is a white rectangle, which is
 * exactly what the reader complained about. The ones further down
 * stay lazy.
 *
 * The frame wrapper is `overflow-visible` so the tilt and the corner
 * beads are never sliced; only the photograph itself is clipped.
 */
export function PolaroidSnap({
  src,
  index = 0,
  alt,
  caption,
  number,
  tags = [],
  tilt = '-rotate-2',
  tape = 'bg-[#FDE8E4]',
  loading = 'lazy',
  className = '',
  testId,
}) {
  return (
    <figure
      className={clsx(
        'polaroid-snap relative overflow-visible rounded-[12px] bg-white p-2.5 pb-3',
        'border-2 border-[#4A3540] shadow-[0_8px_0_#E2D6C3]',
        tilt,
        'transition-transform duration-300 hover:rotate-0 hover:-translate-y-1 active:scale-[0.98]',
        className
      )}
      data-testid={testId}
    >
      {/* The tape over the top edge, a little off square. */}
      <span
        className={clsx(
          'absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2',
          'border border-[#4A3540]/20 opacity-85 mix-blend-multiply',
          tape
        )}
        aria-hidden="true"
      />
      {/* The polka-dot corner bead. */}
      <span className="absolute -right-2 -top-2 z-10" aria-hidden="true">
        <MemphisBead kind="dot" colour="#E8B84B" size={16} />
      </span>

      <span className="block aspect-[4/3] overflow-hidden rounded-[6px] bg-[#F0EAE0]">
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding={loading === 'eager' ? 'sync' : 'async'}
          className="h-full w-full object-cover"
          // A frame that cannot fetch its photograph shows an
          // illustrated scene of the same subject, never a blank.
          onError={(event) => {
            const fallback = editorialFallback(index);
            if (event.currentTarget.src !== fallback) {
              event.currentTarget.src = fallback;
            }
          }}
        />
      </span>

      <figcaption className="mt-2.5 px-1">
        {number ? (
          <span className="text-[10px] font-extrabold tracking-[0.14em] text-[#9E3B24]">
            {number}
          </span>
        ) : null}
        <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-[#4A3540]">
          {caption}
        </p>
        {tags.length > 0 ? (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#4A3540]/35 bg-[#FFF6D6] px-2 py-0.5 text-[10px] font-bold text-[#5C4A2E]"
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export { MemphisBead };
export default CampusHeading;
