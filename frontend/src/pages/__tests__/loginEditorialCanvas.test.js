/**
 * The sign-in page, after the editorial overhaul.
 *
 * The page used to be a dark forest-green screen with neon lime
 * accents and two glass boxes on the right, and the form column
 * centred its content inside fixed padding - so on a laptop the card
 * was taller than the viewport and the submit button was pushed off
 * the bottom of the screen with no way to scroll to it.
 *
 * These checks hold the page to the warm editorial canvas, to drawn
 * icons rather than emoji, and to a form column that cannot clip its
 * own button again.
 *
 * Run with: node src/pages/__tests__/loginEditorialCanvas.test.js
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..');
const read = (p) => readFileSync(join(FRONTEND, p), 'utf8');

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
const REGISTER = read('src/pages/Register.jsx');
const CSS = read('src/styles/login.css');

// ---------------------------------------------------------------------
// The canvas: warm paper, and none of the old dark screen
// ---------------------------------------------------------------------

check('the page canvas is the warm editorial off-white', () => {
  assert.ok(/\.login-gateway\s*\{[^}]*background:\s*#FAF9F6/.test(CSS), 'the canvas');
  assert.ok(/\.login-gateway\s*\{[^}]*color:\s*#1F2421/.test(CSS), 'the charcoal type');
});

check('not one of the dark forest greens is left in the stylesheet', () => {
  for (const dark of ['#071410', '#04120c', '#08211a', '#0b2b1f', '#112A20', '#162E22']) {
    assert.ok(!CSS.toLowerCase().includes(dark.toLowerCase()), `${dark} is gone`);
  }
});

check('not one neon lime is left, in hex or in rgba', () => {
  for (const neon of ['#ccff00', '#9fe870', '#BEF264', '#A3E635']) {
    assert.ok(!CSS.toLowerCase().includes(neon.toLowerCase()), `${neon} is gone`);
    assert.ok(!LOGIN.toLowerCase().includes(neon.toLowerCase()), `${neon} is gone from the page`);
  }
  // The lime also appeared as an rgba focus ring, which a hex search
  // would have walked straight past.
  assert.ok(!CSS.includes('204, 255, 0'), 'the rgba lime is gone too');
});

check('the green radial wash is gone, not merely recoloured', () => {
  assert.ok(!CSS.includes('rgba(140, 210, 160'), 'the top haze');
  assert.ok(!CSS.includes('rgba(170, 225, 120'), 'the bottom haze');
});

check('no translucent-white text is left over from the dark page', () => {
  // White at 70-90% opacity is readable on forest green and invisible
  // on cream.
  assert.ok(!/rgba\(255, 255, 255, 0\.[6-9]/.test(CSS), 'no translucent white surfaces');
  assert.ok(!LOGIN.includes('text-white/80'), 'no translucent white type');
});

// ---------------------------------------------------------------------
// The bug that actually hid the button
// ---------------------------------------------------------------------

check('the form column cannot clip its own submit button', () => {
  const form = CSS.slice(CSS.indexOf('.login-gateway__form {'));
  const block = form.slice(0, form.indexOf('}'));
  // `justify-content: center` plus fixed padding is what pushed the
  // bottom of a tall card off the screen.
  assert.ok(/justify-content:\s*safe center/.test(block), 'centred only when there is room');
  assert.ok(/overflow-y:\s*auto/.test(block), 'and it scrolls when there is not');
});

check('the submit button is readable: cream on deep sage', () => {
  const sub = CSS.slice(CSS.indexOf('.login-gateway__submit {'));
  const block = sub.slice(0, sub.indexOf('}'));
  assert.ok(/background:\s*#2F4842/.test(block), 'the deep sage');
  assert.ok(/color:\s*#FAF9F6/.test(block), 'cream type on it');
  assert.ok(!/color:\s*#1F2421/.test(block), 'not near-black on sage, which is ~1.5:1');
});

// ---------------------------------------------------------------------
// The bento tiles and our own assets
// ---------------------------------------------------------------------

check('the glass boxes became pastel paper tiles', () => {
  for (const tint of ['--sakura', '--mint', '--oat', '--lavender']) {
    assert.ok(CSS.includes(`.login-gateway__card${tint}`), tint);
  }
  for (const colour of ['#F5D5CE', '#D3E8DC', '#E8E0CE', '#E2DFEE']) {
    assert.ok(CSS.includes(colour), colour);
  }
  assert.ok(!CSS.includes('rgba(40, 110, 80, 0.17)'), 'the dark glass gradient is gone');
});

check('the page renders the shoujo companion', () => {
  assert.ok(LOGIN.includes('<ClampShoujoMascot'), 'the companion');
  assert.ok(LOGIN.includes("from '../components/mascot/ClampShoujoMascot'"), 'imported');
  assert.ok(LOGIN.includes('data-testid="login-mascot"'), 'on the page');
  assert.ok(/roaming/.test(LOGIN), 'and it strolls');
});

check('the page renders the drawn pixel icons, not emoji', () => {
  assert.ok(LOGIN.includes('<PixelArtBusinessIcon'), 'the icons');
  assert.ok(LOGIN.includes("from '../components/ui/PixelArtBusinessIcon'"), 'imported');
  // The names appear both as a prop ("receipt") and inside the
  // scenarios array ('home'), so accept either quoting.
  for (const name of ['ledger_green', 'receipt', 'coffee', 'home', 'money_bag_rp']) {
    assert.ok(
      LOGIN.includes(`"${name}"`) || LOGIN.includes(`'${name}'`),
      name
    );
  }
});

check('the guest way in is a real button, not a footnote', () => {
  assert.ok(LOGIN.includes('data-testid="login-guest-cta"'), 'the button');
  assert.ok(LOGIN.includes('login-gateway__guest'), 'styled as a sibling of the Google button');
  const guest = CSS.slice(CSS.indexOf('.login-gateway__guest {'));
  const block = guest.slice(0, guest.indexOf('\n}'));
  assert.ok(/background:\s*#E3F2EA/.test(block), 'the pastel mint');
  assert.ok(/width:\s*100%/.test(block), 'full width, like the Google button');
});

check('the third tile tells the reader what the app is for', () => {
  assert.ok(LOGIN.includes('data-testid="login-scenarios"'), 'the tile');
  assert.ok(CSS.includes('.login-gateway__scenarios'), 'and its styles');
});

// ---------------------------------------------------------------------
// Registering looks like the same application
// ---------------------------------------------------------------------

check('the register page is on the same canvas', () => {
  assert.ok(REGISTER.includes('bg-[#FAF9F6]'), 'the warm canvas');
  assert.ok(!REGISTER.includes('from-primary-500 to-primary-600'), 'not a coloured gradient');
});

check('the register page has no white type left on the light canvas', () => {
  assert.ok(!/text-white mb-2/.test(REGISTER), 'the heading is dark');
  assert.ok(!REGISTER.includes('text-primary-100'), 'the tagline is dark');
  assert.ok(!REGISTER.includes('bg-white/20'), 'the badge is not translucent white');
});

// ---------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------

check('the new words exist in all three languages', () => {
  const dict = read('src/i18n/keys_batch3.js');
  for (const key of ['guest_cta', 'scenarios_title', 'scenario_coffee_title', 'scenario_household_title', 'scenario_goal_title']) {
    const hits = dict.split(`${key}:`).length - 1;
    assert.ok(hits >= 3, `${key} in id, en and ja (found ${hits})`);
  }
});

// ---------------------------------------------------------------------

console.log('');
if (failed === 0) {
  console.log(`login editorial canvas: all ${passed} checks passed`);
} else {
  console.log(`login editorial canvas: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
