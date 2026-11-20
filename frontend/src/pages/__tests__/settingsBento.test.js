/**
 * The contract of the settings bento.
 *
 * Run with: node src/pages/__tests__/settingsBento.test.js
 *
 * The settings page was rebuilt as a bento grid. A rebuild of a page
 * that already existed is exactly the kind of change that breaks
 * quietly, so these checks hold the things that must not change:
 *
 *   1. The bento pieces are all there - the header, the rail, the
 *      mascot, the form.
 *   2. The form state and the save handler survived the rebuild. The
 *      page still saves to /me, it still writes the user back to
 *      localStorage, and it still says the same thing when it is done.
 *   3. Every panel that was reachable before is still reachable. The
 *      rebuild moved the tabs into a rail, and a tab that fell out of
 *      the rail would be a feature that quietly vanished.
 *   4. The filter still filters, and it filters the rail and the
 *      workspace together.
 *   5. The bento is drawn in concept tokens. A hardcoded colour in
 *      the bento sheet would look right in one concept and wrong in
 *      the other five.
 *   6. Nothing in the page chrome is an operating system emoji.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../..');
const root = path.resolve(src, '..');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const settingsJsx = read('src/pages/Settings.jsx');
const headerJsx = read('src/components/settings/SettingsBentoHeader.jsx');
const mascotJsx = read('src/components/settings/SettingsMascotCompanion.jsx');
const bentoCss = read('src/styles/settings-bento.css');
const conceptsCss = read('src/styles/theme-concepts.css');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------- the parts
console.log('\nthe bento has all its parts');

check(
  'the page renders the bento shell',
  settingsJsx.includes('data-testid="settings-bento"') &&
    settingsJsx.includes('className="sbg-shell"')
);

check(
  'the page renders the bento header',
  settingsJsx.includes('<SettingsBentoHeader') &&
    headerJsx.includes('data-testid="settings-bento-header"')
);

check(
  'the page renders the category rail',
  settingsJsx.includes('data-testid="settings-bento-rail"') &&
    settingsJsx.includes('className="sbg-rail__card"')
);

check(
  'the rail has a heading of its own, so it is not read as more app navigation',
  settingsJsx.includes('sbg-rail__heading') &&
    settingsJsx.includes('t(\'settings.bento.category\')')
);

check(
  'the page renders the workspace',
  settingsJsx.includes('data-testid="settings-bento-workspace"') &&
    settingsJsx.includes('className="sbg-grid"')
);

check(
  'the page renders the account tile',
  settingsJsx.includes('data-testid="settings-bento-account"')
);

check(
  'the page renders the automation tile',
  settingsJsx.includes('data-testid="settings-bento-automation"')
);

check(
  'the page renders the form tile',
  settingsJsx.includes('data-testid="settings-bento-form"')
);

check(
  'the page renders the mascot companion',
  headerJsx.includes('<SettingsMascotCompanion') &&
    mascotJsx.includes('data-testid="settings-mascot"')
);

check(
  'the companion has a speech bubble',
  mascotJsx.includes('data-testid="settings-mascot-bubble"')
);

check(
  'the companion is draggable',
  mascotJsx.includes('draggable') && mascotJsx.includes('<DraggableSparkleMascot')
);

check(
  'the companion uses the real koban artwork',
  mascotJsx.includes('persona') &&
    read('src/components/mascot/DraggableSparkleMascot.jsx').includes('/koban-assets/')
);

// ------------------------------------------------------------- the categories
console.log('\nthe categories are all still there');

for (const id of ['profile', 'appearance', 'security', 'preferences', 'data', 'privacy', 'app']) {
  check(
    `the category "${id}" is in the rail`,
    settingsJsx.includes(`{ id: '${id}', label: t('settings.tabs.${id}')`)
  );
  check(
    `the category "${id}" still opens its panel`,
    settingsJsx.includes(`activeTab === '${id}'`)
  );
}

check(
  'the rail is drawn with the pixel icons, not emoji',
  settingsJsx.includes('PixelArtBusinessIcon') &&
    settingsJsx.includes('CATEGORY_ICONS')
);

// ---------------------------------------------------------------- the form
console.log('\nthe form survived the rebuild');

check(
  'the form still saves to /me with a PUT',
  settingsJsx.includes("api.request('/me'") && settingsJsx.includes("method: 'PUT'")
);

check(
  'the form still sends the same two fields',
  settingsJsx.includes('full_name: form.full_name') &&
    settingsJsx.includes('username: form.username')
);

check(
  'the form still writes the user back to localStorage',
  settingsJsx.includes("localStorage.setItem('user', JSON.stringify(updatedUser))")
);

check(
  'the form still has the three fields',
  settingsJsx.includes("sbg-email") &&
    settingsJsx.includes("sbg-username") &&
    settingsJsx.includes("sbg-full-name")
);

check(
  'the save button says the same thing',
  settingsJsx.includes("t('settings.profile.save')")
);

check(
  'the email field is still disabled',
  /id="sbg-email"[\s\S]{0,400}?disabled/.test(settingsJsx)
);

check(
  'the sign-out is still on the page',
  settingsJsx.includes('logout()') && settingsJsx.includes('localStorage.clear()')
);

// --------------------------------------------------------------- the filter
console.log('\nthe filter still filters');

check(
  'the header holds the filter box',
  headerJsx.includes('data-testid="settings-bento-search"')
);

check(
  'the page keeps the search state',
  settingsJsx.includes('const [search, setSearch] = useState') &&
    settingsJsx.includes('visibleTabs')
);

check(
  'a filter that matches nothing says so',
  settingsJsx.includes('data-testid="settings-bento-empty"') &&
    settingsJsx.includes("t('settings.bento.filter_empty')")
);

check(
  'the filter can be cleared',
  headerJsx.includes('data-testid="settings-bento-search-clear"')
);

// ------------------------------------------------------------ the tokens
console.log('\nthe bento is drawn in concept tokens');

const usedTokens = [...bentoCss.matchAll(/var\((--concept-[a-z-]+)/g)].map((m) => m[1]);
const uniqueTokens = [...new Set(usedTokens)];
const declaredTokens = [...new Set([...conceptsCss.matchAll(/(--concept-[a-z-]+)\s*:/g)].map((m) => m[1]))];

const unknown = uniqueTokens.filter((token) => !declaredTokens.includes(token));
check(
  'every token the bento uses is a token the concept sheet declares',
  unknown.length === 0,
  unknown.join(', ')
);

check(
  'the bento sheet has no hardcoded colour',
  !/#[0-9a-fA-F]{3,8}\b/.test(bentoCss),
  (bentoCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []).join(', ')
);

check(
  'the bento sheet has no rgb() or hsl() colour',
  !/\b(?:rgb|rgba|hsl|hsla)\(/.test(bentoCss)
);

check(
  'the bento sheet does not set a font-family',
  !/font-family\s*:/.test(bentoCss)
);

/**
 * The rule for one selector inside one media query.
 *
 * The bento sheet writes each rule as a block, so the block is cut out
 * and the declaration is looked for inside it. Matching the whole file
 * with one regular expression is not enough, because the same
 * declaration appears in more than one place - the standard property
 * and its -webkit- twin - and a rule that is turned off in one place
 * and on in another is exactly what these checks are for.
 */
