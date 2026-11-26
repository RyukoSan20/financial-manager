/**
 * The portrait puppet: the real character painting, hinged.
 *
 * The painting is one flat picture per character, so this is a paper
 * puppet, not a skeleton: three overlapping bands of the same picture
 * (head, torso, legs) cut by scripts/build_unity_koban_assets.py, each
 * turning a few degrees about its own pivot. At rest the bands line
 * up and the figure is exactly the artist's painting.
 *
 * Six channels, all of them transforms or opacity:
 *   1  breathing      the torso rises on a 2.8s sine
 *   2  head tilt      +-3.5deg, 0.35s behind the torso
 *   3  blink          a double blink every 3.6s, and a twinkle in the eye
 *   4  lip-sync       closed / half / open at 110ms while `isTalking`
 *   5  mood           happy, walk, sweat, think
 *   6  drag           a sparkle trail, and petals on release
 *
 * The eyes and the mouth are drawn OVER the painting, so they have to
 * sit on the painted ones. FACE holds where those are, per character,
 * as percentages of the figure, read off the artwork.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import RIGS from '../data/rigs.js';

/** [cx, cy] of each eye, its [w, h], and the mouth - % of the figure. */
export const FACE = Object.freeze({
  koneko: { eyeL: [35.2, 39.4], eyeR: [64.4, 39.4], eye: [12.2, 8.8], mouth: [49.6, 45.6], skin: '#FCDCC6', lash: '#5A3A2E' },
  minori: { eyeL: [35.8, 39.8], eyeR: [63.8, 39.8], eye: [12.8, 9.4], mouth: [49.6, 47.4], skin: '#FCDCC8', lash: '#4A2E33' },
  kaneru: { eyeL: [35.5, 40.2], eyeR: [65.0, 40.2], eye: [12.0, 8.4], mouth: [50.0, 48.8], skin: '#FCDCC6', lash: '#33241F' },
  kogane: { eyeL: [35.0, 39.2], eyeR: [63.0, 39.2], eye: [11.6, 9.0], mouth: [49.3, 46.6], skin: '#FEE6D3', lash: '#6B4A2E' },
  mone: { eyeL: [37.5, 37.3], eyeR: [62.0, 37.3], eye: [10.6, 7.6], mouth: [49.6, 42.8], skin: '#FDE0CC', lash: '#5A3030' },
  zenimaru: { eyeL: [34.5, 40.6], eyeR: [64.5, 40.6], eye: [12.0, 9.2], mouth: [49.6, 48.2], skin: '#FEE6D5', lash: '#4A3A30' },
});

const MOODS = ['happy', 'walk', 'sweat', 'think'];
const VISEMES = ['closed', 'half', 'open'];
let serial = 0;

