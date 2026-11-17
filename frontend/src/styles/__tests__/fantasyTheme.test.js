/**
 * The guild-hall theme guard.
 *
 * Locks the things the theme promises, so a later edit cannot quietly
 * bring back a white card, a green button, a raw emoji, or dark ink
 * on a dark panel.
 *
 *   node src/styles/__tests__/fantasyTheme.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.join(HERE, '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(FRONT, rel), 'utf8');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failures.push(name); console.log(`not ok - ${name}\n  ${err.message}`); }
};

const css = read('src/styles/fantasy-rpg.css');
const rule = (sel) => {
  const i = css.indexOf(sel);
  assert.ok(i >= 0, `no rule for ${sel}`);
  return css.slice(i, css.indexOf('\n}', i) + 2);
};

const PAGES = {
  'src/pages/HealthCoach.jsx': 'FantasyPage',
  'src/pages/MerchantManager.jsx': 'FantasyPage',
  'src/pages/CategoryExpenses.jsx': 'FantasyPage',
  'src/pages/Recurring.jsx': 'FantasyPage',
  'src/pages/Budgets.jsx': 'FantasyPage',
  'src/pages/ProfileSummary.jsx': 'FantasyPage',
};

check('the stylesheet is imported at the root, and after the page sheets', () => {
  assert.ok(/@import ['"]\.\/styles\/fantasy-rpg\.css['"]/.test(read('src/index.css')), 'not imported by index.css');
  const main = read('src/main.jsx');
  assert.ok(main.includes("./styles/fantasy-rpg.css"), 'not imported by main.jsx');
  assert.ok(main.indexOf('fantasy-rpg') > main.indexOf('botanical.css'), 'imported before the sheets it must beat');
});

check('.fantasy-card is the double gold frame with diamond ornaments', () => {
  const r = rule('.fantasy-card {');
  assert.ok(r.includes('#161b2e') && r.includes('#0b0e18'), 'no midnight gradient');
  assert.ok(/border:\s*2px solid #c5a059/.test(r), 'no gold border');
  assert.ok(/outline:\s*1px solid rgba\(197, 160, 89, 0\.5\)/.test(r) && r.includes('outline-offset: -6px'), 'no inner gold line');
  assert.ok(r.includes('0 10px 25px rgba(0, 0, 0, 0.7)') && r.includes('inset 0 0 20px rgba(197, 160, 89, 0.15)'), 'no glow');
  assert.ok(css.includes('.fantasy-card::before') && css.includes('.fantasy-card::after'), 'no ornaments');
  assert.ok(/content:\s*'\\2756'/.test(css), 'the ornament is not the diamond glyph');
});

check('.fantasy-btn is the metallic gold button', () => {
  const r = rule('.fantasy-btn {');
  assert.ok(r.includes('#d4af37') && r.includes('#aa771c'), 'no gold gradient');
  assert.ok(r.includes('#1a120b') && r.includes('letter-spacing: 0.05em') && /font-weight:\s*800/.test(r), 'text is not chiselled brown');
  assert.ok(/border:\s*2px solid #f3e9d2/.test(r), 'no cream border');
  assert.ok(rule('.fantasy-btn:active').includes('translateY(2px)'), 'no press shift');
});

check('.parchment-scroll is aged paper with a wood border and corner filigree', () => {
  const r = rule('.parchment-scroll {');
  assert.ok(r.includes('#f3e9d2') || r.includes('--fr-parch'), 'not parchment');
  assert.ok(/border:\s*3px solid var\(--fr-wood\)/.test(r) && css.includes('--fr-wood: #8b5a2b'), 'no wood border');
  assert.ok(r.includes('--fr-curl-tl') && r.includes('--fr-curl-br'), 'no corner filigree');
  assert.ok(css.includes('--fr-ink: #2c1d0c'), 'no ink colour');
});

check('every page of the overhaul is wrapped in the theme', () => {
  for (const [file, name] of Object.entries(PAGES)) {
    const src = read(file);
    assert.ok(src.includes(`<${name}`) && src.includes(`</${name}>`), `${file} is not wrapped`);
  }
  assert.ok(read('src/pages/HealthCoach.jsx').includes('<PlaqueTitle'), 'health coach has no plaque header');
});

check('the health score is Minori, the rigged portrait, and the red face is gone', () => {
  const studio = read('src/components/health/KakeiboWellnessStudio.jsx');
  assert.ok(studio.includes('<RiggedCharacterPuppet who="minori"'), 'Minori is not the rigged puppet');
  assert.ok(studio.includes('PUPPET_MOOD'), 'her mood does not follow the score');
  assert.ok(!/😢|😞|☹|🙁/.test(read('src/components/health/CuteWellnessBento.jsx')), 'a sad face is back');
});

check('the refresh button is the gold one, and has no raw emoji', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');
  assert.ok(/fantasy-btn fantasy-btn--glow/.test(bento), 'not a glowing fantasy button');
  for (const lang of ['id', 'en', 'ja']) {
    const m = read(`src/i18n/${lang}.js`).match(/refresh_data:\s*"([^"]*)"/);
    assert.ok(m && !/[\u{1F300}-\u{1FAFF}]/u.test(m[1]), `${lang} refresh label has an emoji`);
  }
});

check('empty states are a strongbox, drawn, with a real 8-bit gem', () => {
  const kit = read('src/components/ui/FantasyKit.jsx');
  assert.ok(kit.includes('tile_chest.png'), 'no chest');
  assert.ok(/koban-assets\/svg\/accessories\//.test(kit), 'the gem is not a real 8-bit SVG');
  assert.ok(fs.existsSync(path.join(FRONT, 'public/koban-assets/tiles/tile_chest.png')), 'chest tile missing');
  assert.ok(read('src/pages/MerchantManager.jsx').includes('<MerchantChest'), 'merchant has no chest');
  for (const f of ['CategoryExpenses', 'Recurring']) assert.ok(/\bchest\b/.test(read(`src/pages/${f}.jsx`)), `${f} empty state is not a chest`);
});

check('the profile is a guild adventurer card', () => {
  const src = read('src/pages/ProfileSummary.jsx');
  assert.ok(src.includes('adventurer-card') && src.includes('<FantasyCard'), 'no adventurer card');
  assert.ok(src.includes('guild-rank') && src.includes('guild-badge'), 'no status badges');
  assert.ok(src.includes('#c5a059'), 'the avatar has no gold ring');
});

check('buttons: no green or blue primary survives inside the scope', () => {
  const r = css.slice(css.indexOf('no plain green or blue button'));
  for (const c of ['.bg-primary-600', '.bg-emerald-600', '.bg-green-600', '.bg-success-600', '.bg-blue-600', '.hh-button']) {
    assert.ok(r.includes(c) || css.includes(`${c}:not(.hh-button-ghost)`), `${c} is not turned gold`);
  }
  assert.ok(css.includes('linear-gradient(180deg, #d4af37 0%, #aa771c 100%)'), 'no gold fill');
});

check('a dialog is parchment on a dark backdrop', () => {
  assert.ok(css.includes("[role='dialog'][role='dialog']"), 'no dialog rule that beats the card rule');
  assert.ok(css.includes('rgba(5, 7, 14, 0.82)'), 'the backdrop is not midnight');
  assert.ok(css.includes(":not([role='dialog'])"), 'the card rule can still catch a dialog');
});

check('every surface names its text colour as well as its background', () => {
  // The two halves of the text rule come from one list; this checks that
  // both exist and that a dark panel never gets ink and paper never gets cream.
  assert.ok(/\.fantasy-scope\.fantasy-scope :is\(\.text-gray-900[^)]*\) \{ color: var\(--fr-cream\) !important; \}/.test(css), 'no cream text on dark panels');
  assert.ok(css.includes('{ color: var(--fr-ink) !important; }'), 'no ink on paper');
  assert.ok(css.includes('.fantasy-plaque, .fantasy-scope.fantasy-scope .fantasy-plaque *'), 'plaque text is not locked to ink');
});

check('the motion stops for the reader who asks it to', () => {
  const tail = css.slice(css.indexOf('prefers-reduced-motion'));
  assert.ok(tail.includes('.fantasy-btn--glow') && tail.includes('animation: none'), 'the glow ignores reduced motion');
});

console.log(`\nfantasy theme: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
