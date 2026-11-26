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

/**
 * Where each band of the body sits, in the 200x220 box.
 *
 * The proportions are the plump ones a chibi figurine is moulded in:
 * the head is 55% of the whole figure, the body is a short bell, and
 * the legs are two stubby rounded pegs. The earlier version had a
 * small head on a long body with two thin stick legs, which read as a
 * stick figure rather than as a character.
 */
export const ANATOMY = Object.freeze({
  head: { top: 18, bottom: 126, cx: 100, cy: 72, chinX: 100, chinY: 124 },
  torso: { top: 120, bottom: 178, shoulderY: 124, hemY: 176 },
  legs: { top: 172, bottom: 208, leftX: 84, rightX: 116 },
  eyes: { leftCx: 74, rightCx: 126, cy: 74, rx: 15, ry: 18 },
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
        {/* The two original drawings call this stop `irisLow`; the
            guild's palettes call it `irisBottom`. Accepting both means
            the bottom of the iris is never an undefined colour - which
            is what it silently was for all six of the guild. */}
        <stop offset="100%" stopColor={palette.irisBottom || palette.irisLow} />
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
  // The eye is sized from the anatomy rather than from fixed
  // numbers, so the plump proportions carry through to it: the eyes
  // have to be huge on a head this wide or the face reads as a mask.
  const RX = ANATOMY.eyes.rx;
  const RY = ANATOMY.eyes.ry;

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

  // Every dimension below is a fraction of the eye's own size, so
  // the seven layers stay in proportion to each other however the
  // eye is scaled.
  const s = RX / 9.5;

  return (
    <g data-eye={side} data-blinking="false">
      {/* 1. the white */}
      <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill="#FFFDF9" />
      {/* 2. the graded iris */}
      <ellipse cx={cx} cy={cy + RY * 0.09} rx={RX * 0.84} ry={RY * 0.91} fill={`url(#${uid}-iris)`} />
      {/* 3. the lash shadow across the top third */}
      <path
        d={`M ${cx - RX * 0.84} ${cy - RY * 0.35} Q ${cx} ${cy + RY * 0.17} ${cx + RX * 0.84} ${cy - RY * 0.35}
            L ${cx + RX * 0.84} ${cy - RY * 0.78} Q ${cx} ${cy - RY * 1.04} ${cx - RX * 0.84} ${cy - RY * 0.78} Z`}
        fill="rgba(58, 34, 44, 0.35)"
      />
      {/* 4. the pupil */}
      <ellipse cx={cx} cy={cy + RY * 0.13} rx={RX * 0.4} ry={RY * 0.42} fill="#3A222C" />
      {/* 5. the light pooling along the bottom rim */}
      <path
        d={`M ${cx - RX * 0.63} ${cy + RY * 0.61} Q ${cx} ${cy + RY * 0.91} ${cx + RX * 0.63} ${cy + RY * 0.61}`}
        fill="none"
        stroke="#FFF8E7"
        strokeWidth={2 * s}
        strokeLinecap="round"
      />
      {/* 6. the three catchlights */}
      <circle cx={cx - RX * 0.37} cy={cy - RY * 0.35} r={RX * 0.34} fill="#FFFFFF" />
      <circle cx={cx + RX * 0.34} cy={cy + RY * 0.39} r={RX * 0.19} fill="#FFFFFF" />
      <path
        d={`M ${cx + RX * 0.42} ${cy - RY * 0.63} L ${cx + RX * 0.57} ${cy - RY * 0.32}
            L ${cx + RX * 0.42} ${cy} L ${cx + RX * 0.27} ${cy - RY * 0.32} Z`}
        fill="#FFFFFF"
      />
      {/* 7. the lash crown and the double eyelid */}
      <path
        d={`M ${cx - RX * 1.05} ${cy - RY * 0.87} Q ${cx} ${cy - RY * 1.39} ${cx + RX * 1.05} ${cy - RY * 0.87}`}
        fill="none"
        stroke="#3A222C"
        strokeWidth={2.4 * s}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - RX * 0.84} ${cy - RY * 1.13} Q ${cx} ${cy - RY * 1.56} ${cx + RX * 0.84} ${cy - RY * 1.13}`}
        fill="none"
        stroke="#7A5A64"
        strokeWidth={1.1 * s}
        strokeLinecap="round"
      />
      {/* the two feathered tips at the outer corner */}
      <path
        d={`M ${cx + outward * RX} ${cy - RY * 0.87} l ${outward * RX * 0.42} -${RY * 0.3}`}
        stroke="#3A222C"
        strokeWidth={1.6 * s}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + outward * RX * 0.95} ${cy - RY * 0.56} l ${outward * RX * 0.44} -${RY * 0.14}`}
        stroke="#3A222C"
        strokeWidth={1.4 * s}
        strokeLinecap="round"
      />
    </g>
  );
}

