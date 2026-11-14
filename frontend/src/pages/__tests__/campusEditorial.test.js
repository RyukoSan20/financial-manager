/**
 * The campus editorial guard.
 *
 * These are the things that were wrong on the live page and must not
 * come back:
 *
 *  - the wordmark and the headline rendered pale on a cream canvas,
 *    so there must be an explicit dark ink rule for both and no
 *    `text-white` anywhere near the hero;
 *  - the first screen was empty because the photographs were below
 *    the fold, so section one must carry an eagerly-loaded polaroid;
 *  - the page clipped its own animations on a phone, so the wrapper
 *    must use `overflow-x: clip` rather than `hidden`, and the cards
 *    that hold motion must be `overflow: visible`;
 *  - the popover left the screen on a narrow viewport, so there must
 *    be a viewport-safe clamp for it.
 *
 * It is plain node so it runs anywhere, with no test runner to set
 * up: `node src/pages/__tests__/campusEditorial.test.js`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const failures = [];
let checks = 0;

const check = (name, condition) => {
  checks += 1;
  if (!condition) failures.push(name);
};

/* --------------------------------------------------------------------------
   The page
   -------------------------------------------------------------------------- */

const login = read('pages/Login.jsx');

check('Login mounts the mini-games section', login.includes('<KakeiboMiniGamesSection'));
check('Login mounts the pill navbar', login.includes('<CampusPillNav'));
check('Login mounts the friend-snap lookbook', login.includes('<FriendSnapLookbook'));
check('Login mounts the guild parade', login.includes('<PetitGuildParade'));
check('Login mounts the greeter card', login.includes('<MascotGreeterCard'));
check('Login keeps the live simulators', login.includes('<LoginPreview'));

// The four sections the navbar links to must exist as anchors. Two
// live on the page, two inside the sections it mounts - what matters
// is that every link in the navbar lands on something.
const anchorSources =
  login +
  read('components/login/KakeiboMiniGamesSection.jsx') +
  read('components/login/FriendSnapSections.jsx');
