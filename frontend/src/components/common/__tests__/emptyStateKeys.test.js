/**
 * A key on the screen is a bug.
 *
 * When a page asks for a word that no language has, the translator
 * shows the last part of the key, so that "nav.map" reads as "Map"
 * rather than as a piece of machinery. That is a kindness, and it
 * hides the mistake.
 *
 * The kindness goes too far when the last part of the key is not a
 * word at all. "common.empty_hint" becomes "Empty hint" on the
 * screen, and the reader sees a label that says nothing.
 *
 * So the check here is not that every key exists - the audit script
 * does that, and it is in the preflight. The check is that the keys
 * the empty state falls back to are keys that exist, and that they
 * exist in every language.
 *
 * Run with: node src/components/common/__tests__/emptyStateKeys.test.js
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const component = read('src/components/common/HonestEmptyState.jsx');

/* --- the keys the component falls back to ------------------------------ */

// The keys are written out in the component. Every one of them must
// exist in every language, because a caller that does not name its
// own keys gets these.
const DEFAULT_BLOCK = component.match(
  /const DEFAULT_KEYS = \{([\s\S]*?)\};/
);
assert.ok(DEFAULT_BLOCK, 'the component names the keys it falls back to');

const defaultKeys = [...DEFAULT_BLOCK[1].matchAll(/'(\w[\w.]*)'/g)].map(
  (m) => m[1]
);

assert.ok(
  defaultKeys.length >= 5,
  `the component names at least five keys, found ${defaultKeys.length}`
);

/* --- every language holds them ---------------------------------------- */

// The locale files are read as modules, so that the key is looked up
// the same way the translator looks it up. Reading them as text and
// guessing at the nesting is how the mistake gets missed in the first
// place.
const lookup = (table, key) =>
  key.split('.').reduce((value, part) => {
    if (value && typeof value === 'object' && part in value) {
      return value[part];
    }
    return undefined;
  }, table);

for (const lang of ['id', 'en', 'ja']) {
  const locale = (await import(path.join(ROOT, `src/i18n/${lang}.js`))).default;
  for (const key of defaultKeys) {
    const value = lookup(locale, key);
    assert.strictEqual(
      typeof value,
      'string',
      `the ${lang} file has the key ${key}, so a raw key is never shown`
    );
    assert.ok(
      value.trim().length > 0,
      `the ${lang} file has words for ${key}, not an empty string`
    );
  }
}

/* --- a page that names its own words does not need the fallbacks ----- */

// The pages that use the empty state say what is missing and what
// would fill it. They pass the words, so the fallbacks are only used
// by a caller that forgets.
const pages = [
  'src/pages/Accounts.jsx',
  'src/pages/Recurring.jsx',
  'src/pages/Budgets.jsx',
  'src/pages/CategoryExpenses.jsx',
  'src/pages/SplitBill/SplitDashboardPage.jsx',
  'src/pages/Goals.jsx',
  'src/pages/Debts.jsx',
];

for (const page of pages) {
  const text = read(page);
  assert.ok(
    text.includes('HonestEmptyState'),
    `${page} uses the empty state`
  );
  // It must say what would fill the page. A page that shows nothing
  // but "there is nothing here" has told the reader nothing.
  assert.ok(
    /description=|descriptionKey=/.test(text),
    `${page} says what would fill the page`
  );
}

console.log(
  `empty state keys: ${defaultKeys.length} keys checked in 3 languages`
);
