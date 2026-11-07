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

check('the health bento has no gap beside the ratios', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');

  // The score took three of the six columns and the ratios took two.
  // The audit then took the whole row, so the four columns beside the
  // ratios were left empty: a gap the size of half the screen.
  //
  // The findings card is now a third of a row and sits beside the
  // ratios, so the row is filled.
  const items = bento.match(/BentoItem span="[^"]+" order=\{\d+\}/g) || [];
  assert.ok(
    items.some((i) => /span="third"/.test(i)),
    'there is no third of a row beside the ratios'
  );

  // The findings are their own card, not folded into the audit.
  assert.ok(
    /key_findings|finding_title/.test(bento),
    'there is no findings card of its own'
  );
  assert.ok(
    !/span="full" order=\{5\}/.test(bento),
    'the findings still take the whole row, which leaves the gap'
  );
});

check('the calculation and the sharing can be put away', () => {
  const editor = read('src/components/transactions/ItemizedBillEditor.jsx');

  // The core fields - what was bought, which category, which account,
  // which day - have to be visible without scrolling past two panels
  // that are usually empty.
  assert.ok(
    /calcOpen|setCalcOpen/.test(editor),
    'the calculation cannot be put away'
  );
  assert.ok(
    /splitOpen|setSplitOpen/.test(editor),
    'the sharing cannot be put away'
  );
  assert.ok(
    /aria-expanded/.test(editor),
    'the reader cannot tell whether the panel is open'
  );
});

check('the shopping results carry the shop, the rating and both buttons', () => {
  const grid = read('src/components/shopping/VisualProductCatalogGrid.jsx');

  // Every card says which shop it is from.
  assert.ok(
    /merchant_source/.test(grid),
    'the card does not say which shop it is from'
  );
  // Every card says how the shop rated it.
  assert.ok(
    /rating/.test(grid) && /review_count/.test(grid),
    'the card does not carry the rating'
  );
  // Every card can be saved and every card can be opened.
  assert.ok(
    /save_to_wishlist/.test(grid),
    'the card cannot be saved'
  );
  assert.ok(
    /shopping_catalog.open/.test(grid),
    'the card cannot be opened in the shop'
  );
  // And the picture.
  assert.ok(
    /image_url/.test(grid),
    'the card has no picture'
  );
});

check('the health money amounts are never cut in half', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');

  // `break-words` cuts a word wherever it happens to run out of
  // room. On a money amount that means "Rp 5.975" on one line and
  // ".000" on the next, which reads as two numbers.
  //
  // The amount has to be allowed to be a little smaller rather than
  // be cut in two.
  assert.ok(
    /text-(sm|base).*font-bold/.test(bento),
    'the amount is not sized so that it fits'
  );
  assert.ok(
    !/tabular-nums break-words/.test(bento),
    'the amount is still cut wherever it runs out of room'
  );
  // The money card has to be wide enough for the amount at all.
  assert.ok(
    /BentoItem span="third" order=\{2\}/.test(bento),
    'the money card is only one column wide'
  );
});

check('the status labels on the ratios are not cut off', () => {
  // The pills that say "Perlu diperbaiki" and "Perlu dipertahankan"
  // were cut into "Per / dip" at the right edge, because the card was
  // too narrow for them and the text was not allowed to wrap.
  const pills = read('src/components/health/FinancialRatioPills.jsx');
  assert.ok(
    /break-words|leading-tight|flex-wrap/.test(pills),
    'the status labels cannot wrap, so they are cut in half'
  );
});

check('the dashboard goal card has a picture that fits the goal', () => {
  const dashboard = read('src/pages/Dashboard.jsx');

  // The goal on the dashboard was drawn without any picture at all,
  // while the one on the goals page had a picture that could be
  // pushed over the words. Both are the same card and must behave
  // the same way.
  assert.ok(
    /goalIcon/.test(dashboard),
    'the dashboard goal card does not choose a picture that fits the goal'
  );
  assert.ok(
    /shrink-0/.test(dashboard),
    'the picture on the dashboard goal card can be pushed over the words'
  );
  assert.ok(
    /min-w-0 flex-1/.test(dashboard),
    'the words on the dashboard goal card cannot shrink'
  );
});

