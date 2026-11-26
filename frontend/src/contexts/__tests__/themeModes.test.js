/**
 * The three modes are real, and the control shows the choice.
 *
 * The theme machinery had the three modes all along - 'light', 'dark'
 * and 'system' - the server stored them, the context kept them and the
 * watcher followed the OS. But no control could reach 'system':
 *
 * - the header's toggle called `toggleTheme`, which flips between
 *   light and dark and nothing else;
 * - the provider handed out `themeMode: theme`, the RESOLVED theme,
 *   so a control that highlighted by it could never show "system" as
 *   chosen - the option would look broken;
 * - and the server sync treated a local 'system' as "not pinned", so
 *   the server's copy overwrote it within one sync interval. A reader
 *   who chose "follow the device" was silently moved to a fixed mode.
 *
 * So the rules are:
 *
 * - the mode is the user's choice and is what a control highlights;
 * - every mode can be reached from the interface;
 * - 'system' survives a server sync;
 * - an explicit light or dark pinned on a device is not overwritten.
 *
 * Run with: node src/contexts/__tests__/themeModes.test.js
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

const CONTEXT = read('src/contexts/ThemeContext.jsx');
const THEME = read('src/utils/theme.js');
const NAV = read('src/components/layout/Navigation.jsx');

console.log('the theme has three modes, and the control shows the choice');

/* --- the mode is the choice, not the resolved theme ------------------ */

check('the provider hands out the mode, not the resolved theme', () => {
  // `themeMode: theme` would be the resolved value; the mode is what
  // the reader chose and is what a control must highlight.
  assert.ok(
    /themeMode:\s*mode\s*,/.test(CONTEXT),
    'themeMode is the mode state'
  );
  assert.ok(
    !/themeMode:\s*theme\s*,/.test(CONTEXT),
    'it is not the resolved theme'
  );
});

check('the mode state is the stored choice', () => {
  assert.ok(
    /useState\(\(\) => readStoredTheme\(\) \|\| THEME_SYSTEM\)/.test(CONTEXT),
    'the mode starts from what was stored'
  );
});

/* --- every mode can be reached from the interface ------------------- */

check('the header toggle cycles through all three modes', () => {
  const cycle = NAV.slice(NAV.indexOf('THEME_CYCLE'), NAV.indexOf('THEME_CYCLE') + 400);
  assert.ok(/'light'/.test(cycle), 'light is in the cycle');
  assert.ok(/'dark'/.test(cycle), 'dark is in the cycle');
  assert.ok(/'system'/.test(cycle), 'system is in the cycle');
});

check('the toggle calls the mode setter, not a light/dark flip', () => {
  assert.ok(/const cycleTheme = \(\) => setThemeMode\(nextMode\);/.test(NAV), 'it sets the mode');
  assert.ok(
    /onClick=\{cycleTheme\}/.test(NAV),
    'and the button is wired to the cycle, not to a flip'
  );
});

check('the toggle says which mode is on and which comes next', () => {
  assert.ok(/data-theme-mode=\{themeMode\}/.test(NAV), 'the current mode is on the element');
  assert.ok(/aria-label=\{themeModeLabel\}/.test(NAV), 'and it is named for a screen reader');
  assert.ok(/click for/i.test(NAV), 'the label says what the click will do');
});

check('the system mode has its own icon', () => {
  // In the system mode the device is deciding, so the icon says so.
  assert.ok(/MonitorSmartphone/.test(NAV), 'the device icon is used for system');
  assert.ok(
    /themeMode === 'system'\s*\?/.test(NAV),
    'and it is chosen by the mode, not by the resolved theme'
  );
});

check('the setter accepts system as a real value', () => {
  assert.ok(
    /next === THEME_DARK \|\| next === THEME_SYSTEM \? next : THEME_LIGHT/.test(CONTEXT),
    'system is stored as itself'
  );
});

/* --- the watcher follows the OS only for the system mode ------------ */

check('the OS watcher ignores an explicit choice', () => {
  assert.ok(
    /if \(stored === THEME_LIGHT \|\| stored === THEME_DARK\) return;/.test(THEME),
    'a pinned light or dark is never overridden by the OS'
  );
});

check('the watcher is registered and follows the OS', () => {
  assert.ok(/watchSystemTheme\(/.test(CONTEXT), 'the watcher is used');
  assert.ok(
    /setThemeState\(next\)/.test(CONTEXT),
    'and its result becomes the painted theme'
  );
});

/* --- the server sync does not eat the system mode ------------------ */

check('a local system is not treated as unpinned and overwritten', () => {
  // The old code was `if (!local || local === THEME_SYSTEM)`, so a
  // local 'system' was replaced by the server's copy - and the
  // server's copy was a fixed 'light'.
  assert.ok(
    !/if \(!local \|\| local === THEME_SYSTEM\)/.test(CONTEXT),
    'the old overwrite is gone'
  );
});

check('only an explicit light or dark pins the device', () => {
  assert.ok(
    /const localPinned = local === THEME_LIGHT \|\| local === THEME_DARK;/.test(CONTEXT),
    'pinned means an explicit light or dark'
  );
  assert.ok(
    /if \(!localPinned\)/.test(CONTEXT),
    'and only then may the server set the mode'
  );
});

check('the stored representation is one canonical string', () => {
  assert.ok(
    /export const THEME_KEY = 'finmanager-theme'/.test(THEME),
    'the key is the canonical one'
  );
  assert.ok(
    /THEME_MODES = \[THEME_LIGHT, THEME_DARK, THEME_SYSTEM\]/.test(THEME),
    'and the three values are named'
  );
});

check('an old stored value is still readable', () => {
  // A JSON blob from an older build must not leave the reader stuck
  // on the wrong theme.
  assert.ok(
    /startsWith\('\{'\)/.test(THEME),
    'a legacy JSON value is parsed on read'
  );
});

console.log('');
console.log(`theme modes: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
