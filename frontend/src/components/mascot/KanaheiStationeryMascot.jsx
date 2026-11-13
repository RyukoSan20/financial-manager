/**
 * The Kakeibo companion.
 *
 * A chubby little animal drawn the way a Japanese stationery
 * character is drawn: flat pastel fills, one thick warm-brown
 * outline, round shapes, and nothing else. No pixels, no grid, no
 * hard edges - the old grid mascot looked harsh next to a rounded
 * card.
 *
 * The drawing is one vector with named parts, so each part can move
 * on its own:
 *
 * - the ears wiggle;
 * - the eyes blink every three seconds;
 * - the body bobs, jumps or shakes;
 * - the prop in its paw changes with the mood and the mode.
 *
 * Hovering or clicking it opens a `KakeiboHoverBoard` beside it, with
 * a small reflection from the account book in the reader's language.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import KakeiboHoverBoard from '../ui/KakeiboHoverBoard';

/** The palette of the drawing. */
export const kanaheiColours = Object.freeze({
  outline: '#4A3F35',
  body: '#FFFDF9',
  cheek: '#F7B2AD',
  sage: '#52796F',
  coin: '#F4E285',
  ink: '#2D312E',
});

/** How long the eyes stay open before they blink. */
const BLINK_MS = 3200;
/** How long the blink itself lasts. */
const BLINK_HOLD_MS = 160;

/** The reflection tips, one per language, by mood. */
const TIPS = {
  id: {
    idle: 'Catatan kecil hari ini: catat satu pengeluaran, dan kebiasaannya akan lebih mudah dijaga.',
    happy: 'Bagus sekali! Uang yang dicatat dengan senang hati lebih jarang bocor.',
    celebrate: 'Hebat! Target hari ini tercapai. Tulis di buku dan lanjutkan.',
    alert: 'Hati-hati, pengeluaran hari ini lebih besar dari biasanya. Check satu receh saja.',
  },
  en: {
    idle: 'A small note for today: write down one expense, and the habit is easier to keep.',
    happy: 'Lovely! Money written down gladly tends not to slip away.',
    celebrate: 'Wonderful! Today’s target is reached. Note it in the book and carry on.',
    alert: 'Careful — today’s spending is larger than usual. Check one small thing.',
  },
  ja: {
    idle: '今日のメモ：一度だけ支出を記録すれば、習慣は守りやすくなります。',
    happy: 'いいですね！気持ちよく書いたお金は減りません。',
    celebrate: 'すばらしい！今日の目標達成です。帳簿に書いて、次へ進みましょう。',
    alert: '주의 — 今日の支出はいつもより多めです。小さな一つを確認しましょう。',
  },
};

/** The four-point star, drawn once and reused. */
const Star = ({ x, y, size = 7, rotate = 0, fill = kanaheiColours.coin }) => (
  <path
    d={`M ${x} ${y - size} Q ${x + size * 0.22} ${y - size * 0.22} ${x + size} ${y}
        Q ${x + size * 0.22} ${y + size * 0.22} ${x} ${y + size}
        Q ${x - size * 0.22} ${y + size * 0.22} ${x - size} ${y}
        Q ${x - size * 0.22} ${y - size * 0.22} ${x} ${y - size} Z`}
    fill={fill}
    transform={`rotate(${rotate} ${x} ${y})`}
  />
);

/**
 * The companion.
 *
 * `mood` is `idle`, `happy`, `celebrate` or `alert`. `mode` is
 * `family` or `business`. `size` is the width in pixels. `label` is
 * what a screen reader is told. `tip` overrides the reflection text.
 */
