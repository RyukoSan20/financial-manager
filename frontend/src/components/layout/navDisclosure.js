/**
 * How much of the sidebar to show at once.
 *
 * A group with four items is fine. A group with ten is not: the
 * reader scrolls past the whole menu to find the one page they
 * wanted, and everything below the fold looks like more of the same.
 *
 * So a long group shows the first few and keeps the rest behind one
 * line that says there are more. The line says how many, so the
 * reader knows it is worth opening.
 *
 * The rule lives here, with no React in it, so it can be checked by a
 * script rather than only by looking at the screen.
 */

/**
 * How many items a group shows before the rest are tucked away.
 *
 * Three is the number that works: it is enough to show what a group
 * is for, and few enough that the list of groups stays short.
 */
export const ITEMS_BEFORE_THE_REST = 3;

/**
 * The items of a group, split into the ones that show and the ones
 * that are tucked away.
 *
 * `alwaysShow` is for the items that must be visible however long
 * the group is. The page the reader is on is one of them: a reader
 * who is on the analytics page and cannot see the analytics link
 * has to hunt for it.
 */
export function splitGroupItems(items, { activeHref = null, limit = ITEMS_BEFORE_THE_REST } = {}) {
  const list = Array.isArray(items) ? items : [];

  if (list.length <= limit) {
    return { shown: list, hidden: [], hasMore: false, moreCount: 0 };
  }

  // The item the reader is on is always shown, even when it is past
  // the line. It is moved up to the end of the shown list rather
  // than the start, so the order of the group still reads the same.
  const activeIndex = activeHref
    ? list.findIndex((item) => item && item.href === activeHref)
    : -1;

  if (activeIndex >= limit) {
    const active = list[activeIndex];
    const rest = list.filter((_, index) => index !== activeIndex);
    const shown = [...rest.slice(0, limit - 1), active];
    const hidden = rest.slice(limit - 1);
    return { shown, hidden, hasMore: hidden.length > 0, moreCount: hidden.length };
  }

  return {
    shown: list.slice(0, limit),
    hidden: list.slice(limit),
    hasMore: true,
    moreCount: list.length - limit,
  };
}

/**
 * The line that opens the rest of a group.
 *
 * It says how many are waiting, so the reader knows whether it is
 * worth the click.
 */
export function moreLabel(count, language = 'id') {
  const n = Number(count) || 0;
  if (n <= 0) return '';

  const word =
    language === 'en' ? (n === 1 ? 'more' : 'more') :
    language === 'ja' ? '件表示' :
    'lainnya';

  return language === 'ja' ? `ほか ${n} ${word}` : `${n} ${word}`;
}

/**
 * Which group a page belongs to.
 *
 * This is used to open the group that holds the page the reader is
 * on, so the group is never collapsed with the reader's own page
 * hidden inside it.
 */
export function groupOfPage(groups, pathname) {
  if (!pathname) return null;

  for (const group of groups || []) {
    for (const item of group.items || []) {
      if (!item) continue;
      if (item.href === pathname) return group.key;
      if (item.href !== '/' && pathname.startsWith(item.href)) return group.key;
    }
  }
  return null;
}