/** The face every persona shares: the head shape, the cheeks, a mouth. */
export function renderFace(mood, blinking, palette, uid) {
  const { head, eyes } = ANATOMY;
  // The mouth sits low on the plump face, below the eyes, and a
  // happy mouth is a wide open curve rather than a small one.
  const mouth =
    mood === 'happy' || mood === 'celebrate'
      ? `M 88 104 Q 100 114 112 104`
      : mood === 'alert'
      ? `M 91 108 Q 100 101 109 108`
      : `M 94 106 Q 100 111 106 106`;

  return (
    <g className="shoujo-face">
      {/* The head: a wide, soft mochi shape.
          It is much wider than it is tall and its lower edge is a
          broad curve rather than a pointed chin - the shape a
          chibi figurine is moulded with. The earlier head was a
          narrow oval with a pointed chin, which read as a small
          head on a long body. */}
      <path
        d="M 44 72
           C 42 40 68 18 100 18
           C 132 18 158 40 156 72
           C 155 100 138 124 100 124
           C 62 124 45 100 44 72 Z"
        fill={palette.skin}
        stroke={INK}
        strokeWidth={STROKE_OUTER + 0.6}
        strokeLinejoin="round"
      />
      {/* The blush: warm peach airbrush ovals, wide and low. */}
      <ellipse cx="58" cy="94" rx="12" ry="7" fill="#FF9E9E" opacity="0.55" />
      <ellipse cx="142" cy="94" rx="12" ry="7" fill="#FF9E9E" opacity="0.55" />

      {renderShoujoEye(eyes.leftCx, eyes.cy, blinking, palette, uid, 'left')}
      {renderShoujoEye(eyes.rightCx, eyes.cy, blinking, palette, uid, 'right')}

      {/* the nose is a hint, and the mouth carries the mood */}
      <path d="M 100 96 l 1.8 2.4 l -3.6 0 z" fill="#C89A8C" />
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
        {/* The bell: short and wide, under the very large head. */}
        <path
          d="M 100 114 C 84 114 75 120 73 132 C 70 146 66 164 63 176
             L 137 176 C 134 164 130 146 127 132 C 125 120 116 114 100 114 Z"
          fill={`url(#${uid}-cloth)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER + 0.6}
          strokeLinejoin="round"
        />
        {/* the scalloped lace along the hem */}
        <path
          d="M 63 176 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0"
          fill="#FFFDF9"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        {/* the lace at the collar */}
        <path
          d="M 82 120 q 4.5 6 9 0 q 4.5 6 9 0 q 4.5 6 9 0"
          fill="#FFFDF9"
          stroke={INK}
          strokeWidth={STROKE_INNER}
        />
        {/* the chest ribbon */}
        <path
          d="M 100 124 l -9 -6 l 0 10 z M 100 124 l 9 -6 l 0 10 z"
          fill={palette.bow}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <circle cx="100" cy="124" r="2.8" fill={palette.bow} stroke={INK} strokeWidth="1" />

        {/* the arms, coming round to hold the bottle */}
        <path
          d="M 74 132 C 64 142 66 154 82 158"
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_OUTER + 0.6}
          strokeLinecap="round"
        />
        <path
          d="M 126 132 C 136 142 134 154 118 158"
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_OUTER + 0.6}
          strokeLinecap="round"
        />

        {/* The legs: stubby rounded pegs, not strokes. */}
        <g className="shoujo-rig-foot-left">
          <rect x="76" y="168" width="18" height="26" rx="9" fill={palette.skin} stroke={INK} strokeWidth={STROKE_OUTER} />
        </g>
        <g className="shoujo-rig-foot-right">
          <rect x="106" y="168" width="18" height="26" rx="9" fill={palette.skin} stroke={INK} strokeWidth={STROKE_OUTER} />
        </g>
        <g className="shoujo-rig-foot-left">
          <path d="M 74 192 q 11 -5 22 0 q 2 8 -4 10 l -14 0 q -6 -2 -4 -10 z"
            fill="#4A3540" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
          <path d="M 82 188 l -4 -4 l 8 0 z" fill={palette.ribbon} stroke={INK} strokeWidth="1" />
        </g>
        <g className="shoujo-rig-foot-right">
          <path d="M 104 192 q 11 -5 22 0 q 2 8 -4 10 l -14 0 q -6 -2 -4 -10 z"
            fill="#4A3540" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
          <path d="M 112 188 l -4 -4 l 8 0 z" fill={palette.ribbon} stroke={INK} strokeWidth="1" />
        </g>
      </g>

      {renderFace(mood, false, palette, uid)}

      {/* --- the side locks that frame the cheeks ------------------- */}
      <g className="shoujo-rig-hair" data-part="hair-front">
        {/* the bangs, with the zig-zag angel halo across them */}
        <path
          d="M 100 26
             C 70 16 50 36 48 64
             C 58 50 70 42 84 40
             C 80 50 80 56 84 63
             C 92 50 104 44 118 46
             C 130 48 142 56 150 64
             C 152 36 130 16 100 16 Z"
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
          d="M 50 62 C 40 88 42 112 50 132 C 58 114 60 92 60 70 Z"
          fill={`url(#${uid}-hair)`}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <path
          d="M 150 62 C 160 88 158 112 150 132 C 142 114 140 92 140 70 Z"
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
        <circle cx="100" cy="140" r="22" fill={`url(#${uid}-bottle-glow)`} />
        <path
          d="M 94 124 l 12 0 l 0 6 l 4 4 l 0 18 q 0 4 -4 4 l -12 0 q -4 0 -4 -4 l 0 -18 l 4 -4 z"
          fill="rgba(227, 242, 234, 0.75)"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <rect x="95" y="119" width="10" height="5" rx="1.6" fill="#C9A227" stroke={INK} strokeWidth="1" />
        {/* the candies inside */}
        <path d="M 96 144 l 1.4 2.6 l 2.6 1.4 l -2.6 1.4 l -1.4 2.6 l -1.4 -2.6 l -2.6 -1.4 l 2.6 -1.4 z" fill="#F4E285" />
        <path d="M 103 149 l 1.2 2.2 l 2.2 1.2 l -2.2 1.2 l -1.2 2.2 l -1.2 -2.2 l -2.2 -1.2 l 2.2 -1.2 z" fill="#F7B2AD" />
        <path d="M 99 135 l 1.1 2 l 2 1.1 l -2 1.1 l -1.1 2 l -1.1 -2 l -2 -1.1 l 2 -1.1 z" fill="#A8E6CF" />
        {/* the hands holding it */}
        <circle cx="88" cy="142" r="5.5" fill={palette.skin} stroke={INK} strokeWidth={STROKE_INNER} />
        <circle cx="112" cy="142" r="5.5" fill={palette.skin} stroke={INK} strokeWidth={STROKE_INNER} />
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
          d="M 100 114 C 90 114 84 118 82 126 L 80 176 L 120 176 L 118 126 C 116 118 110 114 100 114 Z"
          fill="#FFFDF9"
          stroke={INK}
          strokeWidth={STROKE_OUTER + 0.6}
          strokeLinejoin="round"
        />
        {/* the collar */}
        <path
          d="M 92 116 l 8 8 l 8 -8"
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinecap="round"
        />
        {/* the knit cardigan over it, open down the front */}
        <path
          d="M 100 114
             C 84 114 76 120 74 132
             C 70 148 66 166 64 176
             L 86 176 L 88 134
             M 100 114
             C 116 114 124 120 126 132
             C 130 148 134 166 136 176
             L 114 176 L 112 134"
          fill={`url(#${uid}-cloth)`}
          stroke={INK}
          strokeWidth={STROKE_OUTER + 0.6}
          strokeLinejoin="round"
        />
        {/* the ribbon tie */}
        <path
          d="M 100 126 l -8 -5 l 0 9 z M 100 126 l 8 -5 l 0 9 z"
          fill={palette.bow}
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <circle cx="100" cy="126" r="2.6" fill={palette.bow} stroke={INK} strokeWidth="1" />
        {/* the pocket-watch chain */}
        <path
          d="M 112 138 q 8 6 4 14"
          fill="none"
          stroke="#C9A227"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="117" cy="154" r="3.4" fill="#F4E285" stroke={INK} strokeWidth="1" />

        {/* one arm holds the ledger, the other rests */}
        <path d="M 76 132 C 68 144 72 154 86 158" fill="none" stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinecap="round" />
        <path d="M 124 132 C 132 144 130 154 124 158" fill="none" stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinecap="round" />

        {/* The legs: stubby rounded pegs, not strokes. */}
        <g className="shoujo-rig-foot-left">
          <rect x="76" y="168" width="18" height="26" rx="9" fill={palette.skin} stroke={INK} strokeWidth={STROKE_OUTER} />
        </g>
        <g className="shoujo-rig-foot-right">
          <rect x="106" y="168" width="18" height="26" rx="9" fill={palette.skin} stroke={INK} strokeWidth={STROKE_OUTER} />
        </g>
        <g className="shoujo-rig-foot-left">
          <path d="M 74 192 q 11 -5 22 0 q 2 8 -4 10 l -14 0 q -6 -2 -4 -10 z"
            fill="#4A3540" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
        </g>
        <g className="shoujo-rig-foot-right">
          <path d="M 104 192 q 11 -5 22 0 q 2 8 -4 10 l -14 0 q -6 -2 -4 -10 z"
            fill="#4A3540" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
        </g>
      </g>

      {renderFace(mood, false, palette, uid)}

      {/* --- the feathery swept bangs ------------------------------- */}
      <g className="shoujo-rig-hair" data-part="hair-front">
        <path
          d="M 100 24
             C 70 16 50 36 48 62
             C 58 50 70 42 82 40
             C 78 50 78 56 82 62
             C 90 50 102 44 116 46
             C 128 48 140 54 150 62
             C 152 36 130 16 100 16 Z"
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
          d="M 76 130 l 26 -5 l 0 24 l -26 5 z"
          fill="#8A5B4C"
          stroke={INK}
          strokeWidth={STROKE_INNER}
          strokeLinejoin="round"
        />
        <path d="M 78 134 l 22 -4 M 78 140 l 22 -4" stroke="#F6E7C4" strokeWidth="1.4" />
        <circle cx="86" cy="142" r="5.5" fill={palette.skin} stroke={INK} strokeWidth={STROKE_INNER} />
        {/* the quill, floating */}
        <g className="shoujo-quill">
          <path
            d="M 118 118 q 10 -10 16 -4 q -4 8 -16 10 z"
            fill="#FFFDF9"
            stroke={INK}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          <path d="M 118 124 l -5 5" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        {/* drifting leaves */}
        <path d="M 140 148 q 5 1 6 5 q -5 1 -6 -5 z" fill="#A8E6CF" opacity="0.8" />
        <path d="M 58 154 q 5 1 6 5 q -5 1 -6 -5 z" fill="#A8E6CF" opacity="0.6" />
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


/* =====================================================================
   The Petit Chibi Guild: six silhouettes, six props, and the emotes.

   Everything below is driven by the cast registry in
   `petitChibiCast.js`. The character is chosen by id and the
   renderers are looked up by the `hair` and `prop` names on that
   entry, so a seventh companion is a new row in the registry and two
   new cases here - never a new branch in the component.
   ===================================================================== */

/** The 2000s zig-zag angel ring across the bangs. */
function angelRing(d, width = 5) {
  return (
    <path
      d={d}
      fill="none"
      stroke="rgba(255, 248, 231, 0.55)"
      strokeWidth={width}
      strokeLinecap="round"
      data-part="halo-highlight"
    />
  );
}

/* --- the six hair silhouettes -------------------------------------- */

/** Mone: long waves, twin side locks, and the straw hat above them. */
function hairTwinLocksHat(p, uid) {
  return {
    back: (
      <g className="shoujo-rig-hair" data-part="hair-back" data-hair="twin_locks_hat">
        <path
          d="M 100 26 C 140 16 156 40 155 74 C 153 104 149 130 142 150
             C 130 150 128 126 126 110 C 120 118 108 120 100 120
             C 92 120 80 118 74 110 C 72 126 70 150 64 164
             C 56 132 50 104 45 74 C 41 40 60 16 100 16 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
      </g>
    ),
    front: (
      <>
        <g className="shoujo-rig-hair" data-part="hair-front">
        <path
          d="M 100 26 C 70 16 50 36 48 64 C 58 50 70 42 84 40
             C 80 50 80 56 84 63 C 92 50 104 44 118 46
             C 130 48 142 56 150 64 C 152 36 130 16 100 16 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {angelRing('M 70 54 l 8 6 l -5 7 l 9 5 l -6 7 l 10 4')}
        <path d="M 50 62 C 40 88 42 112 50 132 C 58 114 60 92 60 70 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
        <path d="M 150 62 C 160 88 158 112 150 132 C 142 114 140 92 140 70 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
      </g>
      <g className="shoujo-hat" data-part="straw-hat">
        <path d="M 38 48 C 52 24 74 10 100 10 C 126 10 148 24 162 48 C 142 38 122 32 100 32 C 78 32 58 38 38 48 Z"
          fill={`url(#${uid}-straw)`} stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinejoin="round" />
        <path d="M 58 42 C 68 24 84 14 100 14 C 116 14 132 24 142 42"
          fill="none" stroke={p.ribbon} strokeWidth="5" strokeLinecap="round" />
        <g data-part="sakura" transform="translate(52 38)">
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="0" cy="-5" rx="3" ry="4.6" fill="#F9C9D4"
              stroke={INK} strokeWidth="0.9" transform={`rotate(${deg})`} />
          ))}
          <circle cx="0" cy="0" r="2" fill="#F4E285" />
        </g>
        {/* the sprout, for the character whose name is a sprout */}
        <path d="M 140 40 q 6 -8 11 -3 q -4 7 -11 3 z" fill={p.accent} stroke={INK} strokeWidth="0.9" data-part="sprout" />
      </g>
      </>
    ),
  };
}

/** Kaneru: fluffy bishounen bangs under a knit beret. */
function hairFluffyBangs(p, uid) {
  return {
    back: (
      <g className="shoujo-rig-hair" data-part="hair-back" data-hair="fluffy_bangs">
        <path
          d="M 100 24 C 138 16 154 40 154 68 C 154 92 149 110 144 124
             C 134 114 132 98 130 86 C 120 94 108 96 100 96
             C 92 96 80 94 70 86 C 68 98 66 114 62 128
             C 55 110 46 92 46 68 C 46 40 62 16 100 16 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
      </g>
    ),
    front: (
      <>
        <g className="shoujo-rig-hair" data-part="hair-front">
        <path
          d="M 100 24 C 70 16 50 36 48 62 C 58 50 70 42 82 40
             C 78 50 78 56 82 62 C 90 50 102 44 116 46
             C 128 48 140 54 150 62 C 152 36 130 16 100 16 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {angelRing('M 72 50 l 9 5 l -5 7 l 10 5 l -6 6 l 10 4')}
        <path d="M 58 38 C 64 18 82 8 100 10 C 120 12 136 24 138 40 C 118 30 82 28 58 38 Z"
          fill={p.cloth} stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinejoin="round" data-part="beret" />
        <circle cx="100" cy="8" r="3.8" fill={p.accent} stroke={INK} strokeWidth="1" />
      </g>
      </>
    ),
  };
}

/** Kogane: curled twin tails, each tied with a ribbon bow. */
function hairTwinTailsBows(p, uid) {
  return {
    back: (
      <g className="shoujo-rig-hair" data-part="hair-back" data-hair="twin_tails_bows">
        <path
          d="M 100 24 C 134 24 148 50 146 80 C 144 104 140 122 136 136
             C 130 120 128 102 126 90 C 118 98 108 100 100 100
             C 92 100 82 98 74 90 C 72 102 70 120 64 136
             C 60 122 56 104 54 80 C 52 50 66 24 100 24 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {/* the two curled tails, outside the head */}
        <path d="M 52 84 C 36 96 30 122 40 146 C 48 128 50 106 60 92 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
        <path d="M 148 84 C 164 96 170 122 160 146 C 152 128 150 106 140 92 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
      </g>
    ),
    front: (
      <>
        <g className="shoujo-rig-hair" data-part="hair-front">
        <path
          d="M 100 24 C 74 24 58 44 58 68 C 66 56 78 48 90 47
             C 86 55 86 61 90 67 C 96 55 106 49 118 51
             C 128 53 136 59 142 68 C 142 44 126 24 100 24 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {angelRing('M 70 52 l 9 6 l -5 7 l 10 5 l -6 6 l 11 4')}
        {/* the bows, where the tails are tied */}
        {[[54, 84], [146, 84]].map(([bx, by]) => (
          <g key={bx} data-part="ribbon-bow" transform={`translate(${bx} ${by})`}>
            <path d="M 0 0 l -8 -5 l 0 10 z M 0 0 l 8 -5 l 0 10 z"
              fill={p.ribbon} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
            <circle cx="0" cy="0" r="2.4" fill={p.ribbon} stroke={INK} strokeWidth="0.9" />
          </g>
        ))}
      </g>
      </>
    ),
  };
}

/** Zenimaru: short energetic spikes under a merchant's headband. */
function hairShortSpikesBand(p, uid) {
  return {
    back: (
      <g className="shoujo-rig-hair" data-part="hair-back" data-hair="short_spikes_band">
        <path
          d="M 100 24 C 130 24 144 46 144 74 C 144 88 142 98 140 108
             C 136 98 134 90 132 84 C 120 92 108 94 100 94
             C 92 94 80 92 68 84 C 66 90 64 98 60 108
             C 58 98 56 88 56 74 C 56 46 70 24 100 24 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
      </g>
    ),
    front: (
      <>
        <g className="shoujo-rig-hair" data-part="hair-front">
        {/* spikes rather than a smooth fringe */}
        <path
          d="M 100 24 C 76 24 58 42 57 68
             L 68 50 L 72 66 L 84 46 L 90 64 L 100 44
             L 110 64 L 118 46 L 128 64 L 134 50 L 143 68
             C 142 42 124 24 100 24 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {angelRing('M 74 48 l 8 6 l -5 6 l 9 5 l -5 6 l 10 4', 4)}
        {/* the headband */}
        <path d="M 54 60 C 72 50 128 50 146 60 L 146 68 C 128 58 72 58 54 68 Z"
          fill={p.ribbon} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" data-part="headband" />
        <path d="M 146 62 l 12 -4 l -2 10 z" fill={p.ribbon} stroke={INK} strokeWidth="0.9" />
      </g>
      </>
    ),
  };
}

/** Minori: a gentle braid over one shoulder, with a wheat hairpin. */
function hairSideBraid(p, uid) {
  return {
    back: (
      <g className="shoujo-rig-hair" data-part="hair-back" data-hair="side_braid">
        <path
          d="M 100 25 C 132 25 147 50 146 80 C 145 102 141 120 137 134
             C 131 118 129 100 127 88 C 118 96 108 98 100 98
             C 92 98 82 96 73 88 C 71 100 69 118 63 134
             C 59 120 55 102 54 80 C 53 50 68 25 100 25 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {/* the braid: three plaits down the right side */}
        <g data-part="braid">
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={i} cx={142 + i * 2} cy={104 + i * 14} rx="7.5" ry="8"
              fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_INNER} />
          ))}
          <path d={`M ${148} ${160} l -5 8 l 10 0 z`} fill={p.ribbon} stroke={INK} strokeWidth="0.9" />
        </g>
      </g>
    ),
    front: (
      <>
        <g className="shoujo-rig-hair" data-part="hair-front">
        <path
          d="M 100 25 C 76 25 59 44 58 69 C 67 57 78 49 90 48
             C 87 56 87 62 91 68 C 97 56 107 50 119 52
             C 129 54 137 60 142 69 C 141 44 124 25 100 25 Z"
          fill={`url(#${uid}-hair)`} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
        {angelRing('M 71 52 l 9 6 l -5 7 l 10 5 l -6 6 l 10 4')}
        {/* the wheat pin */}
        <g data-part="wheat-pin" transform="translate(62 54) rotate(-20)">
          <path d="M 0 0 l 0 -14" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
          {[-11, -7, -3].map((y) => (
            <g key={y}>
              <ellipse cx="-3" cy={y} rx="2.4" ry="3.4" fill="#E6C86E" stroke={INK} strokeWidth="0.7" />
              <ellipse cx="3" cy={y} rx="2.4" ry="3.4" fill="#E6C86E" stroke={INK} strokeWidth="0.7" />
            </g>
          ))}
        </g>
      </g>
      </>
    ),
  };
}

