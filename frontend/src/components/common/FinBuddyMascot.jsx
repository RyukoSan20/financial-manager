/**
 * FinBuddy, the little one who sits in the corner of the application.
 *
 * A mascot is only worth having if it says something. This one says
 * four things, and each of them is about what the application is doing
 * right now:
 *
 * - `idle`        — nothing is happening. A friendly face.
 * - `scanning`    — a receipt is being read. It is holding a magnifier.
 * - `thinking`    — the AI is working. The eyes are up and the brows
 *                   are down.
 * - `celebrating` — something went well. It is cheering.
 *
 * It is drawn with plain SVG rather than an image file, so it is
 * small, it scales with the text, and it takes the colour of what it
 * is sitting on.
 *
 * The expressions are drawn with a different shape of mouth and a
 * different position of the eyes, so the difference is visible even
 * to a reader who cannot see the colour.
 *
 * The size is set by the parent through the `size` prop. The default
 * is small enough to sit beside a line of text.
 */

import { readerFlag } from '../../utils/featureFlags';

const MOODS = ['idle', 'scanning', 'thinking', 'celebrating'];

/**
 * The mouth for each mood.
 *
 * `smile` is an arc. `flat` is a line. `open` is a circle, for the
 * moment of surprise. `cheer` is a wide arc, for the celebration.
 */
const MOUTHS = {
  idle: 'smile',
  scanning: 'flat',
  thinking: 'flat',
  celebrating: 'cheer',
};

/**
 * Where the eyes look, for each mood.
 *
 * `forward` is the default. `down` is the magnifier. `up` is the
 * thinking look. `closed` is the happy squint of a cheer.
 */
const EYES = {
  idle: 'forward',
  scanning: 'down',
  thinking: 'up',
  celebrating: 'closed',
};

/**
 * The eyes, for each way of looking.
 *
 * The pupils are the only thing that moves. The whites stay put, so
 * the face does not appear to change shape when the mood changes.
 */
