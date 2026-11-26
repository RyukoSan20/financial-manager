/**
 * Which pixel icon stands for a category.
 *
 * The categories carry an emoji in the database - "🍔" for food, "🚗"
 * for transport - because that is what they were seeded with. An
 * emoji is drawn by the reader's operating system, so the same
 * category is a flat glyph on one phone and a glossy three-dimensional
 * burger on another, and neither matches the rest of the page.
 *
 * Rather than migrate the data (the emoji is a perfectly good key, and
 * a migration would have to be undone for anyone reading the database
 * directly), the emoji is translated to one of our drawn icons here,
 * at the boundary where it is about to be shown.
 *
 * A category whose emoji is not in this table falls back by name, and
 * then to a ledger, so a category the app has never seen still gets a
 * drawn icon rather than a tofu box.
 */

/** emoji -> the name of a PixelArtBusinessIcon. */
const BY_EMOJI = {
  '🍔': 'food',
  '🍕': 'food',
  '🍜': 'food',
  '☕': 'coffee',
  '🚗': 'smartphone',
  '🛒': 'ewallet',
  '🏥': 'clipboard',
  '📚': 'ledger_blue',
  '🎬': 'chat_info',
  '📄': 'receipt',
  '💰': 'money_bag_rp',
  '💵': 'money_bag_rp',
  '🏦': 'coin',
  '📈': 'coin',
  '💻': 'briefcase',
  '🎁': 'coin',
  '📦': 'ledger_green',
  '📁': 'ledger_green',
  '🏠': 'home',
  '🏢': 'office',
  '📅': 'calendar',
  '💡': 'lightbulb',
  '🧾': 'receipt',
  '📒': 'ledger_red',
};

/** A word in the category's name -> an icon, when the emoji is unknown. */
const BY_WORD = [
  [/makan|minum|food|drink|kopi|coffee|cafe/i, 'food'],
  [/transport|kendara|bensin|fuel|travel/i, 'smartphone'],
  [/belanja|shop|grocer/i, 'ewallet'],
  [/sehat|health|obat|medic/i, 'clipboard'],
  [/didik|educat|sekolah|kursus|book/i, 'ledger_blue'],
  [/hibur|entertain|movie|game/i, 'chat_info'],
  [/tagih|util|bill|listrik|air|internet/i, 'receipt'],
  [/gaji|salary|upah|income|masuk/i, 'money_bag_rp'],
  [/invest|tabung|saving|deposit/i, 'coin'],
  [/freelance|kerja|work|bisnis|business/i, 'briefcase'],
  [/rumah|home|household|sewa|rent/i, 'home'],
  [/kantor|office/i, 'office'],
];

/**
 * The icon for a category.
 *
 * @param {object|string} category A category object, or just its emoji.
 * @returns {string} A PixelArtBusinessIcon name. Never empty.
 */
export function pixelIconForCategory(category) {
  if (!category) return 'ledger_green';
  const emoji = typeof category === 'string' ? category : category.icon;
  const name = typeof category === 'string' ? '' : category.name || '';

  if (emoji && BY_EMOJI[emoji]) return BY_EMOJI[emoji];
  for (const [pattern, icon] of BY_WORD) {
    if (pattern.test(name)) return icon;
  }
  return 'ledger_green';
}

export { BY_EMOJI as PIXEL_ICON_BY_EMOJI };
