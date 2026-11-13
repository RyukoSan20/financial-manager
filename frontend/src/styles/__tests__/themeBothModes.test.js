/**
 * Both halves of the theme have to be defined.
 *
 * A contrast sweep of the live site found 36 failures in the dark mode
 * and 13 in the light one, and almost all of them came from three
 * mistakes that look nothing like each other on the page but are the
 * same mistake underneath: a value that exists for one mode only.
 *
 * 1. A CSS custom property used with a light fallback and never
 *    defined. `fintech.css` asks for `var(--bg-card, #ffffff)` in five
 *    places; nothing defined `--bg-card`, so those panels were hard
 *    white on a dark page with near-white text on top - "Arus kas"
 *    measured 1.16:1.
 *
 * 2. A whole stylesheet written for the light page. `fintech.css` had
 *    no dark rules at all, and its accents (#047857, #AD4530) are deep
 *    colours chosen to read on white.
 *
 * 3. The palette written into the markup as arbitrary Tailwind values
 *    (`text-[#2D312E]`, `text-[#5C6460]`) with no `dark:` partner. The
 *    dashboard's own summary figures read 1.25:1.
 *
 * These checks are at the level of the stylesheets, because that is
 * where the rule lives: every token has both halves, every sheet that
 * paints a surface has a dark branch, and every hardcoded light
 * colour has somewhere to go in the dark.
 *
 * Run with: node src/styles/__tests__/themeBothModes.test.js
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
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push(`${name}: ${err.message.split('\n')[0]}`);
    console.log(`FAIL  ${name}`);
  }
};

const INDEX = read('src/index.css');
const FINTECH = read('src/styles/fintech.css');
const MASCOT = read('src/styles/mascot-motion.css');

console.log('the theme is defined in both modes');

/* --- 1. every token used with a fallback is actually defined --------- */