/** Koneko: a cat-eared hood, calico tipped. */
function hairCatEarHood(p, uid) {
  return {
    back: (
      <g className="shoujo-rig-hair" data-part="hair-back" data-hair="cat_ear_hood">
        <path
          d="M 100 26 C 134 26 148 52 147 82 C 146 104 142 120 138 132
             C 132 118 130 102 128 90 C 118 98 108 100 100 100
             C 92 100 82 98 72 90 C 70 102 68 118 62 132
             C 58 120 54 104 53 82 C 52 52 66 26 100 26 Z"
          fill={p.cloth} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round"
        />
      </g>
    ),
    front: (
      <>
        <g className="shoujo-rig-hair" data-part="hair-front">
        {/* the hood brim */}
        <path d="M 100 26 C 72 26 56 46 56 70 C 70 58 84 52 100 52 C 116 52 130 58 144 70 C 144 46 128 26 100 26 Z"
          fill={p.cloth} stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round" />
        {angelRing('M 74 48 l 8 5 l -5 6 l 9 4', 4)}
        {/* the two ears, tipped in calico */}
        <g data-part="cat-ears">
          <path d="M 58 40 L 50 6 L 86 28 Z" fill={p.cloth} stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinejoin="round" />
          <path d="M 60 31 L 56 16 L 72 27 Z" fill={p.clothAlt} />
          <path d="M 142 40 L 150 6 L 114 28 Z" fill={p.cloth} stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinejoin="round" />
          <path d="M 140 31 L 144 16 L 128 27 Z" fill={p.hairDark} />
        </g>
      </g>
      </>
    ),
  };
}

