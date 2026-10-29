/**
 * The switches.
 *
 * A switch that is off has to mean the reader sees exactly what they
 * saw before. That is the whole point of a switch, and it is easy to
 * break by accident: a change made outside the switch, or a change
 * made in a place the switch does not reach.
 *
 * These tests check the switch logic itself. The rendering is checked
 * by building the application with the switch on and with it off, and
 * comparing the two.
 *
 * Run with: node src/utils/__tests__/featureFlags.test.js
 */

import {
  buildFlag,
  readerFlag,
  setReaderFlag,
  clearReaderFlags,
  allFlags,
  FLAG_NAMES,
} from '../featureFlags.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

// A stand-in for the browser storage.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

// ---------------------------------------------------------------------------
// A switch nobody has touched is off
// ---------------------------------------------------------------------------

store.clear();
check('a build switch is off by default', buildFlag('UI_POLISH'), false);
check('the aurora build switch is off by default', buildFlag('UI_AURORA'), false);
check('a reader switch is off by default', readerFlag('NAV_V2'), false);
check('an unknown switch is off', buildFlag('NOPE'), false);
check('an unknown reader switch is off', readerFlag('NOPE'), false);

// ---------------------------------------------------------------------------
// Turning one on and off
// ---------------------------------------------------------------------------

check('a reader switch can be turned on', setReaderFlag('NAV_V2', true), true);
check('it is then on', readerFlag('NAV_V2'), true);
check('the other switches are untouched', readerFlag('SINGLE_ADD'), false);

check('a reader switch can be turned off', setReaderFlag('NAV_V2', false), true);
check('it is then off', readerFlag('NAV_V2'), false);

check('an unknown switch is refused', setReaderFlag('NOPE', true), false);
check('and it was not written', readerFlag('NOPE'), false);

// ---------------------------------------------------------------------------
// A broken stored value is treated as off, not as a crash
// ---------------------------------------------------------------------------

store.set('featureFlags', 'this is not json');
check('a broken value is off', readerFlag('NAV_V2'), false);

store.set('featureFlags', '{"navV2": "yes"}');
check('a truthy stored value is on', readerFlag('NAV_V2'), true);

// ---------------------------------------------------------------------------
// Everything at once
// ---------------------------------------------------------------------------

setReaderFlag('NAV_V2', true);
setReaderFlag('REMINDERS', true);
const all = allFlags();
check('the switches are reported', all.NAV_V2, true);
check('and the others', all.REMINDERS, true);
check('and the ones that are off', all.SINGLE_ADD, false);

clearReaderFlags();
check('everything can be cleared at once', readerFlag('NAV_V2'), false);
check('and the other one too', readerFlag('REMINDERS'), false);

// ---------------------------------------------------------------------------
// The names are the ones the switches are known by
// ---------------------------------------------------------------------------

check('the build switch name', FLAG_NAMES.BUILD.UI_POLISH, 'VITE_UI_POLISH');
check('the reader switch name', FLAG_NAMES.READER.NAV_V2, 'navV2');

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

console.log('');
console.log(`featureFlags: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) {
    console.log('  FAIL ' + f);
  }
  process.exit(1);
}
