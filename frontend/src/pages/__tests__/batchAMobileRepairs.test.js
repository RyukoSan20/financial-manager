/**
 * Batch A: the four mobile/structural repairs.
 *
 * Each of these was a layout that could not survive a 390px screen,
 * and each is checked here at the level of the component's source, in
 * the style the rest of this app's component tests use (no jsdom or
 * testing-library is wired in).
 *
 *   1. Transactions rows put the five action buttons on the same
 *      horizontal line as the title and the amount, so the title
 *      column was squeezed to nothing and "Makan Siang" truncated to
 *      "M." while "Manual" sat on top of "-Rp 25.000". The row is now
 *      two decks: info, then actions.
 *
 *   2. The thirty-day timeline positioned every node with
 *      `left: ${position}%`, so dates one day apart landed ~3% apart
 *      and piled up as "8 Nov111213Nov". It is now a flex stepper
 *      where each node holds at least 68px.
 *
 *   3. The Feed page used a cold Inbox glyph and a bulleted tips list,
 *      and its active filter pill was always gray because the colour
 *      helper was handed the id string and read `.color` off it.
 *
 *   4. The heatmap's selected-day box gave a total with no names.
 *
 * Run with: node src/pages/__tests__/batchAMobileRepairs.test.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
    console.log(`FAIL  ${name}`);
  }
};

console.log('batch A: the four mobile repairs');

// ---------------------------------------------------------------------
// 1. Transactions: two decks, so the title always has the full width
// ---------------------------------------------------------------------

const txs = read('src/pages/Transactions.jsx');

check(
  'the row is a two-deck column container',
  /className="flex flex-col gap-2 p-3\.5 sm:p-4/.test(txs)
);

check(
  'deck 1 holds the title and the money on a full-width row',
  /className="flex items-center justify-between gap-3 w-full"/.test(txs)
);

check(
  'the title gets its own min-w-0 flex-1 column so it can truncate honestly',
  /className="min-w-0 flex-1">\s*\n\s*<p className="font-semibold text-\[15px\]/.test(txs)
);

check(
  'the amount sits alone on the right of deck 1',
  /className="shrink-0 text-right pl-2"/.test(txs)
);

check(
  'the actions live on a deck of their own, under a divider',
  /data-testid=\{`tx-action-deck-\$\{tx\.id\}`\}/.test(txs) &&
    /justify-end gap-3 pt-2 border-t/.test(txs)
);

// The action buttons must come AFTER the amount block in the source,
// i.e. they are no longer siblings of the title inside one row.
const amountAt = txs.indexOf('shrink-0 text-right pl-2');
const deckAt = txs.indexOf('tx-action-deck-');
check(
  'the action deck is rendered after the amount, not beside the title',
  amountAt > 0 && deckAt > amountAt,
  `amount at ${amountAt}, action deck at ${deckAt}`
);

check(
  'the five-icon cluster no longer shares the amount row',
  !/text-right pl-2[\s\S]{0,400}<Edit2/.test(txs)
);

// ---------------------------------------------------------------------
// 2. The timeline: flex spacing, no percentage coordinates
// ---------------------------------------------------------------------

const showcase = read('src/components/dashboard/FinancialProfileShowcase.jsx');

check(
  'timeline nodes reserve at least 68px each and never shrink',
  /min-w-\[68px\] shrink-0/.test(showcase)
);

check(
  'the stepper is a flex row that scrolls instead of overlapping',
  /data-testid="timeline-stepper"/.test(showcase) &&
    /flex items-center justify-between gap-5 overflow-x-auto/.test(showcase)
);

check(
  'no node is positioned with a left percentage any more',
  !/left: `\$\{point\.position/.test(showcase) &&
    !/left: `\$\{todayPosition/.test(showcase),
  'a percentage `left` is what let two adjacent dates stack'
);

check(
  'today is a node in the sequence rather than an absolute overlay',
  /isToday/.test(showcase)
);

check(
  'the chapter tab bar uses the scrollbar-hiding class that actually exists',
  /pb-2 mb-4 -mx-1 px-1 no-scrollbar/.test(showcase) &&
    !/scrollbar-none/.test(showcase),
  'scrollbar-none was never defined in index.css or the tailwind config'
);

const css = read('src/index.css');
check(
  '.no-scrollbar really hides the bar in every engine',
  /\.no-scrollbar::-webkit-scrollbar\s*\{\s*display:\s*none/.test(css) &&
    /-ms-overflow-style:\s*none/.test(css) &&
    /scrollbar-width:\s*none/.test(css)
);

// ---------------------------------------------------------------------
// 3. The Feed page: mascot, sage pill, four numbered steps
// ---------------------------------------------------------------------

const feed = read('src/pages/Feed/FeedPage.jsx');

check(
  'the empty state greets the reader with the mascot',
  /<KanaheiStationeryMascot mood="happy"/.test(feed) &&
    /data-testid="feed-empty-mascot"/.test(feed)
);

check(
  'the mascot is actually imported',
  /import KanaheiStationeryMascot from '\.\.\/\.\.\/components\/mascot\/KanaheiStationeryMascot'/.test(feed)
);

check(
  'the cold Inbox glyph is gone from the empty state',
  !/<InboxIcon className="w-16 h-16/.test(feed)
);

check(
  'the empty state offers scanning a receipt, not only refreshing',
  /data-testid="feed-empty-scan-cta"/.test(feed)
);

check(
  'the active filter pill is the deep sage, not a slate gray',
  /bg-\[#2F4842\] text-\[#FAF9F6\] shadow-sm/.test(feed)
);

check(
  'the colour helper is handed the tab object, not the id string',
  /getTabColorClasses\(tab, isActive\)/.test(feed) &&
    /colors\[tab\?\.color\]/.test(feed),
  'colors[tabId.color] is undefined on a string, so every tab fell back to gray'
);

check(
  'the tips list became four numbered workflow cards',
  /data-testid="feed-workflow-cards"/.test(feed) &&
    /data-testid=\{`feed-step-\$\{step\.n\}`\}/.test(feed) &&
    ["'01'", "'02'", "'03'", "'04'"].every((n) => feed.includes(`n: ${n}`))
);

check(
  'the four stat cards carry their ordinals',
  /data-testid=\{`feed-stat-\$\{card\.n\}`\}/.test(feed) &&
    /\{card\.n\}/.test(feed)
);

check(
  'the plain bulleted tips are gone',
  !/t\('feed\.tip_filter'\)/.test(feed)
);

// The four step keys must exist in all three languages.
for (const lang of ['id', 'en', 'ja']) {
  const dict = read(`src/i18n/${lang}.js`);
  check(
    `${lang}: the four workflow steps and the scan CTA are translated`,
    ['workflow_title', 'step1_title', 'step1_body', 'step2_title', 'step3_title', 'step4_title', 'scan_or_import']
      .every((k) => new RegExp(`${k}:`).test(dict))
  );
  check(
    `${lang}: the heatmap's day detail strings are translated`,
    /see_in_transactions:/.test(dict) && /untitled:/.test(dict)
  );
}

// ---------------------------------------------------------------------
// 4. The heatmap: breathing room in the cell, names in the detail box
// ---------------------------------------------------------------------

const heatmap = read('src/components/analytics/SpendingHeatmapCalendar.jsx');

check(
  'the day cell has its own padding and a floor height',
  /min-h-\[54px\] rounded-xl p-1\.5 sm:p-2 flex flex-col justify-between/.test(heatmap)
);

check(
  'the amount label is held off the rounded bottom border',
  /text-\[10px\] font-bold leading-none pb-0\.5 truncate/.test(heatmap)
);

check(
  'the cell no longer uses the fixed height that clipped the label',
  !/h-14 sm:h-16/.test(heatmap)
);

check(
  'a tapped day lists the transactions that happened on it',
  /data-testid="heatmap-day-transactions"/.test(heatmap) &&
    /tx\.description \|\| tx\.category/.test(heatmap)
);

check(
  'each listed transaction carries its category badge and amount',
  /rounded bg-\[#F4F1EA\][^"]*text-\[10px\]/.test(heatmap) &&
    /rupiah\.format\(Math\.abs\(tx\.amount/.test(heatmap)
);

check(
  'the detail box links through to the transactions page for that date',
  /data-testid="heatmap-see-in-transactions"/.test(heatmap) &&
    /to=\{`\/transactions\?date=\$\{selected\}`\}/.test(heatmap)
);

// The server has to actually send the names for any of that to show.
const metrics = read('../backend/app/services/metrics.py');
check(
  'daily_spending returns the transactions per day, not only a total',
  /"transactions": by_day\.get\(/.test(metrics)
);

check(
  'the per-day transactions carry a description, a category and an amount',
  /"description": tx\.description or None/.test(metrics) &&
    /"category": getattr\(category, "name", None\)/.test(metrics) &&
    /"amount": float\(tx\.amount or 0\)/.test(metrics)
);

check(
  'Category is imported for that join',
  /from app\.models\.category import Category/.test(metrics)
);

// ---------------------------------------------------------------------
// 5. The cash flow chart: a scale that can hold zero and a negative
// ---------------------------------------------------------------------

const dash = read('src/pages/Dashboard.jsx');

check(
  'the price scale is normal, not logarithmic',
  /mode: 0,/.test(dash) && !/scaleMargins: \{ top: 0\.1, bottom: 0\.2 \},\s*\n\s*mode: 1,/.test(dash),
  'mode 1 is Logarithmic, which cannot plot zero or a negative net flow'
);

check(
  'the axis formatter scales off the magnitude and puts the sign back',
  /const sign = value < 0 \? '-' : '';/.test(dash) &&
    /const n = Math\.abs\(value\);/.test(dash)
);

check(
  'a negative thousand is no longer printed as a bare rupiah figure',
  /\$\{sign\}\$\{axisSymbol\} \$\{\(n \/ 1000\)\.toFixed\(0\)\}rb/.test(dash)
);

check(
  'the basic view plots income and expense beside the net',
  /incomeArea\.setData/.test(dash) && /expenseArea\.setData/.test(dash)
);

// ---------------------------------------------------------------------

console.log('');
if (failed === 0) {
  console.log(`all ${passed} checks passed`);
} else {
  console.log(`${passed} passed, ${failed} failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