/**
 * The blocks that carry a declaration for a selector.
 *
 * The bento sheet writes each rule as a block, and the same selector
 * appears more than once - once at the top level and once inside a
 * media query. A check that looked at only the first one would miss
 * the rule it was meant to hold, so every block is found and every
 * one is asked about.
 */
function blocksFor(selector) {
  const out = [];
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{', 'g');
  let m;
  while ((m = re.exec(bentoCss)) !== null) {
    const open = bentoCss.indexOf('{', m.index);
    const close = bentoCss.indexOf('}', open);
    if (open === -1 || close === -1) continue;
    // The nearest media query before this block.
    const mediaAt = bentoCss.lastIndexOf('@media', open);
    const mediaClose = mediaAt === -1 ? -1 : bentoCss.indexOf('}', mediaAt);
    const inMedia = mediaAt !== -1 && mediaClose > open;
    out.push({
      body: bentoCss.slice(open + 1, close),
      inMedia,
      media: mediaAt === -1 ? '' : bentoCss.slice(mediaAt, mediaClose),
    });
  }
  return out;
}

/**
 * Does a rule for this selector carry this declaration?
 *
 * `inside` names the media query the rule has to be in. When it is
 * empty the rule has to be at the top level - that is, NOT inside any
 * media query.
 */
function ruleIn(selector, declaration, inside = '') {
  return blocksFor(selector).some((b) => {
    if (inside) {
      if (!b.inMedia || !b.media.includes(inside)) return false;
    } else if (b.inMedia) {
      return false;
    }
    return b.body.includes(declaration);
  });
}

check(
  'the mobile rail fades at its edge, so the reader knows it scrolls',
  ruleIn('.sbg-rail', 'mask-image: linear-gradient') &&
    ruleIn('.sbg-rail', 'overflow-x: auto')
);

check(
  'the rail fade is turned off on a desktop, where the rail is a column',
  ruleIn('.sbg-rail', 'mask-image: none', '@media (min-width: 1024px)')
);

check(
  'the bento is a twelve column grid',
  bentoCss.includes('grid-template-columns: repeat(12, minmax(0, 1fr))')
);

check(
  'the bento collapses to one column on a phone',
  bentoCss.includes('.sbg-grid') && bentoCss.includes('@media (min-width: 1024px)')
);

// ---------------------------------------------------------------- the chrome
console.log('\nno emoji in the chrome');

const chrome = headerJsx + mascotJsx;
const emoji = chrome.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
check(
  'the bento chrome has no operating system emoji',
  !emoji,
  emoji ? emoji.join(' ') : ''
);

// The variation selector on its own: U+FE0F only makes the character
// before it an emoji, so it is checked apart from the ranges above.
const variation = chrome.match(/\u{FE0F}/gu);
check(
  'the bento chrome has no emoji variation selector',
  !variation,
  variation ? `${variation.length} found` : ''
);

check(
  'the page has no emoji in the bento markup',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(
    settingsJsx.slice(settingsJsx.indexOf('sbg-shell'), settingsJsx.indexOf('export default Settings'))
  )
);

// ------------------------------------------------------------ the repairs
console.log('\nthe repairs hold');

check(
  'the filter has its own placeholder, not the mascot drag hint',
  headerJsx.includes('placeholder={searchPlaceholder}') &&
    !headerJsx.includes('placeholder={mascotHint}')
);

check(
  'the filter placeholder is wired to the translated string',
  settingsJsx.includes("searchPlaceholder={t('settings.search_placeholder')}")
);

check(
  'the count badge is labelled, so it does not read as a stray glyph',
  headerJsx.includes('sbg-rail__count-label') &&
    headerJsx.includes('sbg-rail__count-value')
);

check(
  'the toggle title and description are on their own lines',
  /\.sbg-toggle__title\s*\{[^}]*display:\s*block/s.test(bentoCss) &&
    /\.sbg-toggle__desc\s*\{[^}]*display:\s*block/s.test(bentoCss)
);

check(
  'the toggle cards are never narrower than they need to be',
  bentoCss.includes('minmax(230px, 1fr)')
);

check(
  'the bento clears the fixed mobile dock',
  /\.sbg-shell\s*\{[^}]*padding-bottom:\s*5rem/s.test(bentoCss)
);

// --------------------------------------------------------------- the mascot
console.log('\nthe mascot reacts');

check(
  'the page bumps the celebration signal when something is saved',
  settingsJsx.includes('setCelebrate((n) => n + 1)')
);

check(
  'the page gives the mascot something to say',
  settingsJsx.includes("mascotMessage={mascotMessage}") &&
    settingsJsx.includes("t('settings.bento.mascot_greeting')")
);

check(
  'the mascot celebrates through the shared event as well',
  read('src/components/mascot/DraggableSparkleMascot.jsx').includes('koban:celebrate')
);

// ------------------------------------------------------------------ report
console.log('');
if (failed === 0) {
  console.log(`OK: the settings bento holds together (${passed} checks)`);
} else {
  console.log(`${failed} checks failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
