/**
 * The companion.
 *
 * A character is only worth having if it says something, and it can
 * only say something if it knows what is going on. So this one wears
 * four outfits, and each of them means a particular thing:
 *
 * - `happy`       — things are going well. Savings went up, a debt was
 *                   cleared, the budget holds.
 * - `worried`     — spending has gone past the budget, or somebody
 *                   has owed their share of a bill for more than a
 *                   week.
 * - `shopkeeper`  — the reader is in the shop, or running the till.
 * - `detective`   — the reader is reading a receipt or working out a
 *                   tax.
 *
 * The difference between the outfits is in the shape of the mouth, the
 * position of the eyes and the shape of the brows, so a reader who
 * cannot see the colour can still tell them apart.
 *
 * The companion is drawn here, in the page, from plain SVG. There is
 * no file to wait for and no picture to fail to load, and it takes the
 * colour of what it sits on.
 *
 * The companion never tells the reader to do something it has not
 * checked. It says what it sees.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { readerFlag } from '../../utils/featureFlags';

const MOODS = ['happy', 'worried', 'shopkeeper', 'detective'];

/**
 * The eyes for each mood.
 *
 * `open` is a round eye. `wide` is a taller one, for the surprise of
 * a bad number. `down` looks at the ground, for the reading. `side` is
 * the narrowed eye of somebody concentrating.
 */
const EYES = {
  happy: 'open',
  worried: 'wide',
  shopkeeper: 'open',
  detective: 'narrow',
};

/**
 * The mouth for each mood.
 *
 * `smile` is an arc. `flat` is a line. `frown` is the arc turned the
 * other way. `grin` is a wider arc with the corners turned up.
 */
const MOUTHS = {
  happy: 'smile',
  worried: 'frown',
  shopkeeper: 'smile',
  detective: 'flat',
};

/**
 * The brows for each mood.
 *
 * Up for a good moment, down for a bad one, and level for the ones
 * that need looking at.
 */
const BROWS = {
  happy: 'up',
  worried: 'down',
  shopkeeper: 'level',
  detective: 'level',
};

/**
 * The face.
 */