export default function KanaheiStationeryMascot({
  mood = 'idle',
  mode = 'family',
  size = 72,
  label = 'Maskot',
  tip = '',
  className = '',
  onClick,
  hovering = false,
  // What the companion says when it is clicked. It is shown in the
  // hover board, not in a separate bubble - two cards in the same
  // place would sit on top of each other.
  said = '',
}) {
  const { t, language } = useTranslation();
  const [blinking, setBlinking] = useState(false);
  const [hopped, setHopped] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const timers = useRef({});

  const later = useCallback((name, fn, ms) => {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    const held = timers.current;
    return () => Object.values(held).forEach(clearTimeout);
  }, []);

  // The blink. The eyes are open, they close for a moment, and they
  // open again - every three seconds or so.
  useEffect(() => {
    const tick = () => {
      setBlinking(true);
      later('blink', () => setBlinking(false), BLINK_HOLD_MS);
      later('next', () => tick(), BLINK_MS);
    };
    const first = setTimeout(() => tick(), BLINK_MS);
    return () => clearTimeout(first);
  }, [later]);

  // The hop. A gentle spring up and back down, six pixels.
  const hop = useCallback(() => {
    setHopped(true);
    later('hop', () => setHopped(false), 460);
  }, [later]);

  const showBoard = hovering || boardOpen;

  // What it says wins while it is speaking; otherwise the little
  // reflection from the account book.
  const tipText = said || tip || (TIPS[language] && TIPS[language][mood]) || TIPS.id[mood];
  const title = t('kanahei.title');
  const badge = t('kanahei.badge');

  return (
    <span
      className={clsx('kanahei-root relative inline-block', className)}
      data-kanahei-mood={mood}
      data-kanahei-mode={mode}
    >
      <button
        type="button"
        className={clsx(
          'kanahei-button block rounded-full p-0.5 outline-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          hopped && '-translate-y-1.5'
        )}
        aria-label={label}
        onClick={() => {
          hop();
          setBoardOpen((open) => !open);
          if (onClick) onClick();
        }}
        onMouseEnter={() => setBoardOpen(true)}
        onMouseLeave={() => setBoardOpen(false)}
        onFocus={() => setBoardOpen(true)}
        onBlur={() => setBoardOpen(false)}
      >
        <svg
          className="kanahei-figure block"
          width={size}
          height={size}
          viewBox="0 0 120 120"
          role="img"
          aria-label={label}
        >
          {/* The ground it stands on. */}
          <g className="kanahei-shadow">
            <ellipse cx="60" cy="106" rx="28" ry="6" fill="rgba(74,63,53,0.08)" />
          </g>

          {/* The stars, for the good moods. */}
          {(mood === 'happy' || mood === 'celebrate') ? (
            <g className="kanahei-stars">
              <Star x={16} y={40} size={6} rotate={12} fill="#F7B2AD" />
              <Star x={104} y={46} size={7} rotate={-10} fill={kanaheiColours.coin} />
              <Star x={98} y={20} size={5} rotate={20} fill="#D8F3DC" />
            </g>
          ) : null}

          {/* The ears. */}
          <g className="kanahei-ears">
            <path
              d="M36 40 C28 26 30 16 40 18 C48 20 50 30 48 38 Z"
              fill={kanaheiColours.body}
              stroke={kanaheiColours.outline}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M39 34 C35 27 36 23 40 24 C43 25 44 30 43 34 Z"
              fill={kanaheiColours.cheek}
            />
            <path
              d="M84 40 C92 26 90 16 80 18 C72 20 70 30 72 38 Z"
              fill={kanaheiColours.body}
              stroke={kanaheiColours.outline}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M81 34 C85 27 84 23 80 24 C77 25 76 30 77 34 Z"
              fill={kanaheiColours.cheek}
            />
          </g>

          {/* The body: one chubby round shape. */}
          <g className="kanahei-body">
            <path
              d="M60 24 C80 24 94 40 94 62 C94 84 80 98 60 98 C40 98 26 84 26 62 C26 40 40 24 60 24 Z"
              fill={kanaheiColours.body}
              stroke={kanaheiColours.outline}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* The face. */}
          <g className="kanahei-face">
            {blinking ? (
              <>
                <path d="M40 56 Q45 60 50 56" fill="none" stroke={kanaheiColours.outline} strokeWidth="3" strokeLinecap="round" />
                <path d="M70 56 Q75 60 80 56" fill="none" stroke={kanaheiColours.outline} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="45" cy="56" rx="4.5" ry="5.5" fill={kanaheiColours.outline} />
                <ellipse cx="75" cy="56" rx="4.5" ry="5.5" fill={kanaheiColours.outline} />
                <circle cx="46.5" cy="54" r="1.5" fill="#FFFFFF" />
                <circle cx="76.5" cy="54" r="1.5" fill="#FFFFFF" />
              </>
            )}

            {/* The cheeks. */}
            <ellipse cx="38" cy="68" rx="6.5" ry="4.5" fill={kanaheiColours.cheek} opacity="0.85" />
            <ellipse cx="82" cy="68" rx="6.5" ry="4.5" fill={kanaheiColours.cheek} opacity="0.85" />

            {/* The mouth. */}
            {mood === 'alert' ? (
              <ellipse cx="60" cy="72" rx="4" ry="5" fill="none" stroke={kanaheiColours.outline} strokeWidth="3" />
            ) : mood === 'happy' || mood === 'celebrate' ? (
              <path
                d="M50 70 Q60 80 70 70"
                fill="none"
                stroke={kanaheiColours.outline}
                strokeWidth="3"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M55 70 Q60 75 65 70"
                fill="none"
                stroke={kanaheiColours.outline}
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
          </g>

          {/* What it holds. */}
          <g className="kanahei-prop">
            {mode === 'business' ? (
              <>
                <circle cx="60" cy="92" r="11" fill={kanaheiColours.coin} stroke={kanaheiColours.outline} strokeWidth="3" />
                <path d="M56 92 L60 96 L66 88" fill="none" stroke={kanaheiColours.outline} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <>
                {/* A little sprout on its head. */}
                <path d="M60 24 Q60 16 60 12" fill="none" stroke={kanaheiColours.sage} strokeWidth="3" strokeLinecap="round" />
                <path d="M60 14 C52 14 48 9 49 3 C57 3 61 8 60 14 Z" fill={kanaheiColours.sage} />
                <path d="M60 14 C68 14 72 9 71 3 C63 3 59 8 60 14 Z" fill="#6E9587" />
              </>
            )}
          </g>
        </svg>
      </button>

      {/* The board opens BELOW the companion.

          A companion perched on the top edge of a card would have its
          board open over whatever is above the card - the page
          subtitle, most of the time. It opens downwards instead, and
          the board measures the edge of the screen so it never hangs
          off the side. */}
      <KakeiboHoverBoard
        visible={showBoard}
        title={title}
        subtitle={tipText}
        badge={badge}
        position="bottom"
      />
    </span>
  );
}

export { KanaheiStationeryMascot };
