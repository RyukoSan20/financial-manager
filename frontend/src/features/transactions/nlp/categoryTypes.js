/**
 * The kinds of category, and which of them belong to which kind of
 * transaction.
 *
 * A reader records three kinds of thing: what they spent, what came
 * in, and money that moved from one account to another. Each has its
 * own categories, and the two sets do not overlap.
 *
 * They used to overlap on the screen. The sheet that says "Pilih
 * Kategori" showed "Gaji" and "Makanan & Minuman" in one list, so a
 * reader recording an income was offered food, and a reader recording
 * an expense was offered a salary.
 *
 * Two things caused it, and both are fixed here and at the source:
 *
 * - the server did not say what kind each category was, so the screen
 *   could not tell them apart. It says now.
 * - the filter let through any category that did not say what it was.
 *   A category that says nothing is still let through, because there
 *   is nothing to be strict about - but a category that says "income"
 *   is never shown on the expense tab.
 *
 * These are the rules, in one place, so the sheet, the quick pills
 * and the parser all agree about them.
 */

/**
 * The three kinds of transaction.
 */
export const EXPENSE = 'expense';
export const INCOME = 'income';
export const TRANSFER = 'transfer';

/**
 * The categories each kind of transaction is offered.
 *
 * A transfer moves money between the reader's own accounts. It is
 * not spending and it is not earning, and the categories that fit it
 * are the ones about the moving of money - so it is not narrowed to
 * "expense" and not to "income".
 */
export const CATEGORY_TYPES_BY_TRANSACTION = {
  [EXPENSE]: [EXPENSE],
  [INCOME]: [INCOME],
  [TRANSFER]: [TRANSFER],
};

/**
 * Is a transfer narrowed at all?
 *
 * A transfer has its own category - "Mutasi Antar-Akun" - and that
 * one is what a reader picks. The expense and the income categories
 * are not offered, because a transfer is neither of them.
 */
export function isNarrowedType(type) {
  return type === EXPENSE || type === INCOME;
}

/**
 * Is this category of the kind this transaction is?
 *
 * The answer is strict. A category that says nothing is allowed -
 * there is nothing to be strict about - but a category that says
 * "income" is never of an expense, and never of a transfer.
 */
export function categoryMatchesType(category, type) {
  if (!category) return false;

  const kind = category.type;

  // A category that does not say what it is. It is let through,
  // because refusing it would hide a category the reader made and can
  // see everywhere else in the application.
  if (!kind) return true;

  const wanted = CATEGORY_TYPES_BY_TRANSACTION[type] || [type];
  return wanted.includes(kind);
}

/**
 * The categories of a transfer.
 *
 * A transfer is narrowed to the categories about the moving of money,
 * and to the ones that say nothing - because a transfer is neither an
 * expense nor an income.
 */
export function categoriesForTransfer(categories = []) {
  return (categories || []).filter((cat) => {
    if (!cat.type) return true;
    return cat.type === TRANSFER;
  });
}

/**
 * The categories of this kind of transaction.
 *
 * The list the sheet shows, the list the quick pills are made of, and
 * the list the parser suggests from: all the same list.
 */
export function categoriesForType(categories = [], type = EXPENSE) {
  if (type === TRANSFER) return categoriesForTransfer(categories);
  return (categories || []).filter((cat) => categoryMatchesType(cat, type));
}

/**
 * The categories of this kind of transaction that have nothing under
 * them, and the ones that have.
 *
 * The sheet shows the ones with something under them first, as a
 * tree, and the ones with nothing under them after, as a flat list.
 */
export function splitByHasChildren(categories = [], hasChildrenOf = () => false) {
  const withChildren = [];
  const withoutChildren = [];

  for (const cat of categories || []) {
    if (cat.parent_id) continue;
    if (hasChildrenOf(cat)) withChildren.push(cat);
    else withoutChildren.push(cat);
  }

  return { withChildren, withoutChildren };
}

/**
 * The kind of transaction a category belongs to, if it says.
 */
export function categoryType(category) {
  return category?.type || null;
}

export default {
  EXPENSE,
  INCOME,
  TRANSFER,
  CATEGORY_TYPES_BY_TRANSACTION,
  isNarrowedType,
  categoryMatchesType,
  categoriesForTransfer,
  categoriesForType,
  splitByHasChildren,
  categoryType,
};