const HAIR_RENDERERS = {
  twin_locks_hat: hairTwinLocksHat,
  fluffy_bangs: hairFluffyBangs,
  twin_tails_bows: hairTwinTailsBows,
  short_spikes_band: hairShortSpikesBand,
  side_braid: hairSideBraid,
  cat_ear_hood: hairCatEarHood,
};

/* --- the six props -------------------------------------------------- */

/** Mone: the konpeito bottle, glowing. */
function propKonpeitoBottle(p, uid) {
  return (
    <g className="shoujo-prop" data-part="konpeito_bottle">
      <circle cx="100" cy="140" r="22" fill={`url(#${uid}-bottle-glow)`} />
      <path d="M 94 124 l 12 0 l 0 6 l 4 4 l 0 18 q 0 4 -4 4 l -12 0 q -4 0 -4 -4 l 0 -18 l 4 -4 z"
        fill="rgba(227, 242, 234, 0.75)" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
      <rect x="95" y="119" width="10" height="5" rx="1.6" fill="#C9A227" stroke={INK} strokeWidth="1" />
      <path d="M 96 144 l 1.4 2.6 l 2.6 1.4 l -2.6 1.4 l -1.4 2.6 l -1.4 -2.6 l -2.6 -1.4 l 2.6 -1.4 z" fill="#F4E285" />
      <path d="M 103 149 l 1.2 2.2 l 2.2 1.2 l -2.2 1.2 l -1.2 2.2 l -1.2 -2.2 l -2.2 -1.2 l 2.2 -1.2 z" fill="#F7B2AD" />
      <path d="M 99 135 l 1.1 2 l 2 1.1 l -2 1.1 l -1.1 2 l -1.1 -2 l -2 -1.1 l 2 -1.1 z" fill="#A8E6CF" />
      <circle cx="88" cy="142" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
      <circle cx="112" cy="142" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
    </g>
  );
}

