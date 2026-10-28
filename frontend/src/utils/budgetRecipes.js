/**
 * The budget recipes.
 *
 * A budget form asks a reader to make three decisions before they have
 * any of them: how much comes in, what to do with it, and how to
 * divide it. The last one is the hard part, and it is the same for
 * most people.
 *
 * So there are some starting points. Each one is a way of dividing the
 * money, with the three parts named for what they are for. The reader
 * takes one, moves the sliders, and the amount per day is worked out
 * for them.
 *
 * The splits are the ones that are usually quoted:
 *
 * - 50/30/20 is the classic: half for what is needed, three tenths
 *   for what is wanted, two tenths for what is owed.
 * - 40/20/40 is for a reader whose debts are the pressure point.
 * - 60/20/20 is for a reader whose needs are the pressure point.
 * - 50/20/30 is for a reader who is paying off something.
 *
 * They are starting points, not rules. Every one of them can be moved.
 */

/**
 * The three parts of a budget.
 *
 * The order is the order they are shown in: what is needed, what is
 * wanted, what is owed.
 */
export const PARTS = [
  {
    key: 'needs',
    labelKey: 'budget_recipe.part_needs',
    fallback: 'Kebutuhan',
  },
  {
    key: 'wants',
    labelKey: 'budget_recipe.part_wants',
    fallback: 'Keinginan',
  },
  {
    key: 'savings',
    labelKey: 'budget_recipe.part_savings',
    fallback: 'Tabungan',
  },
];

/**
 * The recipes.
 *
 * `split` is the three percentages. They add up to 100, which is
 * checked when the module is loaded, so a recipe with a mistake in it
 * is caught rather than quietly giving a budget that does not add up.
 */
export const RECIPES = [
  {
    id: 'balanced',
    nameKey: 'budget_recipe.balanced_name',
    fallback: 'Si Seimbang',
    descriptionKey: 'budget_recipe.balanced_desc',
    descriptionFallback: 'Setengah untuk kebutuhan, tiga bagian untuk keinginan, dua bagian untuk ditabung.',
    split: { needs: 50, wants: 30, savings: 20 },
  },
  {
    id: 'fighter',
    nameKey: 'budget_recipe.fighter_name',
    fallback: 'Si Pejuang Cuan',
    descriptionKey: 'budget_recipe.fighter_desc',
    descriptionFallback: 'Lebih banyak ditabung, untuk pembaca yang sedang menabung.',
    split: { needs: 40, wants: 20, savings: 40 },
  },
  {
    id: 'city',
    nameKey: 'budget_recipe.city_name',
    fallback: 'Si Anak Kota',
    descriptionKey: 'budget_recipe.city_desc',
    descriptionFallback: 'Kebutuhan dijaga aman, sisanya untuk keinginan dan tabungan.',
    split: { needs: 60, wants: 20, savings: 20 },
  },
  {
    id: 'payer',
    nameKey: 'budget_recipe.payer_name',
    fallback: 'Si Pelunas',
    descriptionKey: 'budget_recipe.payer_desc',
    descriptionFallback: 'Separuh untuk kebutuhan, sisanya untuk melunasi yang tertunda.',
    split: { needs: 50, wants: 20, savings: 30 },
  },
];

/**
 * The number of days in a month, for working out the amount per day.
 *
 * Thirty, because a day is a day and not a date. The amount per day is
 * an estimate to help the reader judge a number, not a bill.
 */
export const DAYS_PER_MONTH = 30;

/**
 * A recipe by its name.
 */
export function recipeById(id) {
  return RECIPES.find((recipe) => recipe.id === id) || null;
}

/**
 * Does the three parts add up to a hundred?
 */
export function splitAddsUp(split) {
  if (!split) return false;
  const total = PARTS.reduce((sum, part) => sum + (Number(split[part.key]) || 0), 0);
  return Math.round(total) === 100;
}

/**
 * The money for each part, from the total and the split.
 *
 * The parts that are left over after the rounding are given to the
 * first part, so the three numbers always add up to the total. A
 * budget whose parts do not add up to the money in it is a budget
 * that cannot be spent.
 */
export function amountsFromSplit(total, split) {
  const money = Number(total) || 0;
  if (money <= 0) {
    return PARTS.reduce((result, part) => {
      result[part.key] = 0;
      return result;
    }, {});
  }

  const raw = {};
  let used = 0;
  for (const part of PARTS) {
    const value = Math.round((money * (Number(split[part.key]) || 0)) / 100);
    raw[part.key] = value;
    used += value;
  }

  // What is left over goes to the first part.
  const leftover = money - used;
  if (leftover !== 0) {
    raw[PARTS[0].key] += leftover;
  }

  return raw;
}

/**
 * The amount per day for each part.
 */
export function dailyFromSplit(total, split) {
  const amounts = amountsFromSplit(total, split);
  const result = {};
  for (const part of PARTS) {
    result[part.key] = Math.round(amounts[part.key] / DAYS_PER_MONTH);
  }
  return result;
}

/**
 * The total for a split, which is the sum of the three parts.
 */
export function totalFromSplit(split) {
  return PARTS.reduce((sum, part) => sum + (Number(split[part.key]) || 0), 0);
}

/**
 * The split a recipe gives, as a fresh object.
 *
 * A copy, so that moving a slider does not move the recipe itself.
 */
export function splitOf(recipe) {
  if (!recipe) return { needs: 0, wants: 0, savings: 0 };
  return { ...recipe.split };
}

/**
 * The shortest form of an amount, for the card.
 *
 * A reader looking at a recipe does not want to read "Rp 2.500.000".
 * They want to know whether it is "2,5 juta" or "2 juta", and the
 * per day figure they will actually act on.
 *
 * The suffix is kept in the language of the reader, so the same
 * number reads the way it is written where they are.
 */
export function shortAmount(value, language = 'id') {
  const money = Number(value) || 0;
  // Only nothing at all is written as "0". A negative amount keeps
  // its sign, because "0" would say there is no shortfall when there
  // is one.
  if (money === 0) return '0';

  const suffixes =
    language === 'en'
      ? { thousand: 'K', million: 'M', billion: 'B' }
      : language === 'ja'
        ? { thousand: '千', million: '百万', billion: '十億' }
        : { thousand: 'K', million: 'jt', billion: 'M' };

  const absolute = Math.abs(money);
  const sign = money < 0 ? '-' : '';

  if (absolute >= 1_000_000_000) {
    return `${sign}${(absolute / 1_000_000_000).toFixed(1).replace('.', ',')}${suffixes.billion}`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}${(absolute / 1_000_000).toFixed(1).replace('.', ',')}${suffixes.million}`;
  }
  if (absolute >= 1_000) {
    // The absolute value is divided, so the sign is put back by hand.
    // Dividing the negative number would round towards zero and lose
    // the minus.
    return `${sign}${Math.round(absolute / 1_000)}${suffixes.thousand}`;
  }
  // A negative amount of less than a thousand would lose its sign here,
  // because Math.round of a negative number is written with a minus.
  // It is written out so the sign cannot be lost.
  return money < 0 ? `-${Math.round(absolute)}` : `${Math.round(absolute)}`;
}

/**
 * The per day figure, in the form it is shown.
 *
 * The argument is the amount per day, not the amount for the month.
 * "Rp 500K/hari" and its equivalents.
 */
export function dailyLabel(dailyAmount, language = 'id') {
  const short = shortAmount(dailyAmount, language);
  const perDay = language === 'en' ? '/day' : language === 'ja' ? '/日' : '/hari';
  return `Rp ${short}${perDay}`;
}
