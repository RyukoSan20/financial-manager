/**
 * Showing a thing that might be a word or might be a whole row.
 *
 * Run with: node src/utils/__tests__/textValue.test.js
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

import { textOf, iconOf } from '../textValue.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ---------------------------------------------------------------------------
// The row of the category, exactly as it comes out of the database
// ---------------------------------------------------------------------------

const THE_ROW = {
  color: 'bg-gray-100',
  parent_id: null,
  name_en: 'Food & Drink',
  name: 'Makanan & Minuman',
  name_ja: '食べ物',
  id: 7,
  system_key: 'food',
  sort_order: 1,
  type: 'expense',
  is_active: true,
  is_adjustment: false,
  description: null,
  user_id: null,
  icon: '🍔',
};

// ---------------------------------------------------------------------------
// A word
// ---------------------------------------------------------------------------

check('a word comes back as it is', textOf('Makanan & Minuman'), 'Makanan & Minuman');

// ---------------------------------------------------------------------------
// A row
// ---------------------------------------------------------------------------

check('the name comes out of a row', textOf(THE_ROW), 'Makanan & Minuman');
check('the icon comes out of a row', iconOf(THE_ROW), '🍔');

// ---------------------------------------------------------------------------
// Nothing at all
// ---------------------------------------------------------------------------

check('nothing is the fallback', textOf(null, '—'), '—');
check('nothing at all is the fallback', textOf(undefined, '—'), '—');
check('an empty word is the fallback', textOf('', '—'), '—');

// ---------------------------------------------------------------------------
// A row without a name in it
// ---------------------------------------------------------------------------

check('a row without a name is the fallback', textOf({ color: 'bg-gray-100' }, '—'), '—');
check('a row without an icon is the fallback', iconOf({ name: 'Makanan' }, '📁'), '📁');
check('a word has no icon of its own', iconOf('🍔'), '');

// ---------------------------------------------------------------------------
// A row that carries a label instead of a name
// ---------------------------------------------------------------------------

check('a label comes out of a row', textOf({ label: 'Warung Madura' }), 'Warung Madura');

// ---------------------------------------------------------------------------
// The promise this file makes
// ---------------------------------------------------------------------------

const ROWS = [
  null,
  undefined,
  '',
  'word',
  42,
  true,
  { name: 'Makanan' },
  { icon: '🍔' },
  { name: '', color: 'x' },
  { label: 'Label' },
];

for (const row of ROWS) {
  const given = textOf(row, '—');
  check(
    `a browser can show what comes out of ${JSON.stringify(row)}`,
    typeof given === 'string' && given.length > 0,
    true
  );
}

// ---------------------------------------------------------------------------

console.log(`textValue: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
