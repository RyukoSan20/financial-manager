/**
 * The kinds of place, and the pins that stand for them.
 *
 * The server decides what kind a place is - it has the merchant name
 * and the address, and it looks them up. The server sends the kind
 * and the name of the pin with every marker, and this file is the
 * fallback for a marker that arrived without one.
 *
 * The names of the pins are the names of the files the generator
 * makes, so that the drawing on the map is the drawing that was
 * drawn for it.
 */

export const KIND_MINIMARKET = 'minimarket';
export const KIND_SUPERMARKET = 'supermarket';
export const KIND_RESTAURANT = 'restaurant';
export const KIND_FRESH_PRODUCE = 'fresh_produce';
export const KIND_OTHER = 'other';

/**
 * The pin that is drawn for each kind of place.
 */
export const PINS_BY_KIND = {
  [KIND_MINIMARKET]: 'pin-minimarket',
  [KIND_SUPERMARKET]: 'pin-supermarket',
  [KIND_RESTAURANT]: 'pin-restaurant',
  [KIND_FRESH_PRODUCE]: 'pin-fresh-produce',
  [KIND_OTHER]: 'pin-minimarket',
};

/**
 * The pin of a place.
 *
 * The server sends the pin with the marker. When it did not, the kind
 * is used to work out which one it should be.
 */
export function pinFor(marker) {
  if (!marker) return PINS_BY_KIND[KIND_OTHER];
  if (marker.pin) return marker.pin;
  return PINS_BY_KIND[marker.kind] || PINS_BY_KIND[KIND_OTHER];
}

/**
 * The kinds of place the map draws a different pin for.
 *
 * The legend is built from this list, so that the key on the map and
 * the pins on the map cannot drift apart.
 */
export const PIN_KINDS = [
  KIND_MINIMARKET,
  KIND_SUPERMARKET,
  KIND_RESTAURANT,
  KIND_FRESH_PRODUCE,
];

/**
 * The size of the circle under the pin.
 *
 * The circle is the spending: the more was spent there, the bigger
 * the ground the pin stands on. It is bounded, so that one very
 * large place does not flatten every other place into nothing.
 */
export function circleSize(totalSpent, maxSpent) {
  if (!totalSpent || !maxSpent) return 22;
  const ratio = Math.max(0, Math.min(1, totalSpent / maxSpent));
  return Math.round(18 + ratio * 40);
}

/**
 * The colour of the circle under the pin.
 *
 * The shape says what kind of place it is. The colour says what the
 * money was spent on, so the two layers carry two different facts.
 */
export function circleColor(kind) {
  switch (kind) {
    case KIND_MINIMARKET:
      return '#059669';
    case KIND_SUPERMARKET:
      return '#0284c7';
    case KIND_RESTAURANT:
      return '#e11d48';
    case KIND_FRESH_PRODUCE:
      return '#16a34a';
    default:
      return '#64748b';
  }
}
