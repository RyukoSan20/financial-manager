/**
 * KanaheiStationeryMascot.
 *
 * A flat, two-dimensional Kanahei-style companion: a round cream body,
 * a single uniform warm-brown stroke, two dot eyes that blink, little
 * ears that wiggle, and rosy cheeks. It holds a small contextual prop -
 * a leaf when it is idle, a coin when it is happy - so it says a little
 * about what the page is doing.
 *
 * On hover or click it shows a `KakeiboHoverBoard` with a short note,
 * if one is given, so the mascot is a quiet way into a detail rather
 * than only decoration.
 *
 * It is drawn with plain SVG (viewBox 0 0 120 120) so it scales with
 * the text and needs no image file. An unknown state falls back to
 * `idle` rather than throwing.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import KakeiboHoverBoard from '../ui/KakeiboHoverBoard';

const STATES = ['idle', 'happy', 'thinking', 'alert'];

const STROKE = '#4A3F35';   // uniform warm-brown outline
const BODY = '#FFFDF9';     // warm off-white body
const CHEEK = '#F7B2AD';    // rosy cheeks
const LEAF = '#8FB996';     // sage leaf
const COIN = '#E8C66B';     // warm coin

function Prop({ state }) {
  if (state === 'happy') {
    // A little coin held to the side.
    return (
      <g>
        <circle cx="92" cy="78" r="11" fill={COIN} stroke={STROKE} strokeWidth="2.5" />
        <text x="92" y="83" textAnchor="middle" fontSize="12" fontWeight="700" fill={STROKE}>¥</text>
      </g>
    );
  }
  if (state === 'alert') {
    return (
      <g>
        <text x="92" y="52" textAnchor="middle" fontSize="26" fontWeight="800" fill={STROKE}>!</text>
      </g>
    );
  }
  if (state === 'thinking') {
    return (
      <g fill={STROKE}>
        <circle cx="88" cy="46" r="2.4" />
        <circle cx="96" cy="40" r="1.8" opacity="0.75" />
        <circle cx="102" cy="35" r="1.3" opacity="0.5" />
      </g>
    );
  }
  // idle: a sage leaf sprig.
  return (
    <g>
      <path d="M90 84 q10 -14 22 -10 q-2 14 -16 16 q-6 1 -6 -6 Z" fill={LEAF} stroke={STROKE} strokeWidth="2" />
      <path d="M92 84 q8 -6 18 -8" fill="none" stroke={STROKE} strokeWidth="1.4" />
    </g>
  );
}

export default function KanaheiStationeryMascot({
  state = 'idle',
  size = 72,
  label = 'Kanahei',
  note,
  noteTitle,
  className = '',
  ...rest
}) {
  const safe = STATES.includes(state) ? state : 'idle';
  const [open, setOpen] = useState(false);
  const hasBoard = Boolean(note || noteTitle);

  return (
    <span
      className={clsx('kanahei-mascot', className)}
      data-kanahei
      data-state={safe}
      style={{ display: 'inline-flex', position: 'relative' }}
      onMouseEnter={hasBoard ? () => setOpen(true) : undefined}
      onMouseLeave={hasBoard ? () => setOpen(false) : undefined}
      {...rest}
    >
      <button
        type="button"
        className="kanahei-mascot__button"
        aria-label={label}
        onClick={hasBoard ? () => setOpen((v) => !v) : undefined}
        style={{ lineHeight: 0, background: 'none', border: 'none', padding: 0, cursor: hasBoard ? 'pointer' : 'default' }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 120 120"
          fill="none"
          role="img"
          aria-hidden="true"
          className="kanahei-mascot__svg"
        >
          {/* Ears - they wiggle on the group. */}
          <g className="kanahei-ear kanahei-ear--left">
            <ellipse cx="38" cy="26" rx="9" ry="14" fill={BODY} stroke={STROKE} strokeWidth="3" />
          </g>
          <g className="kanahei-ear kanahei-ear--right">
            <ellipse cx="82" cy="26" rx="9" ry="14" fill={BODY} stroke={STROKE} strokeWidth="3" />
          </g>

          {/* Body / head. */}
          <circle cx="60" cy="64" r="40" fill={BODY} stroke={STROKE} strokeWidth="3" />

          {/* Cheeks. */}
          <circle cx="40" cy="72" r="6" fill={CHEEK} opacity="0.85" />
          <circle cx="80" cy="72" r="6" fill={CHEEK} opacity="0.85" />

          {/* Eyes - the blink is a scaleY on these. */}
          <g className="kanahei-eyes" fill={STROKE}>
            <circle cx="48" cy="60" r="4.2" />
            <circle cx="72" cy="60" r="4.2" />
          </g>

          {/* Mouth. */}
          {safe === 'happy' ? (
            <path d="M52 74 q8 8 16 0" fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
          ) : safe === 'alert' ? (
            <ellipse cx="60" cy="76" rx="4" ry="3.2" fill={STROKE} />
          ) : (
            <path d="M54 74 q6 5 12 0" fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
          )}

          <Prop state={safe} />
        </svg>
      </button>

      {hasBoard && open ? (
        <div
          style={{
            position: 'absolute',
            bottom: `calc(100% + 8px)`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
          }}
        >
          <KakeiboHoverBoard title={noteTitle || label} side="bottom">
            {note ? <p className="text-xs" style={{ opacity: 0.85 }}>{note}</p> : null}
          </KakeiboHoverBoard>
        </div>
      ) : null}
    </span>
  );
}

export { KanaheiStationeryMascot, STATES };
