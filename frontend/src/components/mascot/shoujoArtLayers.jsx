/**
 * The drawing parts of the shoujo companion.
 *
 * The companion is a semi-chibi character in the 2000s retro shoujo
 * manner - CLAMP's *Kobato.*, Arina Tanemura's lineart - which means a
 * head about two and a half times the body's height, enormous eyes
 * built in layers, and a white die-cut border around the whole figure
 * as though it were a sticker.
 *
 * All of that is a lot of SVG, so it lives here rather than inside the
 * component: the gradients and the filter in one place, the eye in a
 * function (it is drawn twice and it is the most intricate part of the
 * character), and each persona's hair, clothes and prop in its own
 * function. The component is then just the rig and the behaviour.
 *
 * Two rules hold everywhere in this file:
 *
 *   - the lineart is never pure black. It is a warm berry-sepia,
 *     #4A3540, because a black outline against pastel fills reads as
 *     clip-art rather than as watercolour;
 *
 *   - the proportions are fixed. The head occupies y=24..118, the
 *     torso y=114..196, the legs y=192..238, inside a 200x260 box.
 *     Those numbers are the 2.5-head ratio, and every part is placed
 *     against them.
 */

/** The lineart colour. Never #000000. */
export const INK = '#4A3540';
/** The silhouette weight, and the inner-detail weight. */
export const STROKE_OUTER = 2.0;
export const STROKE_INNER = 1.3;

/** Where each band of the body sits, in the 200x260 box. */
export const ANATOMY = Object.freeze({
  head: { top: 24, bottom: 118, cx: 100, cy: 78, chinX: 100, chinY: 114 },
  torso: { top: 114, bottom: 196, shoulderY: 120, hemY: 192 },
  legs: { top: 192, bottom: 238, leftX: 86, rightX: 114 },
  eyes: { leftCx: 80, rightCx: 120, cy: 84, rx: 9.5, ry: 11.5 },
});

/** The two personas' palettes. */
export const PALETTES = Object.freeze({
  kobato: Object.freeze({
    irisTop: '#4A2E35',
    irisMid: '#9E6B55',
    irisLow: '#F3D19C',
    hairDark: '#6E473B',
    hairLight: '#9E6B55',
    ribbon: '#F4A6A0',
    bow: '#E07A5F',
    dress: '#FCE8E6',
    dressAlt: '#FFFDF9',
    skin: '#FBE6DA',
    cheek: '#F7B2AD',
  }),
  bishounen: Object.freeze({
    irisTop: '#2F4842',
    irisMid: '#6B9E88',
    irisLow: '#D8F3DC',
    hairDark: '#8A8275',
    hairLight: '#CFC7B5',
    ribbon: '#52796F',
    bow: '#52796F',
    dress: '#EFECE6',
    dressAlt: '#FFFDF9',
    skin: '#FBE6DA',
    cheek: '#F7B2AD',
  }),
});

/**
 * The gradients, the glow and the sticker border.
 *
 * `uid` keeps the ids unique: two companions on the same page would
 * otherwise both define `#irisGradient`, and the second definition
 * would win for both of them.
 */