check('the quick entry fills in what it was told', () => {
  const addPage = read('src/components/layout/AddTransactionPage.jsx');

  // "Kopi Jago 10rb" was read correctly - the amount was found and
  // the category was chosen - but the description was left empty, so
  // the transaction was saved with no name at all.
  assert.ok(
    /setDescription\(/.test(addPage),
    'the description is never filled in from what was typed'
  );
  // And it must not overwrite what the reader has already written.
  assert.ok(
    /!description/.test(addPage),
    'the quick entry would overwrite the description the reader wrote'
  );
});

check('the edit form carries everything the add form carries', () => {
  const form = read('src/components/transactions/TransactionEditForm.jsx');

  // The edit form was five fields: description, amount, date,
  // category, account. The location, the lines of the bill, the
  // calculation and the sharing were all missing, so a transaction
  // that was recorded with all of that could not be corrected with
  // any of it.
  assert.ok(
    /merchant_address/.test(form),
    'the edit form cannot change where the transaction was'
  );
  assert.ok(
    /breakdown/i.test(form),
    'the edit form cannot change the lines of the bill'
  );
  assert.ok(
    /discount/i.test(form) && /tax/i.test(form),
    'the edit form cannot change the calculation'
  );
  // And the sub-category.
  assert.ok(
    /subCategory|sub_categories/i.test(form),
    'the edit form cannot change the sub-category'
  );
});

check('the categories are a tree, not a flat list', () => {
  const addPage = read('src/components/layout/AddTransactionPage.jsx');

  // The category sheet was a long flat list. A reader who wants to
  // say "Kopi & Kafe" has nowhere to say it.
  assert.ok(
    /parent_id/.test(addPage),
    'the categories are not read as a tree'
  );
  assert.ok(
    /sub.?categor|subCategory|sub_category/i.test(addPage),
    'there is no way to choose a sub-category'
  );
  assert.ok(
    /create.*categor|new.*categor|custom.*categor/i.test(addPage),
    'there is no way to make a category of their own'
  );
});

check('the map counts every expense, not only the ones with a shop', () => {
  const analytics = read('../backend/app/api/routes/analytics.py');

  // Only the map itself is looked at. The list of merchants may
  // rightly ask for a merchant name - a merchant list without one is
  // a list of blanks - but the map is the picture of where the money
  // went, and it has to show all of it.
  const mapStart = analytics.indexOf('def get_merchant_map_data');
  const mapEnd = analytics.indexOf('\n@router.', mapStart + 10);
  const map = analytics.slice(mapStart, mapEnd === -1 ? undefined : mapEnd);

  assert.ok(mapStart !== -1, 'the map endpoint was not found');

  // The map asked only for the transactions that had a shop name.
  // A transaction recorded from the quick entry box has no shop
  // name, so it was left off the map entirely: the reader was shown
  // "0 Lokasi" for money they had spent.
  assert.ok(
    !/Transaction\.merchant_name\.isnot\(None\)/.test(map),
    'the map still drops the transactions that have no shop name'
  );
  assert.ok(
    /nullif\(Transaction\.description/.test(map),
    'the map does not look at the description of the transaction'
  );
});

check('the dashboard assistant is a bar at the top, not a box over the page', () => {
  // The assistant was a window in the bottom left of the screen. It
  // sat on top of the cards the reader came to read.
  //
  // It is now a bar at the top of the page: it never covers a card,
  // and it does three things at once - it takes a quick transaction,
  // it answers a question, and it can take the reader to a page.
  const bar = read('src/components/common/AICommandBar.jsx');

  assert.ok(bar, 'there is no command bar');
  assert.ok(
    /sticky/.test(bar),
    'the command bar is not stuck to the top of the page'
  );
  assert.ok(
    !/fixed/.test(bar),
    'the command bar is still a window that covers the page'
  );
  // The three jobs.
  assert.ok(
    /transactions\.create|quickEntry|parseQuickEntry|ai\.agent/.test(bar),
    'the command bar cannot record a transaction'
  );
  assert.ok(
    /ai\.agent/.test(bar),
    'the command bar cannot answer a question'
  );
  assert.ok(
    /navigate\(|window\.location/.test(bar),
    'the command bar cannot take the reader to a page'
  );
  // The mascot in the corner.
  assert.ok(
    /FinBuddyMascot/.test(bar),
    'the command bar has no mascot in its corner'
  );
});

check('the dashboard does not draw the floating assistant', () => {
  const dashboard = read('src/pages/Dashboard.jsx');
  assert.ok(
    !/<AIAssistant/.test(dashboard),
    'the floating assistant is still drawn over the dashboard'
  );
  assert.ok(
    /AICommandBar/.test(dashboard),
    'the command bar is not on the dashboard'
  );
});