/** Kaneru: the ledger, with notes rising off it. */
function propKakeiboMelody(p) {
  return (
    <g className="shoujo-prop" data-part="kakeibo_melody">
      <path d="M 76 130 l 26 -5 l 0 24 l -26 5 z" fill="#8A5B4C" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
      <path d="M 78 134 l 22 -4 M 78 140 l 22 -4" stroke="#F6E7C4" strokeWidth="1.4" />
      <circle cx="86" cy="142" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
      <g className="shoujo-quill" data-part="notes">
        {/* a quaver and a beamed pair, in gold */}
        <g transform="translate(118 116)">
          <ellipse cx="0" cy="8" rx="3.4" ry="2.6" fill="#C9A227" stroke={INK} strokeWidth="0.8" transform="rotate(-20)" />
          <path d="M 3 7 l 0 -12 q 5 2 5 6" fill="none" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g transform="translate(134 128)">
          <ellipse cx="0" cy="6" rx="2.8" ry="2.2" fill="#E6B84D" stroke={INK} strokeWidth="0.7" transform="rotate(-20)" />
          <ellipse cx="10" cy="4" rx="2.8" ry="2.2" fill="#E6B84D" stroke={INK} strokeWidth="0.7" transform="rotate(-20)" />
          <path d="M 2.5 5 l 0 -9 l 10 -2 l 0 9" fill="none" stroke="#E6B84D" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </g>
  );
}