export function ShoujoDefs({ uid, palette }) {
  return (
    <defs>
      {/* The iris, read top to bottom: deep at the lash line, warm
          through the middle, glowing where the light pools at the
          bottom. That vertical run is what makes a shoujo eye look
          wet rather than flat. */}
      <linearGradient id={`${uid}-iris`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={palette.irisTop} />
        <stop offset="55%" stopColor={palette.irisMid} />
        <stop offset="100%" stopColor={palette.irisLow} />
      </linearGradient>

      <linearGradient id={`${uid}-hair`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor={palette.hairLight} />
        <stop offset="60%" stopColor={palette.hairDark} />
        <stop offset="100%" stopColor={palette.hairDark} />
      </linearGradient>

      <linearGradient id={`${uid}-straw`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#F6E7C4" />
        <stop offset="100%" stopColor="#E0C79A" />
      </linearGradient>

      <linearGradient id={`${uid}-cloth`} x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor={palette.dressAlt} />
        <stop offset="100%" stopColor={palette.dress} />
      </linearGradient>

      <radialGradient id={`${uid}-bottle-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#FFF3B0" stopOpacity="0.85" />
        <stop offset="60%" stopColor="#F7B2AD" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#F7B2AD" stopOpacity="0" />
      </radialGradient>

      <radialGradient id={`${uid}-cheek`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor={palette.cheek} stopOpacity="0.75" />
        <stop offset="100%" stopColor={palette.cheek} stopOpacity="0" />
      </radialGradient>

      {/* The die-cut sticker border: grow the silhouette, flood the
          grown shape white, then lay the artwork back on top of it.
          The drop shadow underneath lifts the sticker off the card. */}
      <filter id={`${uid}-sticker`} x="-25%" y="-25%" width="150%" height="150%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="grown" />
        <feFlood floodColor="#FFFDF9" result="white" />
        <feComposite in="white" in2="grown" operator="in" result="border" />
        <feDropShadow
          in="border"
          dx="0"
          dy="6"
          stdDeviation="6"
          floodColor="#4A3540"
          floodOpacity="0.14"
          result="lifted"
        />
        <feMerge>
          <feMergeNode in="lifted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/**
 * One eye, in seven layers.
 *
 * The layers are, from the back: the white, the graded iris, the lash
 * shadow that falls across the top third of it, the pupil, the arc of
 * light along the bottom rim, three catchlights, and the lash crown
 * with its double-eyelid crease.
 *
 * The catchlights are the part that matters. An iris without them is
 * a dark hole; the big one top-left, the small droplet bottom-right
 * and the four-point star between them are what make the eye look
 * like it is holding light.
 *
 * Closed, all of that is replaced by a single happy downward curve
 * with a sparkle at the outer corner.
 */
export function renderShoujoEye(cx, cy, isBlinking, palette, uid, side = 'left') {
  const outward = side === 'left' ? -1 : 1;

  if (isBlinking) {
    return (
      <g data-eye={side} data-blinking="true">
        <path
          d={`M ${cx - 9} ${cy} Q ${cx} ${cy + 7} ${cx + 9} ${cy}`}
          fill="none"
          stroke="#3A222C"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx + outward * 11} ${cy - 5} l 1.6 1.6 l -1.6 1.6 l -1.6 -1.6 z`}
          fill="#FFFFFF"
        />
      </g>
    );
  }

  return (
    <g data-eye={side} data-blinking="false">
      {/* 1. the white */}
      <ellipse cx={cx} cy={cy} rx="9.5" ry="11.5" fill="#FFFDF9" />
      {/* 2. the graded iris */}
      <ellipse cx={cx} cy={cy + 1} rx="8" ry="10.5" fill={`url(#${uid}-iris)`} />
      {/* 3. the lash shadow across the top third */}
      <path
        d={`M ${cx - 8} ${cy - 4} Q ${cx} ${cy + 2} ${cx + 8} ${cy - 4} L ${cx + 8} ${cy - 9} Q ${cx} ${cy - 12} ${cx - 8} ${cy - 9} Z`}
        fill="rgba(58, 34, 44, 0.35)"
      />
      {/* 4. the pupil */}
      <ellipse cx={cx} cy={cy + 1.5} rx="3.8" ry="4.8" fill="#3A222C" />
      {/* 5. the light pooling along the bottom rim */}
      <path
        d={`M ${cx - 6} ${cy + 7} Q ${cx} ${cy + 10.5} ${cx + 6} ${cy + 7}`}
        fill="none"
        stroke="#FFF8E7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 6. the three catchlights */}
      <circle cx={cx - 3.5} cy={cy - 4} r="3.2" fill="#FFFFFF" />
      <circle cx={cx + 3.2} cy={cy + 4.5} r="1.8" fill="#FFFFFF" />
      <path
        d={`M ${cx + 4} ${cy - 6} L ${cx + 5.4} ${cy - 3} L ${cx + 4} ${cy} L ${cx + 2.6} ${cy - 3} Z`}
        fill="#FFFFFF"
      />
      {/* 7. the lash crown and the double eyelid */}
      <path
        d={`M ${cx - 10} ${cy - 10} Q ${cx} ${cy - 16} ${cx + 10} ${cy - 10}`}
        fill="none"
        stroke="#3A222C"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - 8} ${cy - 13} Q ${cx} ${cy - 18} ${cx + 8} ${cy - 13}`}
        fill="none"
        stroke="#7A5A64"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* the two feathered tips at the outer corner */}
      <path
        d={`M ${cx + outward * 9.5} ${cy - 10} l ${outward * 4} -3.5`}
        stroke="#3A222C"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + outward * 9} ${cy - 6.5} l ${outward * 4.2} -1.6`}
        stroke="#3A222C"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
}

/** The face every persona shares: the head shape, the cheeks, a mouth. */
export function renderFace(mood, blinking, palette, uid) {
  const { head, eyes } = ANATOMY;
  const mouth =
    mood === 'happy' || mood === 'celebrate'
      ? `M 94 100 Q 100 106 106 100`
      : mood === 'alert'
      ? `M 95 103 Q 100 99 105 103`
      : `M 96 101 Q 100 104 104 101`;

  return (
    <g className="shoujo-face">
      {/* the head, with a soft cheek contour and a delicate chin */}
      <path
        d={`M 100 ${head.top + 4}
            C 128 ${head.top + 4} 142 ${head.cy - 4} 140 ${head.cy + 10}
            C 138 ${head.cy + 26} 120 ${head.chinY} 100 ${head.chinY}
            C 80 ${head.chinY} 62 ${head.cy + 26} 60 ${head.cy + 10}
            C 58 ${head.cy - 4} 72 ${head.top + 4} 100 ${head.top + 4} Z`}
        fill={palette.skin}
        stroke={INK}
        strokeWidth={STROKE_OUTER}
        strokeLinejoin="round"
      />
      {/* the blush, under the eyes */}
      <ellipse cx="72" cy="96" rx="8" ry="4.5" fill={`url(#${uid}-cheek)`} />
      <ellipse cx="128" cy="96" rx="8" ry="4.5" fill={`url(#${uid}-cheek)`} />

      {renderShoujoEye(eyes.leftCx, eyes.cy, blinking, palette, uid, 'left')}
      {renderShoujoEye(eyes.rightCx, eyes.cy, blinking, palette, uid, 'right')}

      {/* the nose is a hint, and the mouth carries the mood */}
      <path d="M 100 92 l 1.6 2.2 l -3.2 0 z" fill="#C89A8C" />
      <path
        d={mouth}
        fill="none"
        stroke={INK}
        strokeWidth={STROKE_INNER}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Kobato: the straw hat, the chestnut waves, the frilled dress, the bottle. */
export function renderKobato(palette, uid, mood) {
  return (
    <g data-persona="kobato">
      {/* --- hair behind the head ------------------------------------ */}
      <g className="shoujo-rig-hair" data-part="hair-back">
        <path
          d="M 100 26
             C 136 26 150 54 148 84
             C 146 112 142 140 136 164
             C 130 150 128 126 126 110
             C 120 118 108 120 100 120
             C 92 120 80 118 74 110
             C 72 126 70 150 64 164
             C 58 140 54 112 52 84
             C 50 54 64 26 100 26 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
      </g>

      {/* --- the body, drawn before the front hair ------------------- */}
      <g data-part="body">
        {/* the frilled dress: narrow at the shoulders, flared at the hem */}
        <path
          d="M 100 118
             C 86 118 78 122 76 132
             C 72 150 66 174 62 192
             L 138 192
             C 134 174 128 150 124 132
             C 122 122 114 118 100 118 Z"
          fill={`url(#${uid}-cloth)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
        {/* the scalloped lace along the hem */}
        <path
          d="M 62 192 q 6 8 12 0 q 6 8 12 0 q 6 8 12 0 q 6 8 12 0 q 6 8 12 0 q 6 8 12 0"
          fill="#FFFDF9"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        {/* the lace at the collar */}
        <path
          d="M 82 124 q 4.5 6 9 0 q 4.5 6 9 0 q 4.5 6 9 0"
          fill="#FFFDF9"
          stroke={INK}
          strokeWidth={STROKE_INNER}
        />
        {/* the chest ribbon */}
        <path
          d="M 100 128 l -9 -6 l 0 10 z M 100 128 l 9 -6 l 0 10 z"
          fill={palette.bow}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <circle cx="100" cy="128" r="2.6" fill={palette.bow} stroke={INK} strokeWidth="1" />

        {/* the arms, coming round to hold the bottle */}
        <path
          d="M 78 132 C 70 146 74 158 88 162"
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinecap="round"
        />
        <path
          d="M 122 132 C 130 146 126 158 112 162"
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinecap="round"
        />

        {/* the legs and the ribbon shoes */}
        <path d="M 86 192 l 0 32" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M 114 192 l 0 32" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <g className="shoujo-rig-foot-left">
          <ellipse cx="86" cy="230" rx="9" ry="6" fill={palette.dressAlt} stroke={INK} strokeWidth={STROKE_INNER} />
          <path d="M 86 224 l -4 -4 l 8 0 z" fill={palette.ribbon} stroke={INK} strokeWidth="1" />
        </g>
        <g className="shoujo-rig-foot-right">
          <ellipse cx="114" cy="230" rx="9" ry="6" fill={palette.dressAlt} stroke={INK} strokeWidth={STROKE_INNER} />
          <path d="M 114 224 l -4 -4 l 8 0 z" fill={palette.ribbon} stroke={INK} strokeWidth="1" />
        </g>
      </g>

      {renderFace(mood, false, palette, uid)}

      {/* --- the side locks that frame the cheeks ------------------- */}
      <g className="shoujo-rig-hair" data-part="hair-front">
        {/* the bangs, with the zig-zag angel halo across them */}
        <path
          d="M 100 26
             C 74 26 58 46 58 70
             C 66 58 76 50 88 48
             C 84 56 84 62 88 68
             C 94 56 104 50 116 52
             C 126 54 136 60 142 70
             C 142 46 126 26 100 26 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
        <path
          d="M 70 54 l 8 6 l -5 7 l 9 5 l -6 7 l 10 4"
          fill="none"
          stroke="rgba(255, 248, 231, 0.55)"
          strokeWidth="5"
          strokeLinecap="round"
          data-part="halo-highlight"
        />
        {/* twin side locks */}
        <path
          d="M 60 70 C 54 94 56 116 62 134 C 68 118 70 96 70 76 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <path
          d="M 140 70 C 146 94 144 116 138 134 C 132 118 130 96 130 76 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
      </g>

      {/* --- the straw hat, above and behind the crown -------------- */}
      <g className="shoujo-hat">
        <path
          d="M 44 54 C 56 34 76 22 100 22 C 124 22 144 34 156 54 C 138 46 120 42 100 42 C 80 42 62 46 44 54 Z"
          fill={`url(#${uid}-straw)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
        <path
          d="M 62 48 C 72 32 86 24 100 24 C 114 24 128 32 138 48"
          fill="none"
          stroke={palette.ribbon}
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* the sakura on the left brim: five petals and a leaf */}
        <g data-part="sakura" transform="translate(58 44)">
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="0"
              cy="-5"
              rx="3"
              ry="4.6"
              fill="#F9C9D4"
              stroke={INK}
              strokeWidth="0.9"
              transform={`rotate(${deg})`}
            />
          ))}
          <circle cx="0" cy="0" r="2" fill="#F4E285" />
          <path d="M 7 4 q 7 1 9 7 q -7 1 -9 -7 z" fill="#A8E6CF" stroke={INK} strokeWidth="0.8" />
        </g>
      </g>

      {/* --- the konpeito bottle, held at the chest ----------------- */}
      <g className="shoujo-prop" data-part="konpeito-bottle">
        <circle cx="100" cy="162" r="22" fill={`url(#${uid}-bottle-glow)`} />
        <path
          d="M 94 146 l 12 0 l 0 6 l 4 4 l 0 18 q 0 4 -4 4 l -12 0 q -4 0 -4 -4 l 0 -18 l 4 -4 z"
          fill="rgba(227, 242, 234, 0.75)"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <rect x="95" y="141" width="10" height="5" rx="1.6" fill="#C9A227" stroke={INK} strokeWidth="1" />
        {/* the candies inside */}
        <path d="M 96 166 l 1.4 2.6 l 2.6 1.4 l -2.6 1.4 l -1.4 2.6 l -1.4 -2.6 l -2.6 -1.4 l 2.6 -1.4 z" fill="#F4E285" />
        <path d="M 103 171 l 1.2 2.2 l 2.2 1.2 l -2.2 1.2 l -1.2 2.2 l -1.2 -2.2 l -2.2 -1.2 l 2.2 -1.2 z" fill="#F7B2AD" />
        <path d="M 99 157 l 1.1 2 l 2 1.1 l -2 1.1 l -1.1 2 l -1.1 -2 l -2 -1.1 l 2 -1.1 z" fill="#A8E6CF" />
        {/* the hands holding it */}
        <circle cx="88" cy="164" r="5" fill={palette.skin} stroke={INK} strokeWidth={STROKE_INNER} />
        <circle cx="112" cy="164" r="5" fill={palette.skin} stroke={INK} strokeWidth={STROKE_INNER} />
      </g>
    </g>
  );
}

/** Bishounen: fluffy hair, the cardigan and ribbon tie, the ledger. */
export function renderBishounen(palette, uid, mood) {
  return (
    <g data-persona="bishounen">
      {/* --- hair behind ------------------------------------------- */}
      <g className="shoujo-rig-hair" data-part="hair-back">
        <path
          d="M 100 24
             C 132 24 146 48 146 76
             C 146 98 142 114 138 128
             C 134 114 132 98 130 86
             C 120 94 108 96 100 96
             C 92 96 80 94 70 86
             C 68 98 66 114 62 128
             C 58 114 54 98 54 76
             C 54 48 68 24 100 24 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
      </g>

      {/* --- the body: shirt, cardigan, ribbon tie ------------------ */}
      <g data-part="body">
        {/* the ivory collared shirt */}
        <path
          d="M 100 118 C 90 118 84 121 82 128 L 80 192 L 120 192 L 118 128 C 116 121 110 118 100 118 Z"
          fill="#FFFDF9"
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
        {/* the collar */}
        <path
          d="M 92 120 l 8 8 l 8 -8"
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinecap="round"
        />
        {/* the knit cardigan over it, open down the front */}
        <path
          d="M 100 118
             C 84 118 76 123 74 134
             C 70 152 66 174 64 192
             L 86 192 L 88 136
             M 100 118
             C 116 118 124 123 126 134
             C 130 152 134 174 136 192
             L 114 192 L 112 136"
          fill={`url(#${uid}-cloth)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
        {/* the ribbon tie */}
        <path
          d="M 100 130 l -8 -5 l 0 9 z M 100 130 l 8 -5 l 0 9 z"
          fill={palette.bow}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <circle cx="100" cy="130" r="2.4" fill={palette.bow} stroke={INK} strokeWidth="1" />
        {/* the pocket-watch chain */}
        <path
          d="M 112 142 q 8 6 4 14"
          fill="none"
          stroke="#C9A227"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="117" cy="158" r="3.4" fill="#F4E285" stroke={INK} strokeWidth="1" />

        {/* one arm holds the ledger, the other rests */}
        <path d="M 76 134 C 68 148 72 160 86 164" fill="none" stroke={INK} strokeWidth={STROKE_OUTER} strokeLinecap="round" />
        <path d="M 124 134 C 132 146 130 156 124 162" fill="none" stroke={INK} strokeWidth={STROKE_OUTER} strokeLinecap="round" />

        {/* the legs and shoes */}
        <path d="M 86 192 l 0 32" stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
        <path d="M 114 192 l 0 32" stroke={INK} strokeWidth="6.5" strokeLinecap="round" />
        <g className="shoujo-rig-foot-left">
          <ellipse cx="86" cy="230" rx="9.5" ry="6" fill="#8A6D5A" stroke={INK} strokeWidth={STROKE_INNER} />
        </g>
        <g className="shoujo-rig-foot-right">
          <ellipse cx="114" cy="230" rx="9.5" ry="6" fill="#8A6D5A" stroke={INK} strokeWidth={STROKE_INNER} />
        </g>
      </g>

      {renderFace(mood, false, palette, uid)}

      {/* --- the feathery swept bangs ------------------------------- */}
      <g className="shoujo-rig-hair" data-part="hair-front">
        <path
          d="M 100 24
             C 74 24 56 44 56 70
             C 64 56 74 48 86 46
             C 82 54 82 60 86 66
             C 92 54 102 48 114 50
             C 126 52 136 58 144 70
             C 144 44 126 24 100 24 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
        />
        {/* strand highlights */}
        <path
          d="M 76 50 q 10 4 16 12 M 108 50 q 12 4 20 14"
          fill="none"
          stroke="rgba(255, 248, 231, 0.55)"
          strokeWidth="3.4"
          strokeLinecap="round"
          data-part="halo-highlight"
        />
        {/* the knit beret, tilted */}
        <path
          d="M 64 46 C 70 28 86 20 102 22 C 120 24 134 34 136 48 C 118 40 84 38 64 46 Z"
          fill={palette.dress}
          stroke={INK}
          strokeWidth={STROKE_OUTER}
          strokeLinejoin="round"
          data-part="beret"
        />
        <circle cx="100" cy="21" r="3.4" fill={palette.ribbon} stroke={INK} strokeWidth="1" />
      </g>

      {/* --- the ledger and the quill ------------------------------- */}
      <g className="shoujo-prop" data-part="kakeibo-ledger">
        <path
          d="M 76 152 l 26 -5 l 0 24 l -26 5 z"
          fill="#8A5B4C"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <path d="M 78 156 l 22 -4 M 78 162 l 22 -4" stroke="#F6E7C4" strokeWidth="1.4" />
        <circle cx="86" cy="164" r="5" fill={palette.skin} stroke={INK} strokeWidth={STROKE_INNER} />
        {/* the quill, floating */}
        <g className="shoujo-quill">
          <path
            d="M 118 140 q 10 -10 16 -4 q -4 8 -16 10 z"
            fill="#FFFDF9"
            stroke={INK}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <path d="M 118 146 l -5 5" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        {/* drifting leaves */}
        <path d="M 138 170 q 5 1 6 5 q -5 1 -6 -5 z" fill="#A8E6CF" opacity="0.8" />
        <path d="M 60 176 q 5 1 6 5 q -5 1 -6 -5 z" fill="#A8E6CF" opacity="0.6" />
      </g>
    </g>
  );
}

/** The sakura petals and four-point stars that burst on a greeting. */
export function ShoujoSparkles() {
  const bits = [
    { x: 28, y: 60, s: 1.1, d: 0 },
    { x: 168, y: 78, s: 0.9, d: 180 },
    { x: 40, y: 150, s: 0.8, d: 360 },
    { x: 162, y: 164, s: 1.0, d: 540 },
    { x: 100, y: 16, s: 0.95, d: 720 },
    { x: 150, y: 36, s: 0.75, d: 900 },
  ];
  return (
    <g className="shoujo-sparkles" aria-hidden="true">
      {bits.map((b, i) =>
        i % 2 === 0 ? (
          <path
            key={i}
            className="shoujo-sparkle"
            style={{ '--shoujo-spark-delay': `${b.d}ms` }}
            transform={`translate(${b.x} ${b.y}) scale(${b.s})`}
            d="M 0 -7 L 2 -2 L 7 0 L 2 2 L 0 7 L -2 2 L -7 0 L -2 -2 Z"
            fill="#FFF8E7"
          />
        ) : (
          <ellipse
            key={i}
            className="shoujo-sparkle"
            style={{ '--shoujo-spark-delay': `${b.d}ms` }}
            transform={`translate(${b.x} ${b.y}) scale(${b.s}) rotate(25)`}
            rx="3.4"
            ry="5"
            fill="#F9C9D4"
          />
        )
      )}
    </g>
  );
}
