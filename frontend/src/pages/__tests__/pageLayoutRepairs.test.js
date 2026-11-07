/**
 * The pages that were read as broken.
 *
 * Six things were wrong, and each of them was a page telling the
 * reader something untrue about their own money, or refusing to draw
 * it at all.
 *
 * 1. The goal card on the dashboard and the goals page drew its icon
 *    on top of the text. The icon had no `shrink-0` and the text
 *    column had no `min-w-0`, so a long goal name pushed the picture
 *    over the words. The header of the card also drew the target icon
 *    twice: once as a picture and once as the word's own icon.
 *
 * 2. The settings page stacked the checklist and the navigation in
 *    one narrow column and left the rest of the screen empty, so the
 *    form the reader came for was below the fold.
 *
 * 3. The calculation card on the add page had its amounts in no
 *    particular column, so `Rp 0` and `-Rp 0` and `Total Akhir` did
 *    not line up.
 *
 * 4. The health coach's small cards cut the money off with an
 *    ellipsis: `Rp 5.765.000` became `Rp...`. Money that cannot be
 *    read is not money the reader can act on.
 *
 * 5. The shopping page's search drew one box with a made-up price
 *    and left three quarters of the row empty.
 *
 * 6. The map legend drew four pins outside the white card and the
 *    labels sat on top of the pictures.
 *
 * These checks are about the shape of those pages, so that a change
 * that undoes them is caught.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
};

console.log('the pages that were read as broken');

const dashboard = read('src/pages/Dashboard.jsx');
const goals = read('src/pages/Goals.jsx');
const settings = read('src/pages/Settings.jsx');
const addPage = read('src/components/layout/AddTransactionPage.jsx');
const bento = read('src/components/health/CuteWellnessBento.jsx');
const shopping = read('src/pages/ShoppingTracker.jsx');
const mapPage = read('src/pages/MerchantMap.jsx');

/* --- 1. the goal card --------------------------------------------------- */

check('the goal card icon cannot be pushed over the text', () => {
  // The icon holds its place and the text column is allowed to
  // shrink, so the picture never lands on the words.
  assert.ok(
    /shrink-0/.test(goals),
    'the goal icon has no shrink-0, so it is pushed over the text'
  );
  assert.ok(
    /min-w-0/.test(goals),
    'the text column has no min-w-0, so it cannot shrink out of the way'
  );
});

check('the goal card header draws the target icon once', () => {
  // A picture of a target, and then the word's own icon, is two
  // targets. Only one of them is wanted.
  const header = dashboard.slice(
    dashboard.indexOf("financial_goals") - 400,
    dashboard.indexOf("financial_goals") + 200
  );
  const pictures = (header.match(/<Target\b/g) || []).length;
  assert.ok(
    pictures <= 1,
    `the header draws the target icon ${pictures} times`
  );
});

/* --- 2. the settings page ------------------------------------------------ */

check('the settings navigation and the content are side by side', () => {
  assert.ok(
    /lg:grid-cols-\[260px_1fr\]/.test(settings) ||
      /lg:flex-row/.test(settings),
    'the settings page has no two-column layout'
  );
});

check('the readiness checklist is a banner that can be put away', () => {
  // The checklist is a welcome, not the page. It must not push the
  // form the reader came for below the fold, and the reader must be
  // able to put it away.
  assert.ok(
    /checklistDismissed/.test(settings),
    'the checklist cannot be put away'
  );
  assert.ok(
    /grid-cols-1 lg:grid-cols-\[260px_1fr\]/.test(settings),
    'the settings page is not two columns'
  );
});

/* --- 3. the calculation card --------------------------------------------- */

check('the calculation amounts share one column', () => {
  const editor = read('src/components/transactions/ItemizedBillEditor.jsx');
  assert.ok(
    /bill-calc-row/.test(editor),
    'the calculation rows are not laid out as a grid'
  );
  const css = read('src/styles/money.css');
  assert.ok(
    /\.bill-calc-row\s*\{[\s\S]*?grid-template-columns:\s*140px\s+minmax\(0,\s*1fr\)\s+110px/.test(css),
    'the calculation is not three zones'
  );
});

check('the tax pill does not wrap into two lines', () => {
  const editor = read('src/components/transactions/ItemizedBillEditor.jsx');
  assert.ok(
    /whitespace-nowrap/.test(editor),
    'the tax pill wraps'
  );
});

/* --- 4. the health coach -------------------------------------------------- */

check('the small money cards do not cut the money off', () => {
  assert.ok(
    !/text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums truncate/.test(bento),
    'the money is cut off with an ellipsis'
  );
  assert.ok(
    /break-words/.test(bento),
    'the money has nowhere to go when it is long'
  );
});

/* --- 5. the shopping page ------------------------------------------------ */

check('the shopping results are a grid of cards', () => {
  const grid = read('src/components/shopping/VisualProductCatalogGrid.jsx');
  assert.ok(
    /sm:grid-cols-2/.test(grid) && /lg:grid-cols-3/.test(grid),
    'the search results are not laid out as a grid of cards'
  );
});

/* --- 6. the map legend ---------------------------------------------------- */

check('the map legend holds its own pins', () => {
  assert.ok(
    /map-legend__pins/.test(mapPage),
    'the pins are not in a two-column grid'
  );
  const css = read('src/styles/money.css');
  assert.ok(
    /\.map-legend__pins\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(css),
    'the pin grid is not two columns that cannot overflow'
  );
  assert.ok(
    /\.map-legend\s*\{[\s\S]*?max-height:\s*260px/.test(css),
    'the legend has no maximum height'
  );
  assert.ok(
    /\.map-legend\s*\{[\s\S]*?overflow-y:\s*auto/.test(css),
    'the legend does not scroll'
  );
});

check('the shopping grid is three cards to a row', () => {
  const grid = read('src/components/shopping/VisualProductCatalogGrid.jsx');
  assert.ok(
    /grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/.test(grid),
    'the shopping grid is not one, two, three'
  );
});

check('the shopping search box is clear of the header', () => {
  assert.ok(
    /px-4 pt-4 mt-2/.test(shopping),
    'there is no room between the header and the search box'
  );
});

check('the shopping shops are chips and not rows', () => {
  // A row per shop took up the whole width of the page.
  assert.ok(
    /flex flex-wrap items-center gap-2/.test(shopping),
    'the marketplace links are not a row of chips'
  );
});

check('a transaction title cannot be drawn on top of the amount', () => {
  const transactions = read('src/pages/Transactions.jsx');
  assert.ok(
    /flex-1 min-w-0 pr-3/.test(transactions),
    'the text column is not allowed to shrink'
  );
  assert.ok(
    /flex items-center gap-2 min-w-0/.test(transactions),
    'the title row is not allowed to shrink'
  );
});

if (failed) {
  console.log(`\n${failed} failing, ${passed} passing`);
  process.exit(1);
}
console.log(`\nall ${passed} passing`);