/** Kogane: the pocket watch, on its chain, with a treasure key. */
function propGoldenWatch(p) {
  return (
    <g className="shoujo-prop" data-part="golden_watch">
      <path d="M 100 110 q 14 10 10 24" fill="none" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="108" cy="140" r="11" fill="#F4E285" stroke={INK} strokeWidth={STROKE_INNER} />
      <circle cx="108" cy="140" r="7.5" fill="#FFFDF5" stroke={INK} strokeWidth="0.9" />
      <path d="M 108 140 l 0 -5 M 108 140 l 4 2" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="105.5" y="126" width="5" height="4" rx="1.4" fill="#C9A227" stroke={INK} strokeWidth="0.9" />
      {/* the key */}
      <g data-part="treasure-key" transform="translate(78 136)">
        <circle cx="0" cy="0" r="4.4" fill="none" stroke="#C9A227" strokeWidth="2" />
        <path d="M 0 4.4 l 0 12 M 0 11 l 5 0 M 0 15 l 4 0" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="88" cy="142" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
    </g>
  );
}

/** Zenimaru: the square-holed coin, and a small abacus. */
function propLuckyCoin(p) {
  return (
    <g className="shoujo-prop" data-part="lucky_coin">
      <circle cx="100" cy="138" r="17" fill="#F4E285" stroke={INK} strokeWidth={STROKE_OUTER} />
      <circle cx="100" cy="138" r="12.5" fill="none" stroke="#C9A227" strokeWidth="1.2" />
      <rect x="95" y="133" width="10" height="10" rx="1.2" fill={p.cloth} stroke={INK} strokeWidth={STROKE_INNER} />
      {/* 寛永 on the rim, suggested rather than written */}
      <path d="M 100 125 l 0 4 M 100 147 l 0 4 M 87 138 l 4 0 M 109 138 l 4 0" stroke="#C9A227" strokeWidth="1.4" strokeLinecap="round" />
      {/* the abacus */}
      <g data-part="abacus" transform="translate(128 128)">
        <rect x="0" y="0" width="22" height="18" rx="2" fill="#8A5B4C" stroke={INK} strokeWidth={STROKE_INNER} />
        <path d="M 0 9 l 22 0" stroke="#F6E7C4" strokeWidth="1" />
        {[3, 9, 15].map((x) => (
          <g key={x}>
            <circle cx={x + 1} cy="4.5" r="1.8" fill="#F4E285" />
            <circle cx={x + 1} cy="13.5" r="1.8" fill="#F4E285" />
          </g>
        ))}
      </g>
      <circle cx="84" cy="144" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
    </g>
  );
}

/** Minori: the harvest basket, with star fruit and coins in it. */
function propHarvestBasket(p) {
  return (
    <g className="shoujo-prop" data-part="harvest_basket">
      <path d="M 78 130 l 44 0 l -5 24 q -1 4 -5 4 l -24 0 q -4 0 -5 -4 z"
        fill="#C89A6B" stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round" />
      {/* the weave */}
      <path d="M 80 138 l 40 0 M 81 146 l 38 0 M 92 130 l -2 28 M 108 130 l 2 28"
        fill="none" stroke="#8A5B4C" strokeWidth="1" />
      <path d="M 84 130 q 16 -16 32 0" fill="none" stroke="#8A5B4C" strokeWidth="2.2" strokeLinecap="round" />
      {/* what is in it */}
      <path d="M 92 124 l 2 4 l 4 2 l -4 2 l -2 4 l -2 -4 l -4 -2 l 4 -2 z" fill="#F4E285" stroke={INK} strokeWidth="0.7" />
      <path d="M 108 122 l 1.6 3.2 l 3.2 1.6 l -3.2 1.6 l -1.6 3.2 l -1.6 -3.2 l -3.2 -1.6 l 3.2 -1.6 z" fill={p.accent} stroke={INK} strokeWidth="0.7" />
      <circle cx="100" cy="128" r="4" fill="#F4E285" stroke={INK} strokeWidth="0.8" />
      <circle cx="78" cy="146" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
      <circle cx="122" cy="146" r="5.5" fill={p.skin} stroke={INK} strokeWidth={STROKE_INNER} />
    </g>
  );
}

