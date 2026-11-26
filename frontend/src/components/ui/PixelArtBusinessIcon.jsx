/**
 * The pixel-art business icons.
 *
 * An operating system emoji is not an asset. It is drawn by whatever
 * machine the reader happens to be on, which means the same "lightbulb"
 * is a flat glyph on one phone and a glossy three-dimensional bulb on
 * another, and neither of them matches anything else on the page.
 *
 * So the icons that carry meaning here are drawn, in a deliberate
 * retro pixel manner: every one sits in a soft circular badge, every
 * shape is a whole-number rectangle on a 48x48 grid, and the whole
 * thing is rendered with `shapeRendering="crispEdges"` so the pixels
 * stay pixels instead of being smoothed into mush at small sizes.
 *
 * The outline is one dark slate, #1E242B, and the fills are the retro
 * palette below. Nothing here is an emoji and nothing here depends on
 * a font.
 *
 * Usage:
 *
 *     <PixelArtBusinessIcon name="food" size={28} />
 */

/** The retro fills. One place, so sixteen icons cannot drift apart. */
export const PIXEL_PALETTE = Object.freeze({
  ink: '#1E242B',
  badge: '#E8ECEF',
  white: '#FFFDF9',
  cream: '#F6E7C4',
  red: '#E07A5F',
  rose: '#F7B2AD',
  gold: '#F4E285',
  amber: '#C9A227',
  sage: '#52796F',
  mint: '#A8E6CF',
  sky: '#8EC9E0',
  blue: '#4A7BA7',
  brown: '#8A5B4C',
  slate: '#5C6460',
});

const P = PIXEL_PALETTE;

/** A pixel: a 2x2 block on the 48-grid, so the art reads at 24px. */
const px = (x, y, w, h, fill) => ({ x, y, w, h, fill });

/**
 * Every icon, as a list of blocks.
 *
 * A list rather than a path because a pixel drawing IS a list of
 * blocks - writing it as path data would hide the grid and make it
 * impossible to nudge one pixel without re-reading the whole string.
 */