function Eyes({ look, eyeColor }) {
  if (look === 'closed') {
    // A happy squint: two curves rather than two dots.
    return (
      <>
        <path d="M 21 27 Q 24 30 27 27" fill="none" stroke={eyeColor} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M 33 27 Q 36 30 39 27" fill="none" stroke={eyeColor} strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
  }

  const pupilOffset = look === 'down' ? 1.6 : look === 'up' ? -1.6 : 0;

  return (
    <>
      <circle cx="24" cy="27" r="4.2" fill="#ffffff" />
      <circle cx="36" cy="27" r="4.2" fill="#ffffff" />
      <circle cx={24 + pupilOffset} cy={27 + pupilOffset} r="2.3" fill={eyeColor} />
      <circle cx={36 + pupilOffset} cy={27 + pupilOffset} r="2.3" fill={eyeColor} />
    </>
  );
}

/**
 * The brows, for each mood.
 *
 * A worried or thinking face has the brows angled inwards. A neutral
 * face has them level.
 */
function Brows({ mood, browColor }) {
  if (mood === 'thinking') {
    return (
      <>
        <path d="M 20 20 L 27 22" fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
        <path d="M 40 20 L 33 22" fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (mood === 'celebrating') {
    return (
      <>
        <path d="M 20 21 Q 24 18 28 21" fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
        <path d="M 40 21 Q 36 18 32 21" fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <path d="M 20 20.5 L 28 20.5" fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
      <path d="M 32 20.5 L 40 20.5" fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

/**
 * The mouth, for each mood.
 */
function Mouth({ shape, mouthColor }) {
  if (shape === 'flat') {
    return <path d="M 26 37 L 34 37" fill="none" stroke={mouthColor} strokeWidth="2.2" strokeLinecap="round" />;
  }
  if (shape === 'open') {
    return <ellipse cx="30" cy="37" rx="4" ry="3.4" fill={mouthColor} />;
  }
  if (shape === 'cheer') {
    return (
      <path
        d="M 22 34 Q 30 43 38 34 Z"
        fill={mouthColor}
        stroke={mouthColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    );
  }
  return <path d="M 25 35 Q 30 40 35 35" fill="none" stroke={mouthColor} strokeWidth="2.2" strokeLinecap="round" />;
}

/**
 * The magnifier, for the scanning mood.
 */
function Magnifier({ color }) {
  return (
    <g>
      <circle cx="47" cy="18" r="7" fill="none" stroke={color} strokeWidth="2.4" />
      <path d="M 52 23 L 57 28" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M 43.5 18 Q 47 13 50.5 18" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}

/**
 * The three little sparks, for the celebration.
 */
function Sparks({ color }) {
  return (
    <g fill={color}>
      <path d="M 12 14 L 13.6 18.4 L 18 20 L 13.6 21.6 L 12 26 L 10.4 21.6 L 6 20 L 10.4 18.4 Z" />
      <path d="M 50 34 L 51.2 37.2 L 54.4 38.4 L 51.2 39.6 L 50 42.8 L 48.8 39.6 L 45.6 38.4 L 48.8 37.2 Z" opacity="0.85" />
      <path d="M 46 8 L 47 10.6 L 49.6 11.6 L 47 12.6 L 46 15.2 L 45 12.6 L 42.4 11.6 L 45 10.6 Z" opacity="0.7" />
    </g>
  );
}

/**
 * The three dots, for the thinking mood.
 */
function ThinkingDots({ color }) {
  return (
    <g fill={color}>
      <circle cx="18" cy="44" r="1.9" />
      <circle cx="24" cy="46" r="1.6" opacity="0.75" />
      <circle cx="29" cy="48" r="1.3" opacity="0.5" />
    </g>
  );
}

/**
 * FinBuddy.
 *
 * @param {string} mood   One of `idle`, `scanning`, `thinking`,
 *                        `celebrating`.
 * @param {number} size   The width and height, in pixels.
 * @param {string} className  Classes for the wrapper.
 */
export default function FinBuddyMascot({
  mood = 'idle',
  size = 56,
  className = '',
  title,
  // Which drawing to use.
  //
  // `inline` draws the mascot with SVG elements, so it takes the
  // colour of what it sits on and never waits for a file to load.
  //
  // `generated` uses the drawing the asset generator writes. That
  // one has more in it, so it is worth the file, but it does not
  // follow the theme colour.
  //
  // The default is `inline`, because a mascot that is missing for a
  // moment is worse than a mascot that is plain.
  variant = 'auto',
}) {
  // An unknown mood is treated as `idle` rather than crashing the page.
  const safeMood = MOODS.includes(mood) ? mood : 'idle';

  // The switch is read in one place, here, so every place that shows
  // the mascot switches over together. A caller can still ask for a
  // specific drawing, but by default the reader decides.
  const useGenerated =
    variant === 'generated' ||
    (variant === 'auto' && readerFlag('MASCOT_ART'));

  if (useGenerated) {
    return (
      <span
        className={`finbuddy finbuddy-generated inline-flex items-center justify-center ${className}`.trim()}
        style={{ width: size, height: size }}
        role="img"
        aria-label={title || 'FinBuddy'}
        data-mood={safeMood}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/generated/mascot/mascot-${safeMood}.svg`}
          width={size}
          height={size}
          alt=""
          aria-hidden="true"
        />
      </span>
    );
  }

  // The body colour follows the theme: the primary colour of the
  // application, so the mascot belongs to it.
  const bodyColor = 'currentColor';
  const eyeColor = '#1f2937';
  const browColor = '#374151';
  const mouthColor = '#374151';

  return (
    <span
      className={`finbuddy inline-flex items-center justify-center text-primary-500 ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={title || 'FinBuddy'}
      data-mood={safeMood}
    >
      <svg
        viewBox="0 0 60 60"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        {/* The body. A rounded shape, so it reads as friendly without
            needing a face at a large size. */}
        <path
          d="M 30 6 C 42 6 50 15 50 27 C 50 40 42 50 30 50 C 18 50 10 40 10 27 C 10 15 18 6 30 6 Z"
          fill={bodyColor}
        />

        {/* The face, in a lighter tone, so the features have something
            to sit on. */}
        <path
          d="M 30 10 C 40 10 46 17 46 27 C 46 37 40 45 30 45 C 20 45 14 37 14 27 C 14 17 20 10 30 10 Z"
          fill="#ffffff"
          opacity="0.94"
        />

        <Brows mood={safeMood} browColor={browColor} />
        <Eyes look={EYES[safeMood]} eyeColor={eyeColor} />
        <Mouth shape={MOUTHS[safeMood]} mouthColor={mouthColor} />

        {safeMood === 'scanning' && <Magnifier color="currentColor" />}
        {safeMood === 'thinking' && <ThinkingDots color="currentColor" />}
        {safeMood === 'celebrating' && <Sparks color="#f59e0b" />}
      </svg>
    </span>
  );
}

export { FinBuddyMascot, MOODS };