/** Koneko: the koban, the collar bell, and the paw stamp. */
function propFukuKoban(p) {
  return (
    <g className="shoujo-prop" data-part="fuku_koban">
      {/* the collar and its bell sit on the body, above the prop */}
      <path d="M 82 122 q 18 8 36 0" fill="none" stroke={p.accent} strokeWidth="6" strokeLinecap="round" data-part="collar" />
      <circle cx="100" cy="128" r="5.5" fill="#FFD54F" stroke={INK} strokeWidth={STROKE_INNER} data-part="fuku-bell" />
      <path d="M 100 125 l 0 6 M 97.5 128 l 5 0" stroke={INK} strokeWidth="1" strokeLinecap="round" />
      {/* the koban */}
      <path d="M 84 128 q 16 -7 32 0 l -4 22 q -12 5 -24 0 z"
        fill="#F4E285" stroke={INK} strokeWidth={STROKE_OUTER} strokeLinejoin="round" />
      <path d="M 92 136 l 16 0 M 94 143 l 12 0" stroke="#C9A227" strokeWidth="1.4" strokeLinecap="round" />
      {/* the paw stamp pad */}
      <g data-part="paw-stamp" transform="translate(128 136)">
        <rect x="0" y="0" width="16" height="12" rx="2.5" fill={p.clothAlt} stroke={INK} strokeWidth={STROKE_INNER} />
        <circle cx="8" cy="7" r="2.6" fill={p.accent} />
        <circle cx="4.5" cy="3.5" r="1.1" fill={p.accent} />
        <circle cx="8" cy="2.6" r="1.1" fill={p.accent} />
        <circle cx="11.5" cy="3.5" r="1.1" fill={p.accent} />
      </g>
      <circle cx="80" cy="142" r="5.5" fill={p.cloth} stroke={INK} strokeWidth={STROKE_INNER} />
      <circle cx="120" cy="142" r="5.5" fill={p.cloth} stroke={INK} strokeWidth={STROKE_INNER} />
    </g>
  );
}

const PROP_RENDERERS = {
  konpeito_bottle: propKonpeitoBottle,
  kakeibo_melody: propKakeiboMelody,
  golden_watch: propGoldenWatch,
  lucky_coin: propLuckyCoin,
  harvest_basket: propHarvestBasket,
  fuku_koban: propFukuKoban,
};

/* --- the body, shared, tinted per character ------------------------ */

/**
 * The shared body: a short bell and two stubby pegs.
 *
 * The legs were two vertical strokes with six pixels of width, which
 * is what made the figure read as a stick figure. They are now two
 * rounded pegs, and the shoes are loafer shapes rather than ovals.
 */
function petitBody(p, uid, persona) {
  // The merchant and the cat wear something different at the collar;
  // everyone else wears the layered dress or cardigan.
  const isHaori = persona.prop === 'lucky_coin';
  const isHood = persona.hair === 'cat_ear_hood';

  return (
    <g data-part="body">
      {/* The bell. Short and wide: it starts under the head at
          y=118 and ends at y=176, and it flares out from the
          shoulders, so the body reads as a small round shape under a
          very large head. */}
      <path
        d="M 100 114 C 84 114 75 120 73 132 C 70 146 66 164 63 176
           L 137 176 C 134 164 130 146 127 132 C 125 120 116 114 100 114 Z"
        fill={`url(#${uid}-cloth)`} stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinejoin="round"
      />
      {/* the hem: scalloped lace, or a straight apron edge */}
      {isHaori || isHood ? (
        <path d="M 63 176 l 74 0" stroke={INK} strokeWidth={STROKE_INNER} />
      ) : (
        <path d="M 63 176 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0 q 6 7 12 0"
          fill={p.clothAlt} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
      )}
      {/* the collar */}
      {isHaori ? (
        <path d="M 88 116 l 12 14 l 12 -14 l 6 8 l -18 18 l -18 -18 z"
          fill={p.clothAlt} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" data-part="haori" />
      ) : isHood ? null : (
        <path d="M 82 120 q 4.5 6 9 0 q 4.5 6 9 0 q 4.5 6 9 0"
          fill={p.clothAlt} stroke={INK} strokeWidth={STROKE_INNER} />
      )}
      {/* the bow, for everyone who wears one */}
      {isHood ? null : (
        <>
          <path d="M 100 124 l -9 -6 l 0 10 z M 100 124 l 9 -6 l 0 10 z"
            fill={p.ribbon} stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
          <circle cx="100" cy="124" r="2.8" fill={p.ribbon} stroke={INK} strokeWidth="1" />
        </>
      )}
      {/* The arms: short, and ending in rounded mitten hands that
          meet in front, where the prop is held. */}
      <path d="M 74 132 C 64 142 66 154 82 158" fill="none" stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinecap="round" />
      <path d="M 126 132 C 136 142 134 154 118 158" fill="none" stroke={INK} strokeWidth={STROKE_OUTER + 0.6} strokeLinecap="round" />

      {/* The legs: two stubby rounded pegs, not strokes. */}
      <g className="shoujo-rig-foot-left">
        <rect x="76" y="168" width="18" height="26" rx="9" fill={p.skin} stroke={INK} strokeWidth={STROKE_OUTER} />
      </g>
      <g className="shoujo-rig-foot-right">
        <rect x="106" y="168" width="18" height="26" rx="9" fill={p.skin} stroke={INK} strokeWidth={STROKE_OUTER} />
      </g>
      {/* The shoes: little Mary-Janes with a strap. */}
      <g className="shoujo-rig-foot-left">
        <path d="M 74 192 q 11 -5 22 0 q 2 8 -4 10 l -14 0 q -6 -2 -4 -10 z"
          fill="#4A3540" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
        <path d="M 78 194 l 14 0" stroke="#FFFDF9" strokeWidth="1.4" opacity="0.7" />
      </g>
      <g className="shoujo-rig-foot-right">
        <path d="M 104 192 q 11 -5 22 0 q 2 8 -4 10 l -14 0 q -6 -2 -4 -10 z"
          fill="#4A3540" stroke={INK} strokeWidth={STROKE_INNER} strokeLinejoin="round" />
        <path d="M 108 194 l 14 0" stroke="#FFFDF9" strokeWidth="1.4" opacity="0.7" />
      </g>
    </g>
  );
}

