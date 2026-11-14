/**
 * The cute editorial round.
 *
 * Ten things were audited on the live site. This file holds the
 * checks for the ones that can be checked from the source, because a
 * screenshot of a rendering is not a test: it passes on the day it
 * was taken.
 *
 * The bugs were real and they were of several kinds:
 *
 *   - four white-on-cream rules in the login stylesheet, which made
 *     the headline and the rupiah figures invisible;
 *   - a rollover checkbox that could not be ticked, because the
 *     setter of a synced preference was handed an id instead of the
 *     whole value;
 *   - a smiley face where a command badge belonged;
 *   - a timeline connector floating above the dots instead of
 *     through them;
 *   - a mascot board that opened off the top of the screen and drew
 *     over a modal.
 *
 * Run with: node src/pages/__tests__/cuteEditorialRound.test.js
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..');
const ROOT = join(FRONTEND, '..');
const read = (p) => readFileSync(join(FRONTEND, p), 'utf8');
const readRoot = (p) => readFileSync(join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    failures.push(`${name}: ${err.message}`);
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
  }
};

const LOGIN = read('src/pages/Login.jsx');
const LOGIN_CSS = read('src/styles/login.css');
const REGISTER = read('src/pages/Register.jsx');
const BAR = read('src/components/ai/TopAiCommandBar.jsx');
const SHOWCASE = read('src/components/dashboard/FinancialProfileShowcase.jsx');
const PROFILE = read('src/utils/financialProfile.js');
const BUDGETS = read('src/pages/Budgets.jsx');
const PANEL = read('src/components/fintech/FlexBudgetPanel.jsx');
const BOARD = read('src/components/ui/KakeiboHoverBoard.jsx');
const MASCOT = read('src/components/mascot/ClampShoujoMascot.jsx');
const ART = read('src/components/mascot/shoujoArtLayers.jsx');
const APPEARANCE = read('src/utils/appearance.js');
const CUTE = read('src/styles/cute-editorial.css');
const MODAL = read('src/components/ui/Modal.jsx');

// ---------------------------------------------------------------------
// 1. The invisible text
// ---------------------------------------------------------------------

check('no rule on the login page paints white text on the cream canvas', () => {
  // Five rules were `color: #ffffff` on a #FAF9F6 page: the wordmark,
  // the headline, the preview headline, the big rupiah figure and the
  // two small ones. White on cream is not a low contrast - it is
  // invisible, and the reader was told the page said something it
  // did not.
  const blocks = LOGIN_CSS.split('}');
  for (const block of blocks) {
    if (!/color:\s*#ffffff/i.test(block)) continue;
    assert.fail(`a white text rule survives on the login page:\n${block.trim().slice(0, 200)}`);
  }
  // And the wordmark specifically, because "FinManager" being
  // invisible was the first thing noticed.
  assert.ok(/\.login-gateway__brand-name\s*\{[^}]*color:\s*#2C221E/.test(LOGIN_CSS), 'the wordmark');
  assert.ok(/\.login-gateway__big\s*\{[^}]*color:\s*#2C221E/.test(LOGIN_CSS), 'the big figure');
});

check('the headline and the money are deep espresso', () => {
  assert.ok(/\.login-gateway__title\s*\{[^}]*color:\s*#2C221E/.test(LOGIN_CSS), 'the headline');
  assert.ok(/\.login-gateway__preview-title\s*\{[^}]*color:\s*#2C221E/.test(LOGIN_CSS), 'the preview headline');
  assert.ok(/\.login-gateway__bar-amount\s*\{[^}]*color:\s*#2C221E/.test(LOGIN_CSS), 'the budget figures');
  assert.ok(/\.login-gateway__line-amount\s*\{[^}]*color:\s*#2C221E/.test(LOGIN_CSS), 'the split figures');
});

check('the register page has no pale type on the light canvas', () => {
  assert.ok(!/text-white mb-2/.test(REGISTER), 'the heading');
  assert.ok(!REGISTER.includes('text-primary-100'), 'the tagline');
  assert.ok(!REGISTER.includes('bg-white/20'), 'the badge');
});

// ---------------------------------------------------------------------
// 2. The command bar
// ---------------------------------------------------------------------

check('the smiley face is gone from the command bar', () => {
  assert.ok(!BAR.includes('FinBuddyMascot'), 'the face is not there any more');
  assert.ok(BAR.includes('text-[#D96B43]'), 'a warm sparkle badge instead');
});

check('the command pill follows the reader down the page', () => {
  assert.ok(BAR.includes('createPortal'), 'it is rendered through a portal');
  assert.ok(BAR.includes('document.body'), 'onto the body, where no ancestor can trap it');
  assert.ok(/fixed top-3 left-1\/2 -translate-x-1\/2 z-50/.test(BAR), 'pinned to the top centre');
  assert.ok(BAR.includes('data-testid="ai-command-portal-pill"'), 'and it can be found');
});

check('the pill hides itself when a dialog is open', () => {
  assert.ok(BAR.includes('modalOpen'), 'it knows about dialogs');
  assert.ok(BAR.includes('role="dialog"'), 'by looking for the role');
  assert.ok(/portalOpen && !modalOpen/.test(BAR), 'and it does not draw over one');
});

// ---------------------------------------------------------------------
// 3. The timeline
// ---------------------------------------------------------------------

check('the connector runs through the dots', () => {
  // It was at a fixed 52px, which was above every dot except
  // today's - and today's dot sat lower because the mascot was
  // above it. Every node now has the same empty slot above its dot.
  assert.ok(SHOWCASE.includes('top-[46px]'), 'the line is placed');
  assert.ok(SHOWCASE.includes('bg-[#EAE3D5]'), 'and it is a warm line, not a dark one');
  assert.ok(SHOWCASE.includes('h-8 w-full'), 'every node has the same slot above its dot');
  assert.ok(SHOWCASE.includes('h-8 items-end'), 'including today, which holds the mascot');
});

check('a date is shown once, not twice', () => {
  assert.ok(/seen\.has\(key\)/.test(PROFILE), 'the points are deduplicated by date');
  assert.ok(/points\.filter/.test(PROFILE), 'and the filter is applied');
});

// ---------------------------------------------------------------------
// 4. The rollover checkbox
// ---------------------------------------------------------------------

check('the rollover setter is given the whole value, not an id', () => {
  // The setter of a synced preference takes the whole new value. It
  // was being called with (id, checked), so the id - a string - was
  // written as the entire preference and every checkbox read as off.
  assert.ok(BUDGETS.includes('setCarryValue((previous) =>'), 'it merges into the map');
  assert.ok(/\[id\]: !!checked/.test(BUDGETS), 'for the one envelope');
  // The wrapper is what is handed over, and the raw setter is not.
  assert.ok(BUDGETS.includes('onCarryChange={setCarry}'), 'the wrapper is passed');
  assert.ok(!BUDGETS.includes('onCarryChange={setCarryValue}'), 'not the raw setter');
});

check('a ticked envelope is struck through and stamped', () => {
  assert.ok(PANEL.includes('is-carried'), 'the row knows');
  assert.ok(PANEL.includes('fintech-rollover__stamp'), 'and carries a stamp');
  assert.ok(PANEL.includes('envelope_rollover_done'), 'with a word on it');
  const css = read('src/styles/fintech.css');
  assert.ok(/is-carried[^{]*\{[^}]*line-through/.test(css), 'the strike');
  assert.ok(css.includes('fintech-rollover__stamp'), 'and the stamp is styled');
});

// ---------------------------------------------------------------------
// 5. The mascot, the board and the modal
// ---------------------------------------------------------------------

check('the board opens downwards when the anchor is near the top', () => {
  assert.ok(BOARD.includes('flipDown'), 'it knows');
  assert.ok(/anchorTop < VERTICAL_MARGIN/.test(BOARD), 'and measures');
  assert.ok(BOARD.includes('VERTICAL_MARGIN = 320'), 'with a generous margin');
  assert.ok(BOARD.includes("replace('bottom-full', 'top-full')"), 'and opens the other way');
});

check('the board is below a modal backdrop', () => {
  assert.ok(/kanahei-board absolute z-30/.test(BOARD), 'z-30, not z-40');
  assert.ok(MODAL.includes('z-50'), 'the backdrop is z-50');
  assert.ok(MODAL.includes('role="dialog"'), 'and it announces itself');
});

check('the companion closes its board when a dialog opens', () => {
  assert.ok(MASCOT.includes('aria-modal="true"'), 'it looks for a dialog');
  assert.ok(/setBoardOpen\(false\)/.test(MASCOT), 'and closes');
});

check('the companion is not perched over the card below it', () => {
  const botanical = read('src/components/ui/Botanical.jsx');
  assert.ok(botanical.includes('-top-12 right-3'), 'it sits further out and to the right');
});

// ---------------------------------------------------------------------
// 6. The stat cards and the accent themes
// ---------------------------------------------------------------------

check('the budget figures are cut-outs, not four coloured tiles', () => {
  assert.ok(!BUDGETS.includes('hue="sky"'), 'no sky tile');
  assert.ok(!BUDGETS.includes('hue="violet"'), 'no violet tile');
  assert.ok(BUDGETS.includes('cute-card--butter'), 'the paper is warm');
  assert.ok(BUDGETS.includes('font-extrabold tracking-tight'), 'and the numbers are heavy');
  assert.ok(BUDGETS.includes('budget-stat-${card.badge}'), 'each card is findable');
  for (const n of ["'01'", "'02'", "'03'", "'04'"]) {
    assert.ok(BUDGETS.includes(`badge: ${n}`), `the ${n} card`);
  }
});

check('the accent themes are no longer saturated', () => {
  // The rose peaked at #be123c and the header was a bar of red.
  // The old values are named in the comments that explain what
  // changed, so the search has to look at the values themselves and
  // not at the whole file.
  const shades = APPEARANCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!shades.includes('#be123c'), 'the crimson is gone');
  assert.ok(!shades.includes('#e11d48'), 'and the tailwind rose 600');
  assert.ok(!shades.includes('#7c3aed'), 'the violet 600');
  assert.ok(!shades.includes('#2563eb'), 'the blue 600');
  // The amber scheme was the forest with a lime, so two of the six
  // choices looked the same.
  assert.ok(!/amber:\s*\{[\s\S]{0,400}accent: '#2F4842'/.test(APPEARANCE), 'the amber is its own colour now');
  assert.ok(APPEARANCE.includes('accent: \'#A64A2E\''), 'sakura wood');
  assert.ok(APPEARANCE.includes('accent: \'#4A7260\''), 'matcha latte');
  assert.ok(APPEARANCE.includes('accent: \'#75649E\''), 'lavender milk');
  assert.ok(APPEARANCE.includes('accent: \'#9C7234\''), 'honey biscuit');
});

// ---------------------------------------------------------------------
// The chibi redraw
// ---------------------------------------------------------------------

check('the companion is drawn plump, not as a stick figure', () => {
  // The head was narrow with a pointed chin on a long body. It is
  // now a wide mochi head over a short bell.
  assert.ok(ART.includes('M 44 72'), 'the wide mochi head');
  assert.ok(ART.includes('C 155 100 138 124 100 124'), 'with a broad lower cheek');
  assert.ok(ART.includes('rx="12" ry="7" fill="#FF9E9E"'), 'and peach airbrush blush');
  assert.ok(MASCOT.includes('viewBox="0 0 200 220"'), 'the new box');
  // The body is short: the bell ends at 176, not at 192.
  assert.ok(ART.includes('L 137 176'), 'the short bell');
});

check('the eyes are huge, and scale with the anatomy', () => {
  assert.ok(ART.includes('leftCx: 74, rightCx: 126'), 'further apart');
  assert.ok(ART.includes('rx: 15, ry: 18'), 'and much bigger');
  assert.ok(ART.includes('const RX = ANATOMY.eyes.rx'), 'the eye reads its size from the anatomy');
});

check('the legs are stubby pegs, not strokes', () => {
  // Two vertical strokes with six pixels of width is what made it a
  // stick figure.
  assert.ok(ART.includes('rx="9" fill={p.skin}'), 'the legs are rounded');
  // No leg is drawn as a bare vertical stroke any more - not in the
  // shared body, not in the two older drawings.
  const legStrokes = ART.match(/<path d="M \d+ \d+ l 0 \d+"/g) || [];
  assert.equal(legStrokes.length, 0, `the old leg strokes are gone: ${legStrokes.join(' ')}`);
  assert.ok(ART.includes('#4A3540'), 'and the shoes are the lineart colour');
});

check('the companion is drawn at a size you can see', () => {
  assert.ok(MASCOT.includes('size = 120'), 'the default');
  const rigged = read('src/components/mascot/RiggedSvgMascot.jsx');
  assert.ok(rigged.includes('size = 120'), 'and the rigged one');
});

// ---------------------------------------------------------------------
// The editorial system
// ---------------------------------------------------------------------

check('the editorial stylesheet is imported once, globally', () => {
  const main = read('src/main.jsx');
  assert.ok(main.includes("import './styles/cute-editorial.css'"), 'it is loaded');
});

check('the four signature pieces exist', () => {
  assert.ok(CUTE.includes('.cute-canvas'), 'the desk and the dot grid');
  assert.ok(CUTE.includes('radial-gradient(#D8CFC2 1px, transparent 1px)'), 'the notebook rule');
  assert.ok(CUTE.includes('background-size: 20px 20px'), 'at twenty pixels');
  assert.ok(CUTE.includes('.cute-overline'), 'the pill overline');
  assert.ok(CUTE.includes('.cute-heading'), 'the heavy heading');
  assert.ok(CUTE.includes('.cute-card'), 'the cut-out card');
  assert.ok(CUTE.includes('box-shadow: 0 6px 0 #EAE0D5'), 'with a flat shadow under it');
  assert.ok(CUTE.includes('.cute-wave'), 'the wave');
});

check('the wave is a drawn component', () => {
  const wave = read('src/components/editorial/OrganicWaveDivider.jsx');
  assert.ok(wave.includes('<svg'), 'it is an svg');
  assert.ok(wave.includes('preserveAspectRatio="none"'), 'which stretches without distorting');
  assert.ok(LOGIN.includes('OrganicWaveDivider'), 'and the login page uses it');
  assert.ok(read('src/pages/Dashboard.jsx').includes('OrganicWaveDivider'), 'and so does the dashboard');
});

check('the scrapbook is three taped photographs', () => {
  const book = read('src/components/editorial/EditorialScrapbook.jsx');
  assert.ok(book.includes('snap-1'), 'the first');
  assert.ok(book.includes('snap-2'), 'the second');
  assert.ok(book.includes('snap-3'), 'the third');
  assert.ok(book.includes('-rotate-2'), 'each turned a little');
  assert.ok(book.includes('rotate-[1.5deg]'), 'each a different amount');
  assert.ok(book.includes('Snap #01'), 'with a handwritten caption');
  assert.ok(LOGIN.includes('EditorialScrapbook'), 'and the login page shows it');
});

check('the photographs are real files, bundled', () => {
  for (const name of ['snap-1', 'snap-2', 'snap-3']) {
    const file = join(FRONTEND, 'public/images/editorial', `${name}.jpg`);
    const bytes = readFileSync(file);
    assert.ok(bytes.length > 10000, `${name} is a real photograph, not a stub`);
    // A JPEG starts FFD8 and ends FFD9.
    assert.equal(bytes[0], 0xff, `${name} starts as a jpeg`);
    assert.equal(bytes[1], 0xd8, `${name} starts as a jpeg`);
    // And a copy sits beside the code, so it can be imported as a
    // module and hashed into dist/assets by the bundler.
    const beside = join(FRONTEND, 'src/assets/editorial', `${name}.jpg`);
    assert.ok(readFileSync(beside).length > 10000, `${name} is also in src/assets`);
  }
});

check('the photographs are imported, not addressed by a bare path', () => {
  const book = read('src/components/editorial/EditorialScrapbook.jsx');
  // A '/images/...' path depends on the server's root and on the
  // public folder being deployed. An import is hashed into
  // dist/assets/ with the code that uses it.
  assert.ok(book.includes("import snap1Url from '../../assets/editorial/snap-1.jpg'"), 'snap-1 is imported');
  assert.ok(book.includes("import snap2Url from '../../assets/editorial/snap-2.jpg'"), 'snap-2 is imported');
  assert.ok(book.includes("import snap3Url from '../../assets/editorial/snap-3.jpg'"), 'snap-3 is imported');
  assert.ok(!/src:\/\/images\/editorial/.test(book), 'no bare public path is left');
});

check('no page draws with the phone emoji font', () => {
  // An emoji is drawn by the phone's font: different on every
  // machine, blind to the colour scheme, and the signature of
  // generated filler. Every drawing on these pages comes from the
  // pixel icon family instead.
  const slop = /[\u{1F300}-\u{1FAFF}]|[\u2728\u26A1\u2615]/u;
  const watched = [
    'src/pages/Login.jsx',
    'src/components/layout/AddTransactionPage.jsx',
    'src/features/transactions/nlp/timeOfDayChips.js',
    'src/components/mascot/ClampShoujoMascot.jsx',
    'src/components/transactions/QuickPillRow.jsx',
    'src/data/categoryDictionary.js',
    'src/components/transactions/ItemizedBillEditor.jsx',
  ];
  for (const file of watched) {
    const text = read(file);
    const hit = text.match(slop);
    assert.ok(!hit, `${file} draws "${hit && hit[0]}" with the emoji font`);
  }
  // And the words on the page carry none either.
  for (const lang of ['id', 'en', 'ja']) {
    const words = read(`src/i18n/${lang}.js`);
    for (const key of ['chip_analyse', 'chip_snack', 'chip_record']) {
      const line = words.split('\n').find((l) => l.includes(`${key}:`)) || '';
      assert.ok(!slop.test(line), `${lang}.${key} still starts with an emoji`);
    }
  }
  const batch3 = read('src/i18n/keys_batch3.js');
  for (const line of batch3.split('\n')) {
    if (line.includes('guest_cta:')) {
      assert.ok(!/\u{1F680}/u.test(line), 'the guest button still carries the rocket');
    }
  }
});

check('the companion on the login page is a studio, not a popover', () => {
  // The old layout was a wide white box with the figure alone at
  // one side, and clicking it dropped a floating board over the
  // simulator cards below. The studio lays the conversation INSIDE
  // the card, beside the figure, so nothing floats and nothing is
  // covered.
  const login = read('src/pages/Login.jsx');
  assert.ok(login.includes('inline'), 'the login mascot is not inline');
  assert.ok(login.includes('md:grid-cols-12'), 'the studio card is not a 12-column grid');
  const mascot = read('src/components/mascot/ClampShoujoMascot.jsx');
  assert.ok(mascot.includes('shoujo-studio'), 'there is no studio layout');
  assert.ok(mascot.includes("data-testid=\"shoujo-studio\""), 'the studio cannot be found by tests');
  assert.ok(mascot.includes('md:col-span-7'), 'the conversation does not take the left seven columns');
  assert.ok(mascot.includes('md:col-span-5'), 'the stage does not take the right five columns');
});

check('the add page is a desk, not a narrow white column', () => {
  const addPage = read('src/components/layout/AddTransactionPage.jsx');
  // The desk: a 12-column bento, the ledger left, the bookkeeper
  // and the receipt pad right.
  assert.ok(addPage.includes('lg:grid-cols-12'), 'the page is still one column');
  assert.ok(addPage.includes('lg:col-span-7'), 'the ledger does not take the left seven columns');
  assert.ok(addPage.includes('lg:col-span-5'), 'the right column is missing');
  assert.ok(addPage.includes('kakeibo-desk'), 'the desk canvas is missing');
  assert.ok(addPage.includes('DESK_THEMES'), 'there are no desk papers to choose');
  assert.ok(addPage.includes('kakeibo-bookkeeper'), 'the bookkeeper is missing');
  // The neon red is gone.
  assert.ok(!addPage.includes('bg-red-500'), 'the expense tab still shouts in neon red');
  assert.ok(addPage.includes('#D96B43'), 'the terracotta is missing');
  // The pills wrap instead of scrolling sideways.
  const pills = read('src/components/transactions/QuickPillRow.jsx');
  assert.ok(!pills.includes('overflow-x-auto'), 'the pill rows still scroll sideways');
  assert.ok(pills.includes('flex-wrap'), 'the pill rows do not wrap');
});

check('a photograph that cannot be fetched falls back to a drawing', () => {
  const book = read('src/components/editorial/EditorialScrapbook.jsx');
  assert.ok(book.includes('onError'), 'the frame handles a failure');
  assert.ok(book.includes('editorialFallback'), 'by drawing one');
  const fb = read('src/components/editorial/editorialFallback.js');
  assert.ok(fb.includes('data:image/svg+xml'), 'as an inline svg, so it costs no request');
  assert.ok(fb.includes('export const editorialFallback'), 'and it is exported');
  // Three scenes, so the three frames do not all show the same
  // picture when they all fall back.
  assert.ok((fb.match(/`<rect/g) || []).length >= 3, 'there is a scene for each frame');
});

// ---------------------------------------------------------------------

console.log('');
if (failed === 0) {
  console.log(`cute editorial round: all ${passed} checks passed`);
} else {
  console.log(`cute editorial round: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
