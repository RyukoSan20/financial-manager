/**
 * The chips of the things that were bought before.
 *
 * The chips under the quick entry are the reader's own history. They
 * are the shortcuts back to a transaction that is already done: one
 * tap and the amount, the category and the account are all filled in
 * again.
 *
 * The trouble with a history is that it repeats itself. Buy the same
 * kind of thing from the same shop three times and the chips become
 * three copies of one thing, which tells the reader nothing they did
 * not already know. So the chips are deduplicated by what they
 * actually are: the category, the account and what was bought.
 *
 * The chip also has to say what was bought. When it says the name of
 * the category instead, three chips reading "Makanan & Minuman" look
 * like three different meals and are not.
 */

/**
 * What makes two chips the same chip.
 *
 * The price is not part of it: the price of a thing changes from one
 * trip to the next, and it is still the same thing. The newest chip
 * wins, because it carries the price that was paid last.
 */
export const comboKey = (combo) => {
  if (!combo) return '';
  const category = combo.category_id ?? '';
  const account = combo.account_id ?? '';
  const what = String(combo.description || combo.token || '')
    .trim()
    .toLowerCase();
  return `${category}|${account}|${what}`;
};

/**
 * The history without the repetitions.
 *
 * The first of a kind is kept, because the list is written newest
 * first.
 */
export const dedupeRecentCombos = (combos = [], limit = 4) => {
  const seen = new Set();
  const kept = [];
  for (const combo of Array.isArray(combos) ? combos : []) {
    if (!combo) continue;
    const key = comboKey(combo);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(combo);
    if (kept.length >= limit) break;
  }
  return kept;
};

/**
 * What the chip says.
 *
 * The name of the thing that was bought comes first, because that is
 * what the reader recognises. The name of the category is only used
 * when there is no name of the thing, because a chip that says
 * "Makanan & Minuman" three times is a chip that says nothing.
 */
export const describeCombo = (combo, category) => {
  const what = String(combo?.description || combo?.token || '').trim();
  if (what) return what;
  const name = String(category?.name || '').trim();
  if (name) return name;
  return '';
};