const ICONS = {
  // A coffee cup on a saucer, with steam. Replaces the burger emoji:
  // what the app records is a cafe spend, not a sandwich.
  coffee: [
    px(18, 8, 2, 4, P.slate), px(24, 6, 2, 4, P.slate), px(30, 8, 2, 4, P.slate),
    px(12, 16, 22, 4, P.white),
    px(12, 20, 22, 10, P.red),
    px(34, 20, 6, 2, P.white), px(38, 22, 2, 4, P.white), px(34, 26, 6, 2, P.white),
    px(14, 30, 18, 2, P.brown),
    px(10, 34, 28, 3, P.white),
  ],
  // Food reads as the same cup: the category is "makanan & minuman".
  food: [
    px(14, 10, 2, 6, P.slate), px(20, 8, 2, 8, P.slate), px(26, 10, 2, 6, P.slate),
    px(10, 18, 24, 4, P.cream),
    px(10, 22, 24, 10, P.red),
    px(34, 22, 6, 2, P.cream), px(38, 24, 2, 4, P.cream), px(34, 28, 6, 2, P.cream),
    px(12, 32, 20, 2, P.brown),
    px(8, 36, 30, 3, P.cream),
  ],
  home: [
    px(22, 8, 4, 2, P.red),
    px(18, 10, 12, 2, P.red),
    px(14, 12, 20, 2, P.red),
    px(10, 14, 28, 3, P.red),
    px(13, 17, 22, 17, P.cream),
    px(20, 24, 8, 10, P.brown),
    px(16, 20, 4, 4, P.sky), px(28, 20, 4, 4, P.sky),
    px(11, 34, 26, 3, P.slate),
  ],
  office: [
    px(12, 8, 24, 29, P.slate),
    px(16, 12, 5, 5, P.sky), px(23, 12, 5, 5, P.sky), px(30, 12, 3, 5, P.sky),
    px(16, 20, 5, 5, P.sky), px(23, 20, 5, 5, P.sky), px(30, 20, 3, 5, P.sky),
    px(16, 28, 5, 5, P.sky), px(30, 28, 3, 5, P.sky),
    px(22, 28, 5, 9, P.brown),
    px(10, 37, 28, 2, P.ink),
  ],
  // Replaces the calendar emoji.
  calendar: [
    px(10, 10, 28, 6, P.red),
    px(15, 7, 3, 5, P.slate), px(30, 7, 3, 5, P.slate),
    px(10, 16, 28, 21, P.white),
    px(14, 20, 4, 4, P.sage), px(22, 20, 4, 4, P.sage), px(30, 20, 4, 4, P.sage),
    px(14, 27, 4, 4, P.sage), px(22, 27, 4, 4, P.rose), px(30, 27, 4, 4, P.sage),
    px(10, 35, 28, 2, P.slate),
  ],
  calculator: [
    px(11, 7, 26, 32, P.slate),
    px(15, 11, 18, 7, P.mint),
    px(15, 21, 4, 4, P.white), px(21, 21, 4, 4, P.white), px(27, 21, 4, 4, P.white),
    px(15, 27, 4, 4, P.white), px(21, 27, 4, 4, P.white), px(27, 27, 4, 4, P.gold),
    px(15, 33, 10, 3, P.white), px(27, 33, 4, 3, P.gold),
  ],
  money_bag_rp: [
    px(20, 7, 8, 3, P.brown),
    px(18, 10, 12, 3, P.amber),
    px(14, 13, 20, 6, P.gold),
    px(11, 19, 26, 16, P.gold),
    px(14, 35, 20, 3, P.amber),
    // an R and a P in pixels
    px(19, 22, 3, 9, P.ink), px(22, 22, 4, 3, P.ink), px(22, 26, 3, 2, P.ink),
    px(27, 22, 3, 9, P.ink), px(30, 22, 4, 3, P.ink), px(30, 25, 3, 2, P.ink),
  ],
  money_bag_yen: [
    px(20, 7, 8, 3, P.brown),
    px(18, 10, 12, 3, P.amber),
    px(14, 13, 20, 6, P.gold),
    px(11, 19, 26, 16, P.gold),
    px(14, 35, 20, 3, P.amber),
    px(18, 22, 3, 3, P.ink), px(27, 22, 3, 3, P.ink),
    px(21, 25, 6, 3, P.ink),
    px(17, 28, 14, 2, P.ink), px(17, 31, 14, 2, P.ink),
    px(22, 28, 4, 6, P.ink),
  ],
  coin: [
    px(18, 8, 12, 3, P.amber),
    px(14, 11, 20, 3, P.gold),
    px(11, 14, 26, 18, P.gold),
    px(14, 32, 20, 3, P.amber),
    px(18, 35, 12, 3, P.amber),
    px(16, 14, 4, 8, P.white),
    px(21, 18, 6, 10, P.amber),
    px(23, 16, 3, 14, P.ink),
  ],
  ledger_red: ledger(P.red),
  ledger_blue: ledger(P.blue),
  ledger_green: ledger(P.sage),
  receipt: [
    px(13, 6, 22, 33, P.white),
    px(13, 39, 3, 3, P.white), px(19, 39, 3, 3, P.white),
    px(26, 39, 3, 3, P.white), px(32, 39, 3, 3, P.white),
    px(17, 11, 14, 3, P.slate),
    px(17, 17, 7, 2, P.slate), px(27, 17, 4, 2, P.sage),
    px(17, 22, 7, 2, P.slate), px(27, 22, 4, 2, P.sage),
    px(17, 27, 7, 2, P.slate), px(27, 27, 4, 2, P.sage),
    // the tick
    px(18, 32, 2, 2, P.sage), px(20, 34, 2, 2, P.sage),
    px(22, 32, 2, 2, P.sage), px(24, 30, 2, 2, P.sage),
  ],
  clipboard: [
    px(13, 9, 22, 30, P.cream),
    px(19, 6, 10, 5, P.slate),
    px(17, 16, 3, 3, P.sage), px(22, 16, 10, 3, P.slate),
    px(17, 22, 3, 3, P.sage), px(22, 22, 10, 3, P.slate),
    px(17, 28, 3, 3, P.rose), px(22, 28, 10, 3, P.slate),
  ],
  // A speech bubble with a bang in it. Replaces the lightbulb emoji.
  lightbulb: bubble('!', P.gold),
  chat_info: bubble('!', P.sky),
  chat_question: bubble('?', P.rose),
  smartphone: [
    px(16, 6, 16, 36, P.slate),
    px(19, 10, 10, 24, P.sky),
    px(20, 11, 4, 8, P.white),
    px(21, 36, 6, 3, P.white),
  ],
  ewallet: [
    px(10, 13, 28, 23, P.brown),
    px(10, 13, 28, 4, P.amber),
    px(24, 21, 14, 8, P.cream),
    px(28, 23, 4, 4, P.sage),
  ],
  briefcase: [
    px(19, 8, 10, 4, P.brown),
    px(9, 12, 30, 24, P.brown),
    px(9, 20, 30, 4, P.amber),
    px(22, 18, 4, 8, P.gold),
    px(9, 36, 30, 2, P.ink),
  ],
  income: [
    px(22, 8, 4, 18, P.sage),
    px(16, 14, 4, 4, P.sage), px(28, 14, 4, 4, P.sage),
    px(19, 11, 4, 4, P.sage), px(25, 11, 4, 4, P.sage),
    px(11, 26, 26, 11, P.mint),
    px(11, 26, 26, 3, P.sage),
  ],
  merchant: null, // filled in below from `office`
};

