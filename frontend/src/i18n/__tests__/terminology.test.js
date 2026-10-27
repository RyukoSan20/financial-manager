/**
 * The Indonesian wording.
 *
 * The complaint behind S6 was that the Indonesian screen read as
 * half-finished because English and Indonesian sat side by side: the
 * same thing called "Budget" on one page and "Anggaran" on the next,
 * "Edit" here and "Ubah" there.
 *
 * A reader should not have to learn two words for one thing. This
 * test fixes the words the application has chosen, so a new page
 * cannot quietly introduce a third.
 *
 * These are the words the application already uses most, not new
 * preferences. Where two words competed, the one the application
 * already used everywhere else won.
 *
 * The test is written around *actions*, not around words in general.
 * "Ubah Password" is plain Indonesian and stays; what would be wrong
 * is a second word for the same button.
 *
 * Run with: node src/i18n/__tests__/terminology.test.js
 */

import id from '../id.js';
import en from '../en.js';
import ja from '../ja.js';

/**
 * Flatten a translation table into "dotted.key": "text".
 */
function flatten(table, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(table)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, full));
    } else if (typeof value === 'string') {
      out[full] = value;
    }
  }
  return out;
}

const idFlat = flatten(id);
const enFlat = flatten(en);
const jaFlat = flatten(ja);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
  }
}

/**
 * The labels the application shows, and the one word each uses.
 *
 * `keys` lists the places the label appears. `word` is the word the
 * application settled on. `competing` is the word that was competing
 * with it.
 */
const LABELS = [
  {
    concept: 'budget',
    keys: [/^nav\.budgets$/, /^budget\./, /^budgets\./, /^dashboard\.budget_/, /^dashboard\.manage_budget$/,
           /^analytics\.(total_budget|budget_remaining|chart_budget|widget_budget_label)$/,
           /^passport\.count\.budgets$/, /^readiness\.budget_/, /^calculators\.(tab_budget|budget_title|budget_rule_note)$/,
           /^shopping_tracker\.(monthly_budget|set_budget|summary_bar)$/, /^shopping\.(total_budget|remaining_budget)$/,
           /^notification_settings\.budget$/],
    word: /\bbudget\b/i,
    competing: /\banggaran\b/i,
  },
  {
    concept: 'goal',
    keys: [/^nav\.goals$/, /^goals\./, /^readiness\.goals_/, /^ai_advisor\.advice_goals_/],
    word: /\btarget\b/i,
    competing: /\btujuan\b/i,
  },
  {
    concept: 'edit',
    keys: [/^common\.edit$/, /^transaction\.edit$/, /^account\.edit$/, /^budgets\.edit$/, /^goals\.edit_goal$/,
           /^debts\.edit_debt$/, /^profile\.edit_profile$/, /^ai_advisor\.local_edit_/],
    word: /\bedit\b/i,
    competing: /\bubah\b/i,
  },
  {
    concept: 'transaction',
    keys: [/^nav\.transactions$/, /^transaction\./, /^feed\./, /^merchant_map\.gps_transaction$/],
    word: /\btransaksi\b/i,
    competing: /\btransaction\b/i,
  },
  {
    concept: 'expense',
    keys: [/^nav\.categoryExpenses$/, /^category\./, /^ai_advisor\.local_total_expense$/],
    word: /\bpengeluaran\b/i,
    competing: /\bexpense\b/i,
  },
  {
    concept: 'income',
    keys: [/^ai_advisor\.local_total_income$/, /^ai_advisor\.local_savings_negative$/, /^ai_advisor\.local_tip_save20$/,
           /^ai_advisor\.local_saving_tip4$/, /^calculators\.tab_income$/],
    word: /\bpemasukan\b/i,
    competing: /\bincome\b/i,
  },
  {
    concept: 'refresh',
    keys: [/^feed\.refresh$/, /^merchant_map\.refresh_title$/, /^analytics\.reset$/],
    word: /\brefresh\b/i,
    competing: /\bmuat ulang\b/i,
  },
  {
    concept: 'load more',
    keys: [/^feed\.load_more$/],
    word: /\bmuat lagi\b/i,
    competing: /\bload more\b/i,
  },
  {
    concept: 'filter',
    keys: [/^feed\.filter_active$/, /^feed\.filter_label$/, /^feed\.clear_filter$/, /^common\.filter$/],
    word: /\bfilter\b/i,
    competing: /\bsaring\b/i,
  },
  {
    concept: 'delete',
    keys: [/^common\.delete$/, /^budgets\.delete_confirm$/, /^goals\.delete_confirm$/],
    word: /\bhapus\b/i,
    competing: /\bdelete\b/i,
  },
  {
    concept: 'save',
    keys: [/^common\.save$/, /^profile\.save_changes$/, /^budgets\.create$/, /^goals\.create_goal$/],
    word: /\bsimpan\b/i,
    competing: /\bsave\b/i,
  },
];

// ---------------------------------------------------------------------------
// Each label uses the one word
// ---------------------------------------------------------------------------

for (const label of LABELS) {
  const matched = Object.entries(idFlat).filter(([key]) =>
    label.keys.some((pattern) => pattern.test(key))
  );

  const wrong = matched
    .filter(([, value]) => label.competing.test(value))
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

  check(
    `the ${label.concept} label says "${label.word.source.replace(/\\\\b|\\\\i/g, '')}"`,
    wrong.length === 0,
    wrong.length ? wrong.join('\n      ') : ''
  );

  // The word has to actually be there, or the check above would pass
  // on a label that says nothing at all.
  const says = matched.filter(([, value]) => label.word.test(value)).length;
  check(`the ${label.concept} label is present and says the word`, says > 0);
}

// ---------------------------------------------------------------------------
// Nothing was lost
// ---------------------------------------------------------------------------

check('the Indonesian table has as many keys as the English one', Object.keys(idFlat).length === Object.keys(enFlat).length);
check('the Japanese table has as many keys as the English one', Object.keys(jaFlat).length === Object.keys(enFlat).length);

// ---------------------------------------------------------------------------
// No unfinished English sentence is left in the Indonesian text
// ---------------------------------------------------------------------------

const ENGLISH_LEFT = [
  'Load More',
  'Load more',
  'Clear filter',
  'All Rights Reserved',
  'GPS Transaction',
  'Income Converter',
  'Total Expense',
  'Total Income',
  'Tap to search',
  'Coming soon',
];

const leftovers = [];
for (const [key, value] of Object.entries(idFlat)) {
  for (const phrase of ENGLISH_LEFT) {
    if (value.includes(phrase)) {
      leftovers.push(`${key}: ${JSON.stringify(value)}`);
      break;
    }
  }
}
check(
  'no unfinished English sentence is left in the Indonesian text',
  leftovers.length === 0,
  leftovers.length ? leftovers.join('\n      ') : ''
);

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

console.log('');
console.log(`terminology: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) {
    console.log('  FAIL ' + f);
  }
  process.exit(1);
}