const layerStyle = (rig, name) => {
  const l = rig.layers[name];
  return {
    left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`,
    transformOrigin: `${l.pivot[0]}% ${l.pivot[1]}%`,
    backgroundImage: `url(/koban-assets/rig/${rig.id}/${name}.webp)`,
  };
};

export default function RiggedCharacterPuppet({
  who = 'koneko',
  mood = 'happy',
  isTalking = false,
  size = 220,
  draggable = false,
  particles = true,
  className = '',
  label,
  ...rest
}) {
  const rig = RIGS[who] || RIGS.koneko;
  const face = FACE[rig.id];
  const safeMood = MOODS.includes(mood) ? mood : 'happy';
  const head = rig.layers.head_base;

  // Channel 4: the mouth, stepped while the character is speaking.
  const [viseme, setViseme] = useState(0);
  useEffect(() => {
    if (!isTalking) { setViseme(0); return undefined; }
    const id = window.setInterval(() => setViseme((v) => (v + 1) % VISEMES.length), 110);
    return () => window.clearInterval(id);
  }, [isTalking]);

  // Channel 6: drag.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [held, setHeld] = useState(false);
  const [bits, setBits] = useState([]);
  const origin = useRef({ x: 0, y: 0, dist: 0, moved: false });

  const spawn = useCallback((x, y, fall) => {
    const kinds = ['is-glint', '', 'is-star'];
    const colours = fall ? ['#F7B2AD', '#F4E285', '#F9C9D6', '#FFFFFF', '#A8E6CF'] : ['#F4C542', '#FFF0B8', '#FFFFFF'];
    const batch = Array.from({ length: fall ? 18 : 1 }, (_, i) => {
      serial += 1;
      return {
        id: serial, fall, x, y,
        kind: kinds[(serial + i) % 3], colour: colours[(serial + i) % colours.length],
        dx: (Math.random() - 0.5) * (fall ? 170 : 26), drift: (Math.random() - 0.5) * (fall ? 80 : 18),
        spin: (Math.random() - 0.5) * 540, delay: fall ? Math.random() * 200 : 0, dur: fall ? 1100 + Math.random() * 800 : 700,
      };
    });
    setBits((cur) => [...cur, ...batch].slice(-44));
    window.setTimeout(() => setBits((cur) => cur.filter((b) => !batch.includes(b))), fall ? 2200 : 900);
  }, []);

  const onPointerDown = (e) => {
    if (!draggable || (e.button !== undefined && e.button !== 0)) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, dist: 0, moved: false };
    setHeld(true);
  };
  const onPointerMove = (e) => {
    if (!held) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) origin.current.moved = true;
    setOffset({ x: dx, y: dy });
    if (dist - origin.current.dist > 16) { origin.current.dist = dist; spawn(e.clientX, e.clientY, false); }
  };
  const onPointerUp = (e) => {
    if (!held) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setHeld(false);
    setOffset({ x: 0, y: 0 });
    spawn(e.clientX, e.clientY, true);
  };

  const usePose = safeMood === 'sweat' || safeMood === 'think';
  const eyeBox = (c) => ({
    left: `${((c[0] - face.eye[0] / 2 - head.x) / head.w) * 100}%`,
    top: `${((c[1] - face.eye[1] / 2 - head.y) / head.h) * 100}%`,
    width: `${(face.eye[0] / head.w) * 100}%`,
    height: `${(face.eye[1] / head.h) * 100}%`,
  });
  const mouthW = 11;
  const mouthH = 5.4;

  return (
    <span
      className={clsx('rcp', held && 'is-held', draggable && 'is-draggable', className)}
      data-testid="rigged-puppet"
      data-who={rig.id}
      data-mood={safeMood}
      data-talking={isTalking ? 'true' : 'false'}
      data-viseme={VISEMES[viseme]}
      role="img"
      aria-label={label || rig.id}
      style={{
        height: size,
        width: (size * rig.width) / rig.height,
        transform: held || offset.x || offset.y ? `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${Math.max(-10, Math.min(10, offset.x * 0.05))}deg)` : undefined,
        touchAction: draggable ? 'none' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      {...rest}
    >
      {bits.length ? (
        <span className="pointer-events-none fixed inset-0 z-[90]" aria-hidden="true">
          {bits.map((b) => (
            <span
              key={b.id}
              className={clsx(b.fall ? 'koban-confetti' : 'koban-particle', b.kind)}
              style={{
                left: b.x, top: b.y, color: b.colour,
                backgroundColor: b.fall && !b.kind ? b.colour : undefined,
                animationDuration: `${b.dur}ms`, animationDelay: `${b.delay}ms`,
                '--dx': `${b.dx}px`, '--drift': `${b.drift}px`, '--spin': `${b.spin}deg`,
              }}
            />
          ))}
        </span>
      ) : null}

      <span className="rcp-shadow" aria-hidden="true" />

      {/* The hinged painting. */}
      <span className={clsx('rcp-rig', usePose && 'is-hidden')} aria-hidden="true">
        <span className="rcp-layer rcp-leg rcp-leg-l" style={layerStyle(rig, 'limb_left_leg')} />
        <span className="rcp-layer rcp-leg rcp-leg-r" style={layerStyle(rig, 'limb_right_leg')} />
        <span className="rcp-layer rcp-torso" style={layerStyle(rig, 'torso_base')} />
        <span className="rcp-layer rcp-head" style={layerStyle(rig, 'head_base')}>
          {/* Channel 3: the lids and the catchlights. */}
          {[face.eyeL, face.eyeR].map((c, i) => (
            <span key={i} className="rcp-eye" style={eyeBox(c)}>
              <svg className="rcp-lid" viewBox="0 0 40 30" preserveAspectRatio="none">
                <ellipse cx="20" cy="15" rx="20" ry="15" fill={face.skin} />
                <path d="M3 16 Q20 27 37 16" fill="none" stroke={face.lash} strokeWidth="3.4" strokeLinecap="round" />
                <path d="M4 18 l-3 3 M36 18 l3 3" stroke={face.lash} strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <svg className="rcp-twinkle" viewBox="0 0 20 20">
                <path d="M10 0 Q11 9 20 10 Q11 11 10 20 Q9 11 0 10 Q9 9 10 0 Z" fill="#FFFFFF" />
              </svg>
            </span>
          ))}
          {/* Channel 4: the mouth, only while speaking. */}
          <svg
            className="rcp-mouth"
            viewBox="0 0 44 22"
            style={{
              left: `${((face.mouth[0] - mouthW / 2 - head.x) / head.w) * 100}%`,
              top: `${((face.mouth[1] - mouthH / 2 - head.y) / head.h) * 100}%`,
              width: `${(mouthW / head.w) * 100}%`,
              height: `${(mouthH / head.h) * 100}%`,
            }}
          >
            <ellipse cx="22" cy="11" rx="20" ry="10" fill={face.skin} />
            <path className="rcp-viseme rcp-viseme--closed" d="M13 9 Q17.5 14 22 9 Q26.5 14 31 9" fill="none" stroke={face.lash} strokeWidth="2.2" strokeLinecap="round" />
            <g className="rcp-viseme rcp-viseme--half">
              <path d="M14 8 Q22 19 30 8 Z" fill="#C2504F" stroke={face.lash} strokeWidth="2" strokeLinejoin="round" />
            </g>
            <g className="rcp-viseme rcp-viseme--open">
              <path d="M11 6 Q16.5 9 22 6 Q27.5 9 33 6 Q32 20 22 20 Q12 20 11 6 Z" fill="#C2504F" stroke={face.lash} strokeWidth="2" strokeLinejoin="round" />
              <path d="M16 16 Q22 12.5 28 16 Q22 20 16 16 Z" fill="#F29A9A" />
            </g>
          </svg>
        </span>
      </span>

      {/* Channel 5: the painted sweat and think poses, cross-faded in. */}
      <span className={clsx('rcp-pose', safeMood === 'sweat' && 'is-on')} style={{ backgroundImage: `url(/koban-assets/rig/${rig.id}/pose_sweat.webp)` }} aria-hidden="true" />
      <span className={clsx('rcp-pose', safeMood === 'think' && 'is-on')} style={{ backgroundImage: `url(/koban-assets/rig/${rig.id}/pose_think.webp)` }} aria-hidden="true" />

      {particles && safeMood === 'happy' ? (
        <span className="rcp-fx" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <svg key={i} className={`rcp-petal rcp-petal--${i}`} viewBox="0 0 20 20">
              {i === 1
                ? <path d="M10 0 Q11 9 20 10 Q11 11 10 20 Q9 11 0 10 Q9 9 10 0 Z" fill="#F4C542" />
                : <g fill="#F7A9C0">{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="10" cy="5" rx="3" ry="4.4" transform={`rotate(${r} 10 10)`} />)}<circle cx="10" cy="10" r="2" fill="#FFF0B8" /></g>}
            </svg>
          ))}
        </span>
      ) : null}
      {safeMood === 'sweat' ? (
        <svg className="rcp-drop" viewBox="0 0 20 28" aria-hidden="true"><path d="M10 1 Q19 14 16.5 20 A7.5 7.5 0 0 1 3.5 20 Q1 14 10 1 Z" fill="#8FCBF2" stroke="#4E9AE0" strokeWidth="1.6" /><ellipse cx="7.5" cy="18" rx="1.6" ry="3" fill="#FFFFFF" opacity=".8" /></svg>
      ) : null}
      {safeMood === 'think' ? (
        <svg className="rcp-bulb" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="15.5" fill="#FFFDF7" stroke="#4A2E2A" strokeWidth="1.6" />
          <path d="M17 7.5 a7 7 0 0 1 4 12.7 v2.3 h-8 v-2.3 a7 7 0 0 1 4 -12.7 z" fill="#F4C542" stroke="#4A2E2A" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M13.8 25 h6.4 M14.8 27.4 h4.4" stroke="#4A2E2A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : null}
    </span>
  );
}

export { RiggedCharacterPuppet };
