/**
 * The three-design engine.
 *
 * The app is drawn in one of three designs at a time:
 *
 *   corporate  Korporat Catchy  - warm alabaster, white cards, forest tickets. DEFAULT.
 *   medieval   Royal Aurelia    - parchment canvas, midnight guild panels, gold plaques.
 *   jade       Jade Sovereign   - emerald terminal, light and dark.
 *
 * The choice has to reach EVERY page: the sidebar, the top bar, the mobile
 * dock, the canvas, the cards, the stat boxes, the modals, the inputs and
 * the buttons. A theme that paints the sidebar but leaves the cards in the
 * old design is the "Frankenstein" page this engine exists to prevent.
 *
 * These checks hold that at the level of the stylesheet, because that is
 * where the rule lives: one sheet, one token set per theme, and every
 * surface named by both a background and a text colour.
 *
 * Run with: node src/styles/__tests__/multiTheme.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.resolve(HERE, '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(FRONT, rel), 'utf8');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failures.push(name); console.log(`not ok - ${name}\n  ${err.message}`); }
};

const CSS = read('src/styles/multi-theme.css');
const THEME_MODULE = read('src/utils/appTheme.js');
const CONTEXT = read('src/contexts/ThemeContext.jsx');
const APPEARANCE = read('src/pages/Settings/Appearance.jsx');

const THEMES = ['corporate', 'medieval', 'jade'];

/** The token block of one theme, as the set of custom properties it declares. */
const tokensOf = (theme) => {
  const re = new RegExp(`html\\[data-app-theme='${theme}'\\]\\s*\\{([^}]*)\\}`, 's');
  const m = CSS.match(re);
  assert.ok(m, `the ${theme} theme declares no tokens`);
  return new Set([...m[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
};

// ---------------------------------------------------------------------------
// 1. The sheet is loaded
// ---------------------------------------------------------------------------

check('the theme sheet is loaded by the application', () => {
  assert.ok(/@import ['"]\.\/styles\/multi-theme\.css['"]/.test(read('src/index.css')), 'not imported by index.css');
  assert.ok(read('src/main.jsx').includes('./styles/multi-theme.css'), 'not imported by main.jsx');
});

check('the retired single-page fantasy sheet is gone', () => {
  assert.ok(!fs.existsSync(path.join(FRONT, 'src/styles/fantasy-rpg.css')), 'the old scoped fantasy skin is still there');
  assert.ok(!/fantasy-rpg/.test(read('src/main.jsx')), 'and it is still imported');
  assert.ok(!/fantasy-rpg/.test(read('src/index.css')), 'and it is still imported');
});

// ---------------------------------------------------------------------------
// 2. The three designs exist
// ---------------------------------------------------------------------------

check('the three designs are declared, and corporate is the default', () => {
  for (const id of THEMES) {
    assert.ok(THEME_MODULE.includes(`${id}: {`), `the ${id} design is not declared`);
  }
  assert.ok(/DEFAULT_APP_THEME = 'corporate'/.test(THEME_MODULE), 'corporate is not the default');
  assert.ok(/THEME_KEY = 'fm_ui_theme'/.test(THEME_MODULE), 'the choice is not kept in localStorage');
});

check('the design is written onto both <html> and <body>', () => {
  assert.ok(
    /documentElement, document\.body/.test(THEME_MODULE),
    'the design is written on only one of them, so portalled content is outside the theme'
  );
  assert.ok(/setAttribute\('data-app-theme', theme\)/.test(THEME_MODULE), 'data-app-theme is not written');
  assert.ok(/classList\.toggle\(`theme-\$\{id\}`/.test(THEME_MODULE), 'the theme class is not written');
});

check('the design and its palette travel with the account', () => {
  assert.ok(/preferences: \{ ui_theme: value \}/.test(CONTEXT), 'the design is not saved to the account');
  assert.ok(/preferences: \{ ui_palette: value \}/.test(CONTEXT), 'the palette is not saved to the account');
  assert.ok(/prefs\.ui_theme/.test(CONTEXT), 'the design is not read back from the account');
});

// ---------------------------------------------------------------------------
// 3. Every theme is a whole design, not a half one
// ---------------------------------------------------------------------------

check('every theme declares the same tokens', () => {
  const base = tokensOf('corporate');
  for (const id of THEMES.filter((t) => t !== 'corporate')) {
    const set = tokensOf(id);
    const missing = [...base].filter((t) => !set.has(t));
    assert.deepEqual(missing, [], `the ${id} theme has no ${missing.join(', ')}`);
  }
});

check('the surfaces name their tokens in every theme', () => {
  const surfaces = [
    '--app-bg', '--sidebar-bg', '--sidebar-text', '--card-bg', '--card-text',
    '--ticket-bg', '--ticket-text', '--btn-primary-bg', '--btn-primary-text',
    '--stat-income-bg', '--stat-expense-bg', '--input-bg', '--input-text',
  ];
  for (const id of THEMES) {
    const set = tokensOf(id);
    for (const token of surfaces) {
      assert.ok(set.has(token), `the ${id} theme has no ${token}`);
    }
  }
});

check('the semantic classes are drawn from the tokens', () => {
  // A page that uses .theme-card must follow whichever theme is active,
  // so the class may not name a colour of its own.
  for (const cls of ['.theme-card', '.theme-ticket-card', '.theme-stat-box', '.theme-badge', '.theme-btn-primary']) {
    const i = CSS.indexOf(`${cls} {`);
    assert.ok(i >= 0, `no rule for ${cls}`);
    const rule = CSS.slice(i, CSS.indexOf('\n}', i));
    assert.ok(!/#[0-9a-fA-F]{3,8}/.test(rule), `${cls} names a colour of its own instead of a token`);
  }
});

check('the chrome is painted in both of the other designs', () => {
  // The sidebar, the top bar and the mobile dock. Without these the page
  // is a white sidebar around a dark canvas.
  for (const id of ['medieval', 'jade']) {
    for (const part of ['.theme-sidebar', '.theme-header', '.theme-bottomnav']) {
      assert.ok(
        CSS.includes(`html[data-app-theme='${id}'] :is(.theme-sidebar, .theme-header, .theme-bottomnav)`),
        `the ${id} design does not paint ${part}`
      );
    }
  }
});

check('every design paints the modal, the forms and the buttons', () => {
  for (const id of THEMES) {
    if (id === 'corporate') continue; // corporate is the design those classes already draw
    for (const part of ["[role='dialog']", 'input, select, textarea', '.theme-btn-primary']) {
      assert.ok(CSS.includes(`html[data-app-theme='${id}']`), `the ${id} design has no rule at all`);
    }
  }
  assert.ok(/html\[data-app-theme='medieval'\] \[role='dialog'\]/.test(CSS), 'the medieval modal is not drawn');
  assert.ok(/html\[data-app-theme='jade'\] \[role='dialog'\]/.test(CSS), 'the jade modal is not drawn');
  assert.ok(/html\[data-app-theme='medieval'\] :is\(input, select, textarea\)/.test(CSS), 'the medieval forms are not drawn');
  assert.ok(/html\[data-app-theme='jade'\] :is\(input, select, textarea\)/.test(CSS), 'the jade forms are not drawn');
});

check('the design is decided on the root, never on a descendant', () => {
  // The theme class and the root attribute both sit on <html>, so a rule
  // that needs both never matches.
  const offenders = [...CSS.matchAll(/\.dark \[data-app-theme/g)].map((m) => m[0]);
  assert.deepEqual(offenders, [], `a rule that never matches: ${offenders.join(', ')}`);
});

check('no themed rule leaks past its theme', () => {
  // A selector list like
  //   html[data-app-theme='jade'] :is(a, button)[class~='bg-gradient-to-r'],
  //   [class~='bg-gradient-to-br'], ...
  // themes only the FIRST selector. The rest are global, so the rule
  // repaints buttons in every theme - including the default one.
  // A quoted string may hold brackets of its own - `[class*='text-[#5']` is
  // valid CSS - so the depth is counted only outside the quotes.
  const splitTop = (s) => {
    const out = []; let buf = ''; let depth = 0; let quote = null;
    for (const ch of s) {
      if (quote) {
        buf += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
      if (ch === '(' || ch === '[') depth += 1;
      else if (ch === ')' || ch === ']') depth -= 1;
      if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; }
      else buf += ch;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  };
  const leaks = [];
  for (const m of CSS.matchAll(/(^|\})\s*([^{}]+)\{/g)) {
    const sel = m[2].trim();
    if (sel.startsWith('/*') || sel.startsWith('@')) continue;
    const parts = splitTop(sel);
    if (parts.length < 2) continue;
    const themed = parts.filter((p) => p.includes('data-app-theme'));
    const bare = parts.filter((p) => !p.includes('data-app-theme'));
    if (themed.length && bare.length) {
      leaks.push(`${themed[0].slice(0, 60)} also styles ${bare[0].slice(0, 60)}`);
    }
  }
  assert.deepEqual(leaks, [], `a themed rule that also paints the other themes: ${leaks.join(' | ')}`);
});

check('every themed selector list is well formed', () => {
  // A stray bracket makes the browser drop the whole rule, so the page
  // quietly loses that theme's styling.
  const bad = [];
  for (const m of CSS.matchAll(/(^|\})\s*([^{}]+)\{/g)) {
    const sel = m[2].trim();
    if (!sel.includes('data-app-theme')) continue;
    if (sel.startsWith('/*') || sel.startsWith('@')) continue;
    // The brackets inside a quoted string are part of the value, not the
    // selector: `[class*='text-[#5']` is well formed.
    const bare = sel.replace(/"[^"]*"|'[^']*'/g, '');
    const open = (bare.match(/\[/g) || []).length;
    const close = (bare.match(/\]/g) || []).length;
    if (open !== close) bad.push(sel.slice(0, 80));
  }
  assert.deepEqual(bad, [], `a malformed selector (the browser would drop the rule): ${bad.join(' | ')}`);
});

// ---------------------------------------------------------------------------
// 4. No page may hardcode a design
// ---------------------------------------------------------------------------

check('no page hardcodes the guild colours', () => {
  // The old regression: /profile/summary painted itself midnight blue and
  // gold while the sidebar stayed white. The theme's own palette lives in
  // utils/appTheme.js - that is where the colours belong. Everywhere else
  // a page has to ask the theme for them.
  const banned = ['#161b2e', '#0b0e18', '#c5a059', '#d4af37', '#f3e9d2'];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); continue; }
      if (!/\.jsx?$/.test(e.name)) continue;
      const rel = path.relative(FRONT, full);
      if (rel === path.join('src', 'utils', 'appTheme.js')) continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const hex of banned) {
        assert.ok(!text.includes(hex), `${rel} hardcodes ${hex}`);
      }
    }
  };
  walk(path.join(FRONT, 'src'));
});

check('the profile summary is written in the semantic classes', () => {
  const profile = read('src/pages/ProfileSummary.jsx');
  for (const cls of ['theme-page-shell', 'theme-card', 'theme-ticket-card', 'theme-stat-box', 'theme-badge', 'theme-btn-primary']) {
    assert.ok(profile.includes(cls), `the profile summary has no ${cls}`);
  }
});

check('the empty state is a chest, drawn, with a real 8-bit gem', () => {
  const kit = read('src/components/ui/FantasyKit.jsx');
  assert.ok(kit.includes('tile_chest.png'), 'no chest');
  assert.ok(/koban-assets\/svg\/accessories\//.test(kit), 'the gem is not a real 8-bit SVG');
  assert.ok(fs.existsSync(path.join(FRONT, 'public/koban-assets/tiles/tile_chest.png')), 'chest tile missing');
});

// ---------------------------------------------------------------------------
// 5. The reader can reach it
// ---------------------------------------------------------------------------

check('the appearance page offers the three designs', () => {
  assert.ok(APPEARANCE.includes('theme-picker'), 'the picker is missing');
  for (const id of THEMES) {
    assert.ok(APPEARANCE.includes(`theme-\${id}`), `the ${id} design is not offered`);
  }
  assert.ok(APPEARANCE.includes('palette-picker'), 'the guild palettes are not offered');
});

check('one click reaches the next design, from any page', () => {
  const pill = read('src/components/ui/ThemeCyclePill.jsx');
  assert.ok(/cycleAppTheme/.test(pill), 'the pill does not cycle');
  const nav = read('src/components/layout/Navigation.jsx');
  assert.ok(/ThemeCyclePill/.test(nav), 'the pill is not in the chrome');
  assert.ok(/theme-sidebar/.test(nav), 'the sidebar is not marked for the themes');
  assert.ok(/theme-header/.test(nav), 'the top bar is not marked for the themes');
  assert.ok(/theme-bottomnav/.test(nav), 'the mobile dock is not marked for the themes');
});

check('the active nav item says which page it is on', () => {
  // The designs paint the active item by that attribute.
  for (const file of ['src/components/layout/Navigation.jsx', 'src/components/layout/GroupedNav.jsx']) {
    assert.ok(/aria-current=\{isActive \? 'page' : undefined\}/.test(read(file)), `${file} does not mark the active item`);
  }
});


// ---------------------------------------------------------------------------
// The concept layer and the skin layer must not fight over the same element.
// The concept paints the CONTENTS; the skin paints the CHROME. When the
// concept layer was allowed to repaint the sidebar, the skin's dark nav ink
// landed on the concept's light sidebar and every label became unreadable.
// ---------------------------------------------------------------------------

const CONCEPTS = read('src/styles/theme-concepts.css');

check('the concept layer does not repaint the app chrome', () => {
  // The chrome elements carry bg-white themselves, so excluding only their
  // DESCENDANTS still lets the concept repaint the panel they sit in. The
  // exclusion has to name the element itself, not `element *`.
  const surfaceRule = CONCEPTS.match(
    /:is\(\.bg-white, \.bg-gray-50, \.bg-gray-100\):not\(:where\(([^)]*)\)\)/);
  assert.ok(surfaceRule, 'the concept surface rule is gone');
  const spared = surfaceRule[1].split(',').map((s) => s.trim());
  for (const chrome of ['.theme-sidebar', '.theme-header', '.theme-bottomnav']) {
    assert.ok(
      spared.includes(chrome),
      `the concept surface rule does not spare ${chrome} itself, so the chrome element is repainted`);
  }
});

check('the concept layer does not repaint the chrome ink', () => {
  const inkRule = CONCEPTS.match(
    /:is\(\.text-gray-900[^)]*\):not\(:where\(([^)]*)\)\)/);
  assert.ok(inkRule, 'the concept ink rule is gone');
  const spared = inkRule[1].split(',').map((s) => s.trim());
  for (const chrome of ['.theme-sidebar', '.theme-header', '.theme-bottomnav']) {
    assert.ok(
      spared.includes(chrome),
      `the concept ink rule does not spare ${chrome} itself, so the chrome ink is overridden`);
  }
});

check('the concept badge takes the badge colour whole', () => {
  // The skin paints a gold/emerald GRADIENT on badges with the `background`
  // shorthand. A background-color override does not remove that gradient, so
  // the concept's ink would end up on the skin's gradient.
  const badge = CONCEPTS.match(
    /html\[data-theme-concept\][^{]*\.theme-badge \{([^}]*)\}/);
  assert.ok(badge, 'the concept badge rule is gone');
  assert.ok(
    /background-image:\s*none\s*!important/.test(badge[1]),
    'the concept badge does not clear the skin gradient, so its ink lands on the gradient');
  assert.ok(
    /color:\s*var\(--concept-badge-ink\)\s*!important/.test(badge[1]),
    'the concept badge does not set its own ink');
});

check('the concept badge passes its ink to its own children', () => {
  // The skin forces `color: inherit !important` on the descendants of a
  // badge. That re-asserts the skin's ink on a glyph inside a concept badge.
  const descendants = CONCEPTS.match(
    /html\[data-theme-concept\][^{]*:is\(\.theme-badge, \.hh-badge\) :where\(\*,\s*svg\) \{([^}]*)\}/);
  assert.ok(descendants, 'the concept badge has no rule for its children');
  assert.ok(
    /color:\s*inherit\s*!important/.test(descendants[1]),
    'the concept badge children do not inherit the concept ink');
});

check('the concept pills out-rank the skin own ink rules', () => {
  // The skin writes `color: inherit !important` on neutral surfaces, and
  // those rules weigh (0,3,1). A bare .concept-pill weighs (0,1,0) and loses
  // on specificity even with !important, so the concept has to repeat the
  // attribute three times - the idiom the concept sheet documents.
  for (const pill of ['concept-apply-pill', 'concept-active-pill', 'concept-idle-pill',
                      'concept-active-badge', 'concept-tag-pill', 'concept-mini__badge',
                      'concept-bubble']) {
    const re = new RegExp(
      'html\\[data-theme-concept\\]\\[data-theme-concept\\]\\[data-theme-concept\\] \\.' + pill + ' \\{([^}]*)\\}', 's');
    const m = CONCEPTS.match(re);
    assert.ok(m, `the concept pill ${pill} does not use the triple-attribute idiom`);
    assert.ok(
      /color:[^;]*!important/.test(m[1]),
      `the concept pill ${pill} does not pin its ink with !important`);
  }
});

console.log(`\nmulti theme: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