const Face = ({ mood, eyeColor, browColor, mouthColor }) => (
  <>
    {/* The brows. */}
    <path
      d={
        BROWS[mood] === 'down'
          ? 'M 18 17 L 25 20 M 42 17 L 35 20'
          : BROWS[mood] === 'up'
            ? 'M 18 21 L 25 18 M 42 21 L 35 18'
            : 'M 18 19 L 25 19 M 42 19 L 35 19'
      }
      stroke={browColor}
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* The eyes. */}
    {EYES[mood] === 'narrow' ? (
      <>
        <path d="M 19 28 L 26 28" stroke={eyeColor} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M 34 28 L 41 28" stroke={eyeColor} strokeWidth="2.4" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse
          cx="22.5"
          cy="28"
          rx={EYES[mood] === 'wide' ? 3.4 : 3}
          ry={EYES[mood] === 'wide' ? 4.4 : 3.6}
          fill={eyeColor}
        />
        <ellipse
          cx="37.5"
          cy="28"
          rx={EYES[mood] === 'wide' ? 3.4 : 3}
          ry={EYES[mood] === 'wide' ? 4.4 : 3.6}
          fill={eyeColor}
        />
        {/* A little light in each eye, so it looks alive rather than
            like two dots. */}
        <circle cx="23.4" cy="26.8" r="1.1" fill="#ffffff" opacity="0.9" />
        <circle cx="38.4" cy="26.8" r="1.1" fill="#ffffff" opacity="0.9" />
      </>
    )}

    {/* The mouth. */}
    {MOUTHS[mood] === 'smile' && (
      <path
        d="M 24 38 Q 30 42.5 36 38"
        stroke={mouthColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    )}
    {MOUTHS[mood] === 'grin' && (
      <path
        d="M 22 37 Q 30 44 38 37"
        stroke={mouthColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    )}
    {MOUTHS[mood] === 'frown' && (
      <path
        d="M 24 41 Q 30 37 36 41"
        stroke={mouthColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    )}
    {MOUTHS[mood] === 'flat' && (
      <path d="M 25 39 L 35 39" stroke={mouthColor} strokeWidth="2.2" strokeLinecap="round" />
    )}
  </>
);

/**
 * The apron of the shopkeeper.
 */
const Apron = () => (
  <>
    {/* The straps. */}
    <path d="M 21 50 L 24 44 M 39 50 L 36 44" stroke="#0f172a" strokeWidth="1.6" opacity="0.55" />
    {/* The apron itself. */}
    <path d="M 21 44 L 39 44 L 41 56 L 19 56 Z" fill="#f59e0b" opacity="0.9" />
    <path d="M 21 44 L 39 44 L 40 47 L 20 47 Z" fill="#b45309" opacity="0.55" />
  </>
);

/**
 * The glasses of the detective.
 */
const Glasses = () => (
  <>
    <circle cx="22.5" cy="28" r="6.4" stroke="#1f2937" strokeWidth="1.8" fill="none" />
    <circle cx="37.5" cy="28" r="6.4" stroke="#1f2937" strokeWidth="1.8" fill="none" />
    <path d="M 28.9 28 L 31.1 28" stroke="#1f2937" strokeWidth="1.8" />
  </>
);

/**
 * The magnifying glass of the detective.
 */
const Magnifier = () => (
  <>
    <circle cx="44" cy="38" r="6" stroke="#1f2937" strokeWidth="2" fill="#ffffff" opacity="0.35" />
    <path d="M 39.6 42.4 L 34 48" stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />
  </>
);

/**
 * The sweat of the worried one.
 */
const Sweat = () => (
  <path
    d="M 46 16 C 48 19.5 49 21 49 22.5 A 3 3 0 0 1 43 22.5 C 43 21 44 19.5 46 16 Z"
    fill="#38bdf8"
  />
);

/**
 * The sparkles of the happy one.
 */
const Sparkles = () => (
  <>
    <path
      d="M 47 12 L 48.6 16.4 L 53 18 L 48.6 19.6 L 47 24 L 45.4 19.6 L 41 18 L 45.4 16.4 Z"
      fill="#fbbf24"
    />
    <path d="M 13 14 L 13.9 16.6 L 16.5 17.5 L 13.9 18.4 L 13 21 L 12.1 18.4 L 9.5 17.5 L 12.1 16.6 Z" fill="#fbbf24" />
  </>
);

/**
 * The companion.
 *
 * @param {string} mood     One of `happy`, `worried`, `shopkeeper`,
 *                          `detective`.
 * @param {number} size     The width and height, in pixels.
 * @param {string} message  What the companion says. The words come
 *                          from the caller, because the companion has
 *                          no way of knowing what happened.
 */
export default function MascotCompanion({
  mood = 'happy',
  size = 56,
  className = '',
  message = '',
  messageKey = '',
  title = '',
}) {
  const { t } = useTranslation();

  // An unknown mood is treated as `happy` rather than crashing the
  // page. A character that cannot be drawn is worse than a plain one.
  const safeMood = MOODS.includes(mood) ? mood : 'happy';

  // The companion is a new thing, so it is behind a switch of its
  // own until the reader asks for it.
  const visible = readerFlag('MASCOT_COMPANION');
  if (!visible) return null;

  const bodyColor = 'currentColor';
  const eyeColor = '#1f2937';
  const browColor = '#374151';
  const mouthColor = '#374151';

  const words = message || (messageKey ? t(messageKey, '') : '');

  return (
    <div className={`moe-companion ${className}`.trim()} data-mood={safeMood}>
      <span
        className="moe-companion__figure inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        role="img"
        aria-label={title || words || 'Moe'}
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
          {/* The body. */}
          <path
            d="M 30 6 C 42 6 50 15 50 27 C 50 40 42 50 30 50 C 18 50 10 40 10 27 C 10 15 18 6 30 6 Z"
            fill={bodyColor}
          />
          {/* The face, in a lighter tone, so the features have
              something to sit on. */}
          <path
            d="M 30 10 C 40 10 46 17 46 27 C 46 37 40 45 30 45 C 20 45 14 37 14 27 C 14 17 20 10 30 10 Z"
            fill="#ffffff"
            opacity="0.94"
          />

          <Face mood={safeMood} eyeColor={eyeColor} browColor={browColor} mouthColor={mouthColor} />

          {safeMood === 'shopkeeper' && <Apron />}
          {safeMood === 'detective' && (
            <>
              <Glasses />
              <Magnifier />
            </>
          )}
          {safeMood === 'worried' && <Sweat />}
          {safeMood === 'happy' && <Sparkles />}
        </svg>
      </span>

      {words ? <p className="moe-companion__words">{words}</p> : null}
    </div>
  );
}

/**
 * The companion that sits in the corner of the page.
 *
 * It says something about the page it is on, and it only says it when
 * the reader has asked for it. A corner that is always there is a
 * corner that stops being noticed.
 */
export function MascotCorner({ mood = 'happy', messageKey = '', className = '' }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  // The reader can send it away for this page.
  useEffect(() => {
    if (!dismissed) return undefined;
    const timer = setTimeout(() => setDismissed(false), 60000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className={`moe-corner ${className}`.trim()}>
      <MascotCompanion
        mood={mood}
        size={44}
        messageKey={messageKey}
        title={t('moe.title', 'Moe')}
      />
      <button
        type="button"
        className="moe-corner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label={t('moe.dismiss', 'Send Moe away')}
      >
        ×
      </button>
    </div>
  );
}

export { MascotCompanion, MOODS };
