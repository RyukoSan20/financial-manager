/**
 * The motion, where it is used.
 *
 * The components existed; what was missing was the pages that use
 * them. A component that nothing draws is a component that is never
 * exercised, and the reader never sees the number roll or the bar
 * move.
 *
 * These checks read the source of the pages and hold that the motion
 * is really there: the score counts up, the bars fill, the calendar
 * of spending is on the dashboard, and the export can be reached from
 * the list of transactions rather than only from the settings.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
  }
};

const ANALYTICS = read('frontend/src/pages/Analytics.jsx');
const BUDGETS = read('frontend/src/pages/Budgets.jsx');
const DASHBOARD = read('frontend/src/pages/Dashboard.jsx');
const HEALTH = read('frontend/src/components/health/CuteWellnessBento.jsx');
const TRANSACTIONS = read('frontend/src/pages/Transactions.jsx');

// ---------------------------------------------------------------------------
// The score
// ---------------------------------------------------------------------------

check('the analytics score counts up instead of appearing all at once', () => {
  assert.ok(ANALYTICS.includes('CountUpNumber'), 'the number is imported');
  assert.ok(
    /<CountUpNumber value=\{healthScore\}/.test(ANALYTICS),
    'the score is the number that rolls'
  );
  // The old line, which printed the score as text.
  assert.ok(
    !/\{healthScore\}\/100<\/p>/.test(ANALYTICS),
    'the score is not written out as plain text any more'
  );
});

check('the four parts of the score each have a bar of their own', () => {
  const block = ANALYTICS.slice(ANALYTICS.indexOf('Object.entries(healthBreakdown)'));
  assert.ok(block.includes('AnimatedProgressBar'), 'the bars are there');
  assert.ok(
    /percent=\{\(Number\(value\.score\) \|\| 0\) \/ \(Number\(value\.max\) \|\| 25\) \* 100\}/.test(block),
    'the bar is the part out of its own maximum'
  );
  // A part that cannot be measured shows no number and no bar.
  const measurable = block.slice(0, block.indexOf('AnimatedProgressBar'));
  assert.ok(measurable.includes('value.measurable === false'), 'the empty case is handled');
});

check('the health coach score counts up too', () => {
  assert.ok(HEALTH.includes('CountUpNumber'), 'the number is imported');
  assert.ok(
    /<CountUpNumber value=\{numericScore\}/.test(HEALTH),
    'the score is the number that rolls'
  );
});

check('the health bar fills, and the liquid layer is still there for the reader who asked for it', () => {
  assert.ok(HEALTH.includes('AnimatedProgressBar'));
  assert.ok(HEALTH.includes('moneyLayerOn()'), 'the switch decides');
  assert.ok(HEALTH.includes('FluidProgressBar'), 'the liquid is still there');
  // The block that draws the score's bar.
  const bar = HEALTH.slice(HEALTH.indexOf('The score as a liquid'));
  assert.ok(bar.includes('moneyLayerOn()'), 'the switch decides');
  assert.ok(bar.indexOf('FluidProgressBar') < bar.indexOf('AnimatedProgressBar'), 'the liquid comes first');
  assert.ok(bar.includes(': (') && bar.includes('AnimatedProgressBar'), 'and the plain bar is the other way');
});

check('the score bar is not judged as a limit', () => {
  // A score of a hundred is good news, not a warning. The bar must
  // not turn coral because the reader has done well.
  assert.ok(/<AnimatedProgressBar percent=\{numericScore\} over=\{false\} \/>/.test(HEALTH));
  assert.ok(/<AnimatedProgressBar\s*\n\s*percent=\{\(Number\(value\.score\)[\s\S]{0,120}over=\{false\}/.test(ANALYTICS));
});

// ---------------------------------------------------------------------------
// The bars
// ---------------------------------------------------------------------------

check('a budget bar fills from nothing and carries the tick for today', () => {
  assert.ok(BUDGETS.includes('AnimatedProgressBar'), 'the bar is there');
  assert.ok(BUDGETS.includes('const currentDay = today.getDate();'), 'the day is worked out');
  assert.ok(BUDGETS.includes('const daysInMonth ='), 'and the length of the month');
});

check('both bars carry the tick, whichever the reader has chosen', () => {
  // The money layer is on in the production build, so the branch the
  // reader sees is the liquid one. A tick that only existed in the
  // other branch would never be seen.
  const liquid = BUDGETS.slice(BUDGETS.indexOf('moneyLayerOn() ? ('));
  const plain = BUDGETS.slice(BUDGETS.indexOf('AnimatedProgressBar'));
  assert.ok(liquid.includes('day={currentDay}'), 'the liquid bar has the day');
  assert.ok(liquid.includes('totalDays={daysInMonth}'), 'and the length of the month');
  assert.ok(plain.includes('day={currentDay}'), 'so does the plain bar');
  assert.ok(plain.includes('totalDays={daysInMonth}'), 'and its length of the month');
});

check('the liquid bar draws the tick itself', () => {
  const source = read('frontend/src/components/ui/FluidProgressBar.jsx');
  assert.ok(source.includes('data-testid="pacing-marker"'), 'the tick is drawn');
  assert.ok(source.includes('day,'), 'the day is taken');
  assert.ok(source.includes('totalDays,'), 'and the length of the month');
  assert.ok(source.includes('pacingPercent'), 'and the place is worked out');
});

check('the budget amounts count up', () => {
  assert.ok(BUDGETS.includes('CountUpNumber'));
  assert.ok(
    /<CountUpNumber value=\{Number\(budget\.spent\) \|\| 0\}/.test(BUDGETS),
    'what has been spent rolls'
  );
  assert.ok(
    /<CountUpNumber value=\{remaining\}/.test(BUDGETS),
    'and what is left'
  );
});

check('a goal bar on the dashboard fills too', () => {
  assert.ok(DASHBOARD.includes('AnimatedProgressBar'), 'the bar is there');
  assert.ok(DASHBOARD.includes('percent={progress}'), 'it is the goal\'s own progress');
  assert.ok(DASHBOARD.includes('over={false}'), 'a target is not a limit');
  assert.ok(DASHBOARD.includes('CountUpNumber'), 'the amount rolls');
  // The old plain div bar is gone.
  assert.ok(
    !/className="h-2 rounded-full bg-primary-500 transition-\[width\]"/.test(DASHBOARD),
    'the bar that slid as a block is not there any more'
  );
});

// ---------------------------------------------------------------------------
// The calendar of spending
// ---------------------------------------------------------------------------

check('the dashboard asks for the days of spending', () => {
  assert.ok(DASHBOARD.includes("api.get('/analytics/spending/daily')"), 'it asks the server');
  assert.ok(DASHBOARD.includes('setDailySpending('), 'and keeps the answer');
});

check('the dashboard shows the calendar of spending', () => {
  assert.ok(DASHBOARD.includes('SpendingHeatmapCalendar'), 'the calendar is drawn');
  assert.ok(
    /dailySpending\?\.days\?\.length/.test(DASHBOARD),
    'and only when there is something to show'
  );
  assert.ok(DASHBOARD.includes('<SpendingHeatmapCalendar days={dailySpending.days}'), 'the days are given');
});

check('the calendar is asked for on its own, not as part of a summary', () => {
  // It has to be its own request: a monthly total cannot say which
  // day was the worst one.
  assert.ok(!/dailySpending/.test(DASHBOARD.slice(DASHBOARD.indexOf('api.dashboard.summary'), DASHBOARD.indexOf('api.dashboard.summary') + 300)));
});

// ---------------------------------------------------------------------------
// The export
// ---------------------------------------------------------------------------

check('the export can be opened from the list of transactions', () => {
  assert.ok(TRANSACTIONS.includes('DataExportStudio'), 'the studio is imported');
  assert.ok(TRANSACTIONS.includes('const [showExport, setShowExport] = useState(false)'), 'it opens');
  assert.ok(/onClick=\{\(\) => setShowExport\(true\)\}/.test(TRANSACTIONS), 'there is a button');
  assert.ok(TRANSACTIONS.includes('aria-label={t(\'export.studio_open\')}'), 'the button says what it does');
  assert.ok(TRANSACTIONS.includes('{showExport ? ('), 'and the studio is drawn');
  assert.ok(TRANSACTIONS.includes('onClose={() => setShowExport(false)}'), 'and it closes');
});

check('the export opens over the list and leaves it as it was', () => {
  const block = TRANSACTIONS.slice(TRANSACTIONS.indexOf('{showExport ? ('));
  assert.ok(block.includes('fixed inset-0'), 'it covers the page');
  assert.ok(block.includes('onClick={() => setShowExport(false)}'), 'the cover closes it');
});

check('the studio asks the one api module, not the server itself', () => {
  assert.ok(!/\bfetch\(/.test(TRANSACTIONS), 'no fetch');
  assert.ok(TRANSACTIONS.includes('from \'../services/api\''), 'the api module is imported');
});

// ---------------------------------------------------------------------------
// The count
// ---------------------------------------------------------------------------

check('a number that appears for the first time counts up from nothing', () => {
  // Without a starting point the count begins at the number itself,
  // so it simply appears - and the reader sees nothing move.
  const source = read('frontend/src/components/ui/CountUpNumber.jsx');
  assert.ok(source.includes('from,'), 'the starting point can be given');
  assert.ok(source.includes('const start = Number.isFinite(Number(from)) ? Number(from) : target;'), 'and it is read');
  assert.ok(source.includes('useState(finite ? start : 0)'), 'the number starts there');
  assert.ok(source.includes('from === target ||'), 'and a number that has not moved is not counted');

  for (const [file, needle] of [
    ['frontend/src/components/health/CuteWellnessBento.jsx', '<CountUpNumber value={numericScore} from={0}'],
    ['frontend/src/pages/Analytics.jsx', '<CountUpNumber value={healthScore} from={0}'],
    ['frontend/src/pages/Budgets.jsx', '<CountUpNumber value={Number(budget.spent) || 0} from={0}'],
  ]) {
    assert.ok(read(file).includes(needle), `${file} counts from nothing`);
  }
});

// ---------------------------------------------------------------------------
// The query
// ---------------------------------------------------------------------------

check('the dates are added to a path that already has a query', () => {
  // "top-expenses?limit=8" plus the dates was "limit=8?start_date=...",
  // and the server answered 422 and the card showed nothing.
  assert.ok(ANALYTICS.includes("path.includes('?') ? '&' : '?'"), 'the second separator is an ampersand');
  assert.ok(
    !/return api\.request\(`\$\{path\}\$\{search \? `\?\$\{search\}` : ''\}`\);/.test(ANALYTICS),
    'the old form is gone'
  );
  assert.ok(ANALYTICS.includes("withDates('/analytics/top-expenses?limit=8')"), 'the path that carries a query is still used');
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

const i18n = ['id', 'en', 'ja'].map((lang) => ({
  lang,
  source: read(`frontend/src/i18n/${lang}.js`),
}));

check('the two new words are in all three languages', () => {
  for (const { lang, source } of i18n) {
    const block = source.slice(source.indexOf('\n  export: {'));
    assert.ok(block.includes('studio_title:'), `${lang} has the title`);
    assert.ok(block.includes('studio_open:'), `${lang} has the button`);
  }
});

check('the three languages say the same thing in their own way', () => {
  const words = i18n.map(({ source }) => {
    const block = source.slice(source.indexOf('\n  export: {'));
    const title = /studio_title: "([^"]*)"/.exec(block)?.[1];
    const open = /studio_open: "([^"]*)"/.exec(block)?.[1];
    return { title, open };
  });
  for (const word of words) {
    assert.ok(word.title && word.title.trim(), 'the title is there');
    assert.ok(word.open && word.open.trim(), 'the button is there');
  }
  assert.equal(new Set(words.map((w) => w.title)).size, 3, 'each language says it its own way');
});

check('the budget page has its over-limit words too', () => {
  for (const { lang, source } of i18n) {
    const block = source.slice(source.indexOf('\n  budgets: {'));
    assert.ok(block.includes('over_limit:'), `${lang} has it`);
    assert.ok(/over_limit: "[^"]*\{amount\}[^"]*"/.test(block), `${lang} says how much`);
  }
});

// ---------------------------------------------------------------------------

console.log('');
console.log(`motion in place: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
