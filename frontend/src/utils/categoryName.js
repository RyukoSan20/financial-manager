// The name of a category, in the language the reader picked.
//
// A category the application ships with carries a system_key, a name
// that does not depend on any language. That key is looked up in the
// translation files, so the wording lives in one place and a change of
// the wording never has to touch the database.
//
// A category the reader made has no key. Their own name is used, in
// their own spelling, in every language. That is what they typed and
// it stays as it is.
//
// The backend also sends name_en and name_ja for the categories that
// have them. Those are the fallback when the translation files do not
// have the key yet.

import { useTranslation } from '../i18n';

// The built-in categories, in the three languages. The key is the same
// one the database carries.
export const BUILT_IN_CATEGORIES = {
  salary: { id: 'salary', name: 'Gaji', name_en: 'Salary', name_ja: '給与', icon: '💰' },
  freelance: { id: 'freelance', name: 'Freelance', name_en: 'Freelance', name_ja: 'フリーランス', icon: '💻' },
  investment_income: { id: 'investment_income', name: 'Investasi', name_en: 'Investment', name_ja: '投資収入', icon: '📈' },
  bonus: { id: 'bonus', name: 'Bonus', name_en: 'Bonus', name_ja: 'ボーナス', icon: '🎁' },
  other_income: { id: 'other_income', name: 'Lainnya (Income)', name_en: 'Other (Income)', name_ja: 'その他（収入）', icon: '📦' },
  food_drink: { id: 'food_drink', name: 'Makanan & Minuman', name_en: 'Food & Drink', name_ja: '飲食', icon: '🍔' },
  transportation: { id: 'transportation', name: 'Transportasi', name_en: 'Transportation', name_ja: '交通', icon: '🚗' },
  shopping: { id: 'shopping', name: 'Belanja', name_en: 'Shopping', name_ja: '買い物', icon: '🛒' },
  health: { id: 'health', name: 'Kesehatan', name_en: 'Health', name_ja: '健康', icon: '🏥' },
  education: { id: 'education', name: 'Pendidikan', name_en: 'Education', name_ja: '教育', icon: '📚' },
  entertainment: { id: 'entertainment', name: 'Hiburan', name_en: 'Entertainment', name_ja: '娯楽', icon: '🎬' },
  bills_utilities: { id: 'bills_utilities', name: 'Tagihan & Utilitas', name_en: 'Bills & Utilities', name_ja: '公共料金', icon: '📄' },
  savings_investment: { id: 'savings_investment', name: 'Investasi & Tabungan', name_en: 'Investment & Savings', name_ja: '投資・貯蓄', icon: '🏦' },
  other_expense: { id: 'other_expense', name: 'Lainnya (Expense)', name_en: 'Other (Expense)', name_ja: 'その他（支出）', icon: '📦' },
};

// The words for the built-in categories, in the three languages. The
// key of each is the same as the system_key in the database.
export const CATEGORY_TRANSLATIONS = {
  id: {
    salary: 'Gaji',
    freelance: 'Freelance',
    investment_income: 'Investasi',
    bonus: 'Bonus',
    other_income: 'Lainnya (Income)',
    food_drink: 'Makanan & Minuman',
    transportation: 'Transportasi',
    shopping: 'Belanja',
    health: 'Kesehatan',
    education: 'Pendidikan',
    entertainment: 'Hiburan',
    bills_utilities: 'Tagihan & Utilitas',
    savings_investment: 'Investasi & Tabungan',
    other_expense: 'Lainnya (Expense)',
  },
  en: {
    salary: 'Salary',
    freelance: 'Freelance',
    investment_income: 'Investment',
    bonus: 'Bonus',
    other_income: 'Other (Income)',
    food_drink: 'Food & Drink',
    transportation: 'Transportation',
    shopping: 'Shopping',
    health: 'Health',
    education: 'Education',
    entertainment: 'Entertainment',
    bills_utilities: 'Bills & Utilities',
    savings_investment: 'Investment & Savings',
    other_expense: 'Other (Expense)',
  },
  ja: {
    salary: '給与',
    freelance: 'フリーランス',
    investment_income: '投資収入',
    bonus: 'ボーナス',
    other_income: 'その他（収入）',
    food_drink: '飲食',
    transportation: '交通',
    shopping: '買い物',
    health: '健康',
    education: '教育',
    entertainment: '娯楽',
    bills_utilities: '公共料金',
    savings_investment: '投資・貯蓄',
    other_expense: 'その他（支出）',
  },
};

// The Indonesian name of each built-in category, so a name that comes
// from the server can be recognised even when it arrives without its
// key.
//
// The dashboard groups spending by category and sends the name as the
// key of the group. That name is the one stored in the database, which
// is Indonesian. Without this table, a Japanese reader would see the
// Indonesian word. With it, the word is recognised and translated.
const NAME_TO_KEY = Object.entries(BUILT_IN_CATEGORIES).reduce((acc, [key, cat]) => {
  acc[cat.name] = key;
  if (cat.name_en) acc[cat.name_en] = key;
  if (cat.name_ja) acc[cat.name_ja] = key;
  return acc;
}, {});

// The name of a category, given the language, without needing a hook.
// Used where a hook is not available, such as inside a plain map.
//
// It takes either a category object or a plain name. A plain name is
// matched against the built-in categories first.
export function categoryName(category, language = 'id') {
  if (!category) return '';

  // A plain name from the server.
  if (typeof category === 'string') {
    const key = NAME_TO_KEY[category];
    if (key && CATEGORY_TRANSLATIONS[language]?.[key]) {
      return CATEGORY_TRANSLATIONS[language][key];
    }
    return category;
  }

  const key = category.system_key;
  if (key && CATEGORY_TRANSLATIONS[language]?.[key]) {
    return CATEGORY_TRANSLATIONS[language][key];
  }
  // A built-in category whose translation is not known yet falls back
  // to the name the backend sent for this language.
  if (key) {
    if (language === 'en' && category.name_en) return category.name_en;
    if (language === 'ja' && category.name_ja) return category.name_ja;
  }
  // The name the server sent may still be a built-in one that arrives
  // without its key. Recognise it by its spelling.
  const byName = NAME_TO_KEY[category.name];
  if (byName && CATEGORY_TRANSLATIONS[language]?.[byName]) {
    return CATEGORY_TRANSLATIONS[language][byName];
  }
  return category.name || '';
}

// The name of the category of a transaction, in the language of the
// reader.
//
// The backend sends the name the category is stored under, and for a
// built-in category also its key. The key is what names it in a way
// that does not depend on any language, so it is preferred.
export function transactionCategoryName(tx, language = 'id') {
  if (!tx) return '';
  const name = tx.category_name || tx.category || '';
  if (!name) return '';
  const key = tx.category_system_key;
  if (key && CATEGORY_TRANSLATIONS[language]?.[key]) {
    return CATEGORY_TRANSLATIONS[language][key];
  }
  return categoryName(name, language);
}

// The key of a built-in category, given its name in any of the three
// languages. Returns null for a category the reader made, which has no
// key.
//
// The dashboard groups spending by category and sends the name as the
// key of the group. That name is the one stored in the database, which
// is Indonesian. This recognises it.
export function categoryKey(category) {
  if (!category) return null;
  if (typeof category === 'string') return NAME_TO_KEY[category] || null;
  if (category.system_key) return category.system_key;
  return NAME_TO_KEY[category.name] || null;
}

// The same, but it follows the language of the reader.
export function useCategoryName() {
  const { language } = useTranslation();
  return (category) => categoryName(category, language);
}
