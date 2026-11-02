/**
 * Showing a thing that might be a word or might be a whole row.
 *
 * Some fields come from the server as a plain name, like "Makanan &
 * Minuman". The same field on another screen comes as the whole row
 * of the category out of the database, with fourteen fields in it:
 * the name, the colour, the icon, the parent, the key, and so on.
 *
 * A browser can show a word. It cannot show a row of the database as
 * a piece of text: it says "Objects are not valid as a React child"
 * and the page goes blank. So wherever a value is shown as a piece of
 * text, it goes through here first.
 */

/**
 * The name of the thing, whether the thing is a word already or a
 * row that carries a name inside it.
 *
 * @param {unknown} value - a word, a row, or nothing at all
 * @param {string} [fallback] - what to say when there is nothing
 * @returns {string} something a browser can show
 */
export function textOf(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    const name = value.name;
    if (typeof name === 'string' && name) return name;
    const label = value.label ?? value.title;
    if (typeof label === 'string' && label) return label;
    return fallback;
  }
  return fallback;
}

/**
 * The icon of the thing, if the thing is a row that has one. An icon
 * is an emoji or a short piece of text, never a whole row.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function iconOf(value, fallback = '') {
  if (value && typeof value === 'object') {
    const icon = value.icon;
    if (typeof icon === 'string' && icon) return icon;
  }
  return fallback;
}
