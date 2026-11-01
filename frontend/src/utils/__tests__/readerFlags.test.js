/**
 * The switches, and the menus that read them.
 *
 * A reader who turns on the shared bill and sees no change in the menu
 * concludes that the feature is not there. The switch is written to the
 * browser's storage, and the menu is drawn from that storage, but the
 * menu is not drawn again when the switch changes on its own.
 *
 * These checks cover the two things that make the switch take effect:
 * the writing side says that something changed, and the reading side
 * redraws when it hears.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The place this file sits, so the checks read the same files whether
// they are run from the project or from the frontend folder.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/**
 * The storage the switches are kept in, stood in for.
 */
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

/**
 * The event the browser would raise.
 */
class FakeCustomEvent {
  constructor(type) {
    this.type = type;
  }
}

/**
 * The reading side, loaded from the real source with a stand-in for
 * the browser.
 */
function loadFeatureFlags(storage, onEvent) {
  const listeners_ = onEvent ? [onEvent] : [];
  const source = read('src/utils/featureFlags.js');

  // The module reads and writes the browser's storage directly. Give
  // it a window that has the storage and the event machinery.
  const win = {
    localStorage: storage,
    dispatchEvent: (event) => {
      listeners_.forEach((fn) => fn(event));
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  // The module is written as a module, so the exports are pulled out
  // of it before it is read as a plain script.
  const body = source
    .replace(/export\s+(const|function|let)\s+([A-Za-z0-9_]+)/g, '$1 $2')
    .replace(/export\s*\{[^}]*\};?/g, '')
    // The module asks the bundler for its environment. There is no
    // bundler here, so an empty one stands in.
    .replace(/import\.meta\.env/g, '({})')
    // The module also offers a default export, which is of no use
    // here.
    .replace(/export\s+default[\s\S]*?;\s*$/m, '');

  const module = { exports: {} };
  const fn = new Function(
    'window',
    'CustomEvent',
    'module',
    'exports',
    `${body}\nmodule.exports = { readerFlag, setReaderFlag, clearReaderFlags, READER_FLAG_CHANGED, STORAGE_KEY };`
  );
  fn(win, FakeCustomEvent, module, module.exports);
  return module.exports;
}

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

console.log('reader flags');

const storage = makeStorage();
const heard = [];
const flags = loadFeatureFlags(storage, (event) => heard.push(event.type));

check('a switch that was never turned on reads as off', () => {
  assert.equal(flags.readerFlag('SMART_SPLIT_BILL'), false);
});

check('turning a switch on says that something changed', () => {
  heard.length = 0;
  flags.setReaderFlag('SMART_SPLIT_BILL', true);

  assert.ok(
    heard.includes(flags.READER_FLAG_CHANGED),
    `expected ${flags.READER_FLAG_CHANGED} to be announced, heard ${JSON.stringify(heard)}`
  );
});

check('a switch that has been turned on reads as on', () => {
  assert.equal(flags.readerFlag('SMART_SPLIT_BILL'), true);
});

check('turning a switch off says that something changed as well', () => {
  heard.length = 0;
  flags.setReaderFlag('SMART_SPLIT_BILL', false);
  assert.ok(heard.includes(flags.READER_FLAG_CHANGED));
});

check('clearing the switches says that something changed', () => {
  flags.setReaderFlag('SMART_SPLIT_BILL', true);
  heard.length = 0;
  flags.clearReaderFlags();
  assert.ok(heard.includes(flags.READER_FLAG_CHANGED));
  assert.equal(flags.readerFlag('SMART_SPLIT_BILL'), false);
});

check('the menu redraws when the switch changes', () => {
  const hook = read('src/utils/useReaderFlags.js');
  assert.ok(
    hook.includes('READER_FLAG_CHANGED'),
    'the hook must listen for the change the switch makes'
  );
  assert.ok(hook.includes("'storage'"), 'the hook must also listen for the browser event');
  assert.ok(
    /addEventListener\(READER_FLAG_CHANGED/.test(hook),
    'the hook must register the listener'
  );
});

check('the desktop menu redraws when the switch changes', () => {
  const nav = read('src/components/layout/Navigation.jsx');
  const uses = nav.match(/useReaderFlags\(\)/g) || [];
  assert.ok(uses.length >= 3, `expected the hook in the sidebar, the mobile menu and the more page, found ${uses.length}`);
});

check('the mobile menu leaves out the entries whose switch is off', () => {
  const nav = read('src/components/layout/Navigation.jsx');
  const mobile = nav.slice(nav.indexOf('const MobileHeader'));
  assert.ok(
    /readerFlag\(item\.flag\)/.test(mobile),
    'the mobile menu must respect the switch as the desktop menu does'
  );
});

check('the settings page leads to the page that holds the switches', () => {
  const settings = read('src/pages/Settings.jsx');
  assert.ok(settings.includes('/settings/app'), 'the settings must point at the switch page');
  assert.ok(settings.includes('appFeatures'), 'the settings must name the section');
});

check('the switch is offered in each language', () => {
  ['id', 'en', 'ja'].forEach((lang) => {
    const i18n = read(`src/i18n/${lang}.js`);
    assert.ok(i18n.includes('appFeatures'), `${lang} must have the app features section`);
    assert.ok(/app:\s*"/.test(i18n), `${lang} must have the application tab`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