['MiniGame', 'CeritaTeman', 'Simulator', 'Maskot'].forEach((id) => {
  check(`the #${id} anchor exists`, anchorSources.includes(`id="${id}"`));
});
// Every navbar link must point at one of those anchors.
const navIds = [...read('components/login/CampusPillNav.jsx').matchAll(/\{ id: '(\w+)'/g)].map((m) => m[1]);
check('every navbar link has a target', navIds.length === 4 && navIds.every((id) => anchorSources.includes(`id="${id}"`)));

// The dividers, one of each kind.
check('Login uses a wave divider', login.includes('direction="up"'));
check('Login uses a diagonal divider', login.includes('direction="diagonal"'));
check('Login uses a scalloped divider', login.includes('direction="scallop"'));

// The photograph above the fold is fetched immediately.
check('the hero polaroid is eager', /testId="hero-polaroid"/.test(login) && login.includes('loading="eager"'));

// The hero heading must never be white.
const heroBlock = login.slice(
  login.indexOf('data-testid="login-hero-title"') - 400,
  login.indexOf('data-testid="login-hero-title"') + 400
);
check('the hero title has no text-white', !/text-white/.test(heroBlock));
check('the hero title keeps the marker underline', heroBlock.includes('cute-underline'));

// The page wrapper carries the clip class.
check('the page wrapper is a campus-page', login.includes('className="login-gateway campus-page"'));

/* --------------------------------------------------------------------------
   The stylesheet
   -------------------------------------------------------------------------- */

const css = read('styles/campus-editorial.css');

check('the wordmark ink is forced dark', /\.login-gateway__brand-name[\s\S]{0,220}#2C221E !important/.test(css));
check('the headline ink is forced dark', /\.campus-heading__title[\s\S]{0,260}#2C221E !important/.test(css));
check('the marker underline is a gradient', css.includes('linear-gradient(transparent 62%, #F9C6B0 62%)'));
check('the marker text is matcha ink', css.includes('#1F3A2E !important'));

check('the wrapper clips rather than hides', /\.campus-page\s*\{[^}]*overflow-x:\s*clip/.test(css));
check('the wrapper never uses overflow-x hidden', !/\.campus-page\s*\{[^}]*overflow-x:\s*hidden/.test(css));

check('the mini-game cards are overflow visible', /\.minigame-card[\s\S]{0,200}overflow:\s*visible/.test(css));
check('the polaroids are overflow visible', /\.polaroid-snap/.test(css) && /overflow:\s*visible/.test(css));
check('phones get breathing room', /@media \(max-width: 639px\)[\s\S]{0,400}padding-top:\s*1\.5rem/.test(css));

// The popover clamp.
check('the popover is clamped to the viewport', css.includes('width: calc(100vw - 32px) !important'));
check('the popover is capped at 320px', css.includes('max-width: 320px !important'));
check('the popover is centred', css.includes('transform: translateX(-50%) !important'));

// The motion must be composited and must not be switched off by width.
['memphis-float', 'coin-drop-pop', 'coin-pop', 'petit-poyo-bounce', 'gacha-reveal'].forEach((cls) => {
  check(`.${cls} declares will-change`, new RegExp(`\\.${cls}[\\s\\S]{0,220}will-change:\\s*transform`).test(css));
});
check('the keyframes use translate3d', (css.match(/translate3d/g) || []).length >= 8);

// Motion stops ONLY for the reader's own preference, never for a
// narrow screen.
const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
check('reduced motion stops the campus animations', reducedBlock.includes('.petit-poyo-bounce'));
const widthKills = /@media \(max-width:[^)]*\)\s*\{[^}]*animation:\s*none/.test(css);
check('no width query kills the animations', !widthKills);

/* --------------------------------------------------------------------------
   The games
   -------------------------------------------------------------------------- */

const games = read('components/login/KakeiboMiniGamesSection.jsx');

check('the coin catcher exists', games.includes('data-testid="coin-catcher-game"'));
check('the gacha exists', games.includes('data-testid="gacha-game"'));
check('the round is 15 seconds', games.includes('ROUND_SECONDS = 15'));
check('there are six slots', games.includes('SLOT_COUNT = 6'));
check('the master target is 150k', games.includes('MASTER_TARGET = 150000'));
check('coins are worth 25k', games.includes('value: 25000'));
check('gems are worth 50k', games.includes('value: 50000'));
check('fake discounts cost 15k', games.includes('value: -15000'));
check('the bottle meter is drawn', games.includes('konpeito-bottle__fill'));
check('the master badge is gated on the score', games.includes('data-testid="coin-master-badge"'));
check('the one-click way in exists', games.includes('data-testid="coin-enter-dashboard"'));
check('every one of the six has a fortune', ['mone', 'kaneru', 'kogane', 'zenimaru', 'minori', 'koneko'].every((id) => games.includes(`${id}: {`)));
check('the games give touch feedback', games.includes('active:scale-95'));
check('the game timers are cleared', games.includes('clearInterval') && games.includes('clearTimeout'));

/* --------------------------------------------------------------------------
   The navbar and the kit
   -------------------------------------------------------------------------- */

const nav = read('components/login/CampusPillNav.jsx');
check('the navbar is sticky', nav.includes('sticky top-3'));
check('the navbar is a pill', nav.includes('rounded-full border-2 border-[#4A3540]'));
check('the navbar wordmark is dark ink', nav.includes('text-[#2C221E]'));
check('the navbar has the guest CTA', nav.includes('data-testid="campus-nav-guest"'));
check('the navbar CTA is terracotta', nav.includes('bg-[#D96B43]'));
check('the navbar links scroll on mobile', nav.includes('overflow-x-auto'));

const kit = read('components/login/CampusKit.jsx');
check('headings carry a capsule badge', kit.includes('shadow-[0_3px_0_#4A3540]'));
check('headings are extrabold dark ink', kit.includes('font-extrabold') && kit.includes('text-[#2C221E]'));
check('headings are wide tracked', /tracking-\[0\.0[46]em\]/.test(kit));
check('the polaroid falls back to an illustration', kit.includes('editorialFallback'));
check('the beads are decorative only', kit.includes('pointer-events-none') && kit.includes('aria-hidden="true"'));

/* --------------------------------------------------------------------------
   The chrome
   -------------------------------------------------------------------------- */

const bar = read('components/ai/TopAiCommandBar.jsx');
check('the command bar docks past 80px', bar.includes('y > 80'));
check('the command bar reads both scroll roots', bar.includes('document.scrollingElement'));
check('the docked pill is portalled to the body', bar.includes('createPortal'));
check('the docked pill is fixed top centre', bar.includes('fixed top-3 left-1/2 -translate-x-1/2'));
check('the smiley face is gone', !/<Smile[\s/>]/.test(bar));

check('the chrome uses the stationery surface', css.includes('#FFFDF9') && css.includes('#E5DAC9'));

/* --------------------------------------------------------------------------
   The verdict
   -------------------------------------------------------------------------- */

if (failures.length > 0) {
  console.error('campus editorial: FAILED');
  failures.forEach((name) => console.error(`  - ${name}`));
  process.exit(1);
}

console.log(`campus editorial: all ${checks} checks passed`);
