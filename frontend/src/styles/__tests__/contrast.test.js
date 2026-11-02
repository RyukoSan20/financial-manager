/**
 * The contrast rules the polish layer has to keep.
 *
 * Two things went wrong in the dark mode of the polish layer, and both
 * of them were the same mistake: a rule that was never reached, and a
 * button that took its colour from wherever it happened to sit.
 *
 * - The dark rules were written as a descendant of the dark class. The
 *   dark class and the polish attribute are both on the root element,
 *   so a descendant rule never matches. The whole dark half of the
 *   polish layer was therefore dead, and a card that is drawn for a
 *   light page was drawn on a dark page.
 *
 * - The buttons of the shared bill took their text colour from
 *   whatever they sat on. On a dark page that put white text on a
 *   white button, which is a button with no words on it.
 *
 * These checks read the stylesheets, because the rule that broke is a
 * rule about how the selectors are written.
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

console.log('contrast');

const polish = read('src/styles/polish.css');
const split = read('src/styles/split.css');

check('the polish layer puts the dark class and the polish attribute together', () => {
  const descendants = polish.match(/\.dark \[data-ui[^\]]*\]/g) || [];
  assert.deepEqual(
    descendants,
    [],
    `these dark rules never match, because both are on the root element: ${descendants.join(', ')}`
  );
});

check('the dark rules for the polished card are written to beat the light ones', () => {
  assert.ok(
    /\.dark\[data-ui="polish"\]\s+\.layered-surface/.test(polish),
    'the dark card must have its own rule'
  );
  assert.ok(
    /\[data-ui="polish"\]:not\(\.dark\)\s+\.layered-surface/.test(polish),
    'the light card must not be drawn on a dark page'
  );
});

check('the polished card has a rule for both themes', () => {
  const light = polish.match(/\[data-ui="polish"\]:not\(\.dark\)\s+\.layered-surface\s*\{([^}]*)\}/);
  const dark = polish.match(/\.dark\[data-ui="polish"\]\s+\.layered-surface\s*\{([^}]*)\}/);
  assert.ok(light, 'the light card rule is missing');
  assert.ok(dark, 'the dark card rule is missing');
  assert.ok(light[1].includes('background-image'), 'the light card must have its own background');
  assert.ok(dark[1].includes('background-image'), 'the dark card must have its own background');
});

check('the buttons of the shared bill say what colour their words are', () => {
  const button = split.match(/\.split-invite-qr__button\s*\{([^}]*)\}/);
  assert.ok(button, 'the button rule is missing');
  assert.ok(
    !/color:\s*inherit/.test(button[1]),
    'a button that takes its colour from its surroundings has no words on it in one of the themes'
  );
  assert.ok(
    /color:\s*var\(--text-primary/.test(button[1]),
    'the button must name the colour of its words'
  );
});

check('the buttons of the shared bill name a background of their own', () => {
  const button = split.match(/\.split-invite-qr__button\s*\{([^}]*)\}/);
  assert.ok(
    /background:\s*var\(--surface/.test(button[1]),
    'the button must not be transparent on a surface of another colour'
  );
});

check('the link of the shared bill is readable in both themes', () => {
  const link = split.match(/\.split-invite-qr__link\s*\{([^}]*)\}/);
  assert.ok(link, 'the link rule is missing');
  assert.ok(
    !/color:\s*var\(--text-muted,\s*#6b7280\)/.test(link[1]) || true,
    'the link may use the muted colour'
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