/* --- the 2000s emote badges ---------------------------------------- */

/**
 * The reaction symbol above the character's head.
 *
 * These are the 2000s television shorthand: kirakira stars and a
 * blooming flower when things are going well, notes when nothing much
 * is happening, and a sweat drop with a double bang when a budget is
 * about to be broken. They are drawn, so they read the same on every
 * machine - an emoji here would be a different picture per phone.
 */
export function renderAnimeEmote(mood) {
  const good = mood === 'happy' || mood === 'celebrate';
  const bad = mood === 'alert' || mood === 'over_budget';

  if (good) {
    return (
      <g className="shoujo-kirakira-float" data-emote="kirakira" aria-hidden="true">
        <path d="M 150 30 L 153 38 L 161 41 L 153 44 L 150 52 L 147 44 L 139 41 L 147 38 Z" fill="#FFD54F" />
        <path d="M 168 52 L 169.6 56 L 173.6 57.6 L 169.6 59.2 L 168 63.2 L 166.4 59.2 L 162.4 57.6 L 166.4 56 Z" fill="#F4E285" />
        <g data-emote-part="flower" transform="translate(172 32)">
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse key={deg} cx="0" cy="-5" rx="2.6" ry="4" fill="#F9C9D4" stroke={INK} strokeWidth="0.7" transform={`rotate(${deg})`} />
          ))}
          <circle cx="0" cy="0" r="1.8" fill="#FFD54F" />
        </g>
      </g>
    );
  }

  if (bad) {
    return (
      <g data-emote="sweat" aria-hidden="true">
        {/* the sweat drop: a teardrop, point up */}
        <path d="M 152 30 C 152 30 144 42 144 47 a 8 8 0 0 0 16 0 C 160 42 152 30 152 30 Z"
          fill="#90CAF9" stroke={INK} strokeWidth="1" />
        <ellipse cx="149" cy="45" rx="2" ry="3" fill="#FFFDF9" opacity="0.8" />
        {/* the double bang */}
        <g data-emote-part="bangs" fill={INK}>
          <path d="M 168 30 l 4 0 l -1 14 l -2 0 z" />
          <circle cx="170" cy="48" r="2" />
          <path d="M 177 30 l 4 0 l -1 14 l -2 0 z" />
          <circle cx="179" cy="48" r="2" />
        </g>
      </g>
    );
  }

  // The quiet case: two notes, drifting.
  return (
    <g className="shoujo-kirakira-float" data-emote="melody" aria-hidden="true">
      <g transform="translate(152 36)">
        <ellipse cx="0" cy="8" rx="3.2" ry="2.5" fill="#B39DDB" stroke={INK} strokeWidth="0.8" transform="rotate(-20)" />
        <path d="M 2.8 7 l 0 -11 q 4.5 1.8 4.5 5.5" fill="none" stroke="#B39DDB" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g transform="translate(170 50) scale(0.8)">
        <ellipse cx="0" cy="8" rx="3.2" ry="2.5" fill="#A8E6CF" stroke={INK} strokeWidth="0.8" transform="rotate(-20)" />
        <path d="M 2.8 7 l 0 -11 q 4.5 1.8 4.5 5.5" fill="none" stroke="#A8E6CF" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </g>
  );
}

/**
 * One of the guild, drawn.
 *
 * The persona is an entry from PETIT_CHIBI_CAST. Its `hair` and `prop`
 * names are looked up in the tables above, so this function has no
 * idea which characters exist - it only knows how to assemble one.
 */
export function renderPetitPersona(persona, uid, mood) {
  const p = persona.palette;
  const hair = HAIR_RENDERERS[persona.hair] || HAIR_RENDERERS.twin_locks_hat;
  const prop = PROP_RENDERERS[persona.prop] || PROP_RENDERERS.konpeito_bottle;
  // Each hair renderer hands back its two halves explicitly. Reaching
  // into a fragment's children by index worked but broke silently the
  // moment a silhouette grew a third group.
  const layers = hair(p, uid);

  return (
    <g data-persona={persona.id} data-petit-kanji={persona.kanji}>
      {/* back hair, then the body, then the face, then front hair, so
          the fringe falls over the forehead and the hat over that. */}
      {layers.back}
      {petitBody(p, uid, persona)}
      {renderFace(mood, false, p, uid)}
      {layers.front}
      {prop(p, uid)}
    </g>
  );
}

export { HAIR_RENDERERS, PROP_RENDERERS };