check('every --token used in a stylesheet is defined somewhere', () => {
  const sheets = ['src/index.css', 'src/styles/fintech.css', 'src/styles/mascot-motion.css',
                  'src/styles/botanical.css', 'src/styles/motion-system.css'];
  // Comments are stripped: a token named in prose is not a token used.
  const all = sheets.map(read).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

  const used = new Set([...all.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const defined = new Set([...all.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

  // Tokens a component writes as an inline style, and Tailwind's own
  // internals, are legitimately absent from the sheets.
  const componentSources = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); continue; }
      if (/\.jsx?$/.test(e.name)) componentSources.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(path.join(ROOT, 'src'));
  const fromJs = new Set(
    [...componentSources.join('\n').matchAll(/['"`](--[a-z0-9-]+)['"`]/g)].map((m) => m[1])
  );

  const orphans = [...used]
    .filter((t) => !t.startsWith('--tw-'))
    .filter((t) => !defined.has(t) && !fromJs.has(t));
  assert.deepEqual(
    orphans,
    [],
    `a token used with a fallback but never defined silently keeps the fallback: ${orphans.join(', ')}`
  );
});

check('--bg-card is defined for both modes, not left to a white fallback', () => {
  assert.ok(/html\.dark\s*\{[^}]*--bg-card:/s.test(INDEX), 'the dark mode defines --bg-card');
  assert.ok(/html:not\(\.dark\)\s*\{[^}]*--bg-card:/s.test(INDEX), 'the light mode defines it too');
});

check('the surface tokens come in matched pairs', () => {
  // The two token blocks, matched exactly. A loose indexOf would also
  // catch `html.dark :where(...) {` and stop at the first closing
  // brace rather than the block's own.
  // There is more than one `html.dark { }` block in the sheet, so the
  // right one is the block that actually declares --surface.
  const blockOf = (selector) => {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc + '\\s*\\{([^}]*?--surface:[^}]*)\\}');
    const m = INDEX.match(re);
    assert.ok(m, `the ${selector} token block exists`);
    return new Set([...m[1].matchAll(/(--[a-z-]+)\s*:/g)].map((x) => x[1]));
  };
  const d = blockOf('html.dark');
  const l = blockOf('html:not(.dark)');
  const onlyDark = [...d].filter((x) => !l.has(x));
  const onlyLight = [...l].filter((x) => !d.has(x));
  assert.deepEqual(onlyDark, [], `defined only in dark: ${onlyDark.join(', ')}`);
  assert.deepEqual(onlyLight, [], `defined only in light: ${onlyLight.join(', ')}`);
});

/* --- 2. a sheet that paints surfaces needs a dark branch ------------- */

check('fintech.css has a dark branch covering the surfaces that failed', () => {
  assert.ok(
    /html\.dark/.test(FINTECH),
    'a sheet that paints cards must say what they look like on a dark page'
  );
  // Named individually, because these are the exact classes a live
  // contrast sweep found unreadable on a dark page. A dark branch that
  // no longer covers one of them is the regression.
  for (const cls of [
    'fintech-chip--ok',
    'fintech-chip--review',
    'fintech-trust__label',
    'fintech-method__summary',
    'fintech-panel__tab.is-active',
    'recon__apply',
  ]) {
    const re = new RegExp('html\\.dark :where\\(\\.' + cls.replace('.', '\\.') + '\\)');
    assert.ok(re.test(FINTECH), `${cls} has a dark-mode rule`);
  }
});

check('the fintech accents are given a light step for the dark mode', () => {
  const dark = FINTECH.slice(FINTECH.indexOf('html.dark'));
  // The deep accents of the light mode must not be the dark-mode value.
  assert.ok(!/html\.dark[^{]*\{[^}]*#047857/s.test(dark), 'the deep emerald is not reused on a dark page');
  assert.ok(/#6EE7B7/.test(dark), 'there is a light emerald step for the dark mode');
  assert.ok(/#F2B8A2/.test(dark), 'and a light terracotta');
});

check('the blanket fintech rules use :where() so components keep their own choice', () => {
  // Every individual selector, not just the first of each comma-separated
  // group - an unwrapped one on a continuation line is the easy miss.
  const clean = FINTECH.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  for (const m of clean.matchAll(/([^{}]+)\{/g)) {
    for (const sel of m[1].split(',')) {
      const s = sel.trim();
      if (s.startsWith('html.dark')) selectors.push(s);
    }
  }
  assert.ok(selectors.length >= 5, `there are dark rules, found ${selectors.length}`);
  const unwrapped = selectors.filter((sel) => !sel.includes(':where('));
  assert.deepEqual(
    unwrapped,
    [],
    `a blanket rule must not outrank a component's own dark: variant: ${unwrapped.join(' | ')}`
  );
});

/* --- 3. the hardcoded palette has a dark destination ---------------- */

check('every hardcoded light ink colour has a dark-mode rule', () => {
  // The Kakeibo inks that are written into the markup as arbitrary
  // values. Each needs either a dark: partner in the markup or a
  // mapping in the stylesheet.
  for (const hex of ['2D312E', '5C6460', '2F4842', '1F2421']) {
    // In the stylesheet the class is written `.text-\[\#2D312E\]`,
    // so in a JS string each backslash is doubled once, not twice.
    const escaped = '.text-\\[\\#' + hex + '\\]';
    assert.ok(
      INDEX.includes(escaped),
      `#${hex} is mapped for the dark mode (looked for ${escaped})`
    );
  }
});

check('the dark mappings are wrapped in :where()', () => {
  const lines = INDEX.split('\n').filter((l) => /html\.dark :where\(\.text-\\\[/.test(l));
  assert.ok(lines.length >= 4, `the ink mappings are present, found ${lines.length}`);
});

check('the muted scales have a floor in both modes', () => {
  // The light floors are :where()-wrapped, because nothing competes
  // with them. The dark ones are NOT, deliberately: the components
  // write `text-slate-400 dark:text-slate-500` themselves, so the
  // failing colour IS the component's own variant and a zero-weight
  // rule would lose to it and change nothing on the page.
  assert.ok(/html:not\(\.dark\) :where\(\.text-slate-400\)/.test(INDEX), 'light floor for slate-400');
  assert.ok(/html\.dark \.text-slate-400\s*\{/.test(INDEX), 'dark floor for slate-400 at matching weight');
  assert.ok(/html\.dark \.text-slate-500\s*\{/.test(INDEX), 'dark floor for slate-500 at matching weight');
  assert.ok(/html\.dark \.text-gray-500\s*\{/.test(INDEX), 'dark floor for gray-500 at matching weight');
});

check('a wash and its ink move together between the modes', () => {
  // Lifting the ink of a pale badge without darkening the wash turns
  // a dark-on-light badge into light-on-light. The "0/7" chip went
  // from 1.35:1 to 1.57:1 that way - worse than before the fix.
  const inkLifted = /html\.dark :where\(\.text-\[#1B3B32\]\)/.test(
    INDEX.replace(/\\/g, '')
  );
  const washDarkened = /html\.dark :where\(\.bg-\[#D8F3DC\]\)/.test(
    INDEX.replace(/\\/g, '')
  );
  assert.ok(
    inkLifted === washDarkened,
    'the #1B3B32 ink and the #D8F3DC wash must both be remapped, or neither'
  );
});

/* --- 4. the household tokens exist outside their own canvas ---------- */

check('the hh tokens are defined on the root, not only inside .hh-canvas', () => {
  // `.hh-badge` is used on the dashboard and the transactions page,
  // where there is no .hh-canvas ancestor to define the tokens.
  assert.ok(/:root\s*\{[^}]*--hh-lime:/s.test(MASCOT), '--hh-lime has a root value');
  assert.ok(/\.dark\s*\{[^}]*--hh-lime:/s.test(MASCOT), 'and a dark value');
});

check('the badge is readable on a dark page', () => {
  assert.ok(/\.dark \.hh-badge/.test(MASCOT), 'the badge has a dark rule');
  const rule = MASCOT.slice(MASCOT.indexOf('.dark .hh-badge'));
  assert.ok(!/#1B3B32/.test(rule.slice(0, 120)), 'the deep forest ink is not the dark-mode text colour');
});

/* --- 5. the score badge separates fill from text -------------------- */

check('the health score has a fill colour and a separate readable one', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');
  assert.ok(/const ScoreColour/.test(bento), 'the fill colour exists');
  assert.ok(/const ScoreTextColour/.test(bento), 'and a separate text colour');
  assert.ok(
    /color: ScoreTextColour\(numericScore, isDarkMode\)/.test(bento),
    'the badge text uses the readable one, not the fill'
  );
});

check('the score badge reads the mode from the shared context', () => {
  const bento = read('src/components/health/CuteWellnessBento.jsx');
  assert.ok(/useTheme\(\)/.test(bento), 'it uses the shared theme context');
  assert.ok(
    !/matchMedia\(/.test(bento),
    'no private media query - that would drift from the toggle'
  );
});

/* --- 6. no theme rule can be written so that it never matches -------- */

check('no dark rule is written as a descendant of a root-level attribute', () => {
  const sheets = ['src/index.css', 'src/styles/fintech.css', 'src/styles/mascot-motion.css',
                  'src/styles/botanical.css', 'src/styles/polish.css'];
  const offenders = [];
  for (const s of sheets) {
    const text = read(s);
    for (const m of text.matchAll(/\.dark \[data-[a-z-]+/g)) {
      offenders.push(`${s}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `the theme class and a root attribute both sit on <html>, so a descendant rule never matches: ${offenders.join(', ')}`
  );
});

console.log('');
console.log(`theme in both modes: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