/** The three ledgers differ only in the colour of the cover. */
function ledger(cover) {
  return [
    px(12, 7, 24, 32, cover),
    px(12, 7, 5, 32, P.ink),
    px(14, 11, 2, 3, P.white), px(14, 17, 2, 3, P.white),
    px(14, 23, 2, 3, P.white), px(14, 29, 2, 3, P.white),
    px(20, 13, 13, 3, P.white),
    px(20, 19, 13, 2, P.white),
    px(20, 24, 9, 2, P.white),
    px(20, 30, 13, 3, P.cream),
  ];
}

/** A speech bubble carrying one pixel glyph. */
function bubble(glyph, fill) {
  const base = [
    px(8, 9, 32, 22, fill),
    px(14, 31, 8, 5, fill),
  ];
  if (glyph === '!') {
    return [...base, px(22, 13, 4, 10, P.ink), px(22, 25, 4, 3, P.ink)];
  }
  return [
    ...base,
    px(20, 13, 8, 3, P.ink),
    px(27, 15, 3, 5, P.ink),
    px(23, 19, 5, 3, P.ink),
    px(22, 22, 4, 2, P.ink),
    px(22, 26, 4, 3, P.ink),
  ];
}

ICONS.merchant = ICONS.office;

/** Every name this component answers to. */
export const PIXEL_ICON_NAMES = Object.freeze(Object.keys(ICONS));

/** The badge tint behind each icon, when it is not the default grey. */
const BADGE_TINT = {
  coffee: '#FBEAE4',
  food: '#FBEAE4',
  home: '#E8F0ED',
  office: '#E8ECEF',
  merchant: '#E8ECEF',
  calendar: '#FDE8E4',
  calculator: '#E3F2EA',
  money_bag_rp: '#FFF6D6',
  money_bag_yen: '#FFF6D6',
  coin: '#FFF6D6',
  ledger_red: '#FBEAE4',
  ledger_blue: '#E6EFF6',
  ledger_green: '#E3F2EA',
  receipt: '#F4EFE6',
  clipboard: '#F4EFE6',
  lightbulb: '#FFF6D6',
  chat_info: '#E6EFF6',
  chat_question: '#FDE8E4',
  smartphone: '#E8ECEF',
  ewallet: '#F4EFE6',
  briefcase: '#F4EFE6',
  income: '#E3F2EA',
};

export default function PixelArtBusinessIcon({
  name = 'coin',
  size = 28,
  className = '',
  // The circular badge behind the art. A badge is right in a list or
  // a header; it is wrong when the icon is already inside a coloured
  // chip of its own.
  badge = true,
  title,
  ...rest
}) {
  const blocks = ICONS[name] || ICONS.coin;
  const tint = BADGE_TINT[name] || P.badge;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      data-pixel-icon={name}
      {...rest}
    >
      {badge ? <circle cx="24" cy="24" r="22" fill={tint} /> : null}
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} />
      ))}
    </svg>
  );
}

export { PixelArtBusinessIcon };
