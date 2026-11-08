/**
 * The line under a transaction's description.
 *
 * A row in the list of transactions shows the description on one line
 * and something under it. What is under it has to be the category,
 * and - when the transaction has one - the sub-category.
 *
 * "Makanan & Minuman" alone does not say whether this was coffee or
 * groceries, and the list of transactions is exactly where the
 * reader wants to tell those apart.
 *
 * There is one thing this must never do: show a sub-category that
 * belongs to another category. A reader was shown "Gaji" under
 * "Makan Siang", because the transaction carried the tag of a
 * different category and the line below was written from whatever
 * was there. A salary is not a kind of lunch, and saying so is
 * worse than saying nothing.
 *
 * So the sub-category is only shown when the tag is one of the
 * sub-categories of the category that is actually shown. A tag that
 * is not one of them is left out.
 */

import { categoryName } from './categoryName.js';
import { subCategoriesFor, subCategoryName } from '../features/transactions/nlp/subCategories.js';

/**
 * The sub-category of a transaction, if it really is one.
 *
 * The tag on a transaction is free text. It is a sub-category when
 * it is one of the sub-categories of the parent, and it is not one
 * when it is anything else - a label the reader typed, a tag from
 * another category, or nothing at all.
 */
export function transactionSubCategory(transaction, parent) {
  if (!transaction || !parent || !parent.system_key) return null;

  const tag = String(transaction.tags || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0];
  if (!tag) return null;

  const subs = subCategoriesFor(parent.system_key);
  if (!subs.length) return null;

  const match = subs.find((sub) => sub.key === tag);
  if (!match) return null;

  return match.name || subCategoryName(parent.system_key, tag);
}

/**
 * The line under the description.
 */
export function transactionLabel({
  tx,
  category,
  account,
  language = 'id',
  unknown = '-',
}) {
  const parentName = category ? categoryName(category, language) : null;

  if (!parentName) {
    return account?.name || unknown;
  }

  const sub = transactionSubCategory(tx, category);
  if (!sub) return parentName;

  return `${parentName} · ${sub}`;
}

export default transactionLabel;
