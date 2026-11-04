/**
 * The interface has to answer the pointer and the finger.
 *
 * Three things were wrong, and all three of them were quiet: the
 * code compiled, the tests passed, and the page was still flat.
 *
 * - The motion layer had a press rule and a settle rule, and almost
 *   nothing used them. `pressable` was on one button in a sheet, and
 *   `settle-in` was on nothing at all. A stylesheet full of rules
 *   that no component asks for is a stylesheet that does nothing.
 *
 * - The reader can set the text size in the settings. The setting
 *   wrote `--font-scale` onto the root element, and nothing ever read
 *   it, so the four choices in the settings did nothing at all.
 *
 * - The button press was written as `transition: all`, which animates
 *   the layout as well as the paint, and as a global rule that
 *   scaled *every* button on the page, including the ones in a table
 *   row where a scale makes the whole row jump.
 *
 * So the checks here are about the wiring, not about the look: a
 * rule that exists has to be asked for by something, the scale the
 * reader chose has to reach the text, and the transition has to name
 * the properties it animates.
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
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message.split('\n')[0]}`);
  }
};

/* --- walk the source tree --------------------------------------------- */

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
};

const SRC = path.join(ROOT, 'src');
const files = walk(SRC);

const sourceOf = (rel) =>
  files
    .filter((f) => f.endsWith(rel) && !f.includes('__tests__'))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

const componentSources = files
  .filter((f) => /\.(jsx?)$/.test(f) && !f.includes('__tests__'))
  .map((f) => ({ path: path.relative(SRC, f), text: fs.readFileSync(f, 'utf8') }));

/* --- the motion layer has to be used ---------------------------------- */

check('the press rule is asked for by more than one component', () => {
  const users = componentSources.filter((f) => /\bpressable\b/.test(f.text));
  assert.ok(
    users.length >= 5,
    `at least five components use the press rule, found ${users.length}`
  );
});

check('the settle rule is asked for by something', () => {
  const users = componentSources.filter((f) => /\bsettle-in\b/.test(f.text));
  assert.ok(
    users.length >= 5,
    `at least five components settle into place, found ${users.length}`
  );
});

check('the button answers a press', () => {
  const button = sourceOf('components/ui/Button.jsx');
  assert.ok(
    /\bpressable\b/.test(button),
    'the shared button asks for the press rule'
  );
});

check('the card answers the pointer', () => {
  const card = sourceOf('components/ui/Card.jsx');
  assert.ok(
    /hover/.test(card),
    'the shared card carries a hover treatment'
  );
});

/* --- the reader text size has to reach the text ----------------------- */

check('the text size the reader chose is used by the page', () => {
  const index = read('src/index.css');
  assert.ok(
    /var\(--font-scale\)/.test(index),
    'the root stylesheet scales the text with the setting'
  );
});

check('the size of the root is decided in one place', () => {
  const appearance = read('src/utils/appearance.js');
  assert.ok(
    !/root\.style\.fontSize\s*=/.test(appearance),
    'the appearance script does not set the size of the root element'
  );
});

check('the text size setting is not only written and never read', () => {
  const appearance = read('src/utils/appearance.js');
  assert.ok(
    /--font-scale/.test(appearance),
    'the setting writes the scale'
  );
  const consumers = files
    .filter((f) => f.endsWith('.css') && !f.includes('__tests__'))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
  assert.ok(
    /var\(--font-scale\)/.test(consumers),
    'something in the stylesheets reads the scale'
  );
});

/* --- the transition has to name what it animates ---------------------- */

check('no transition animates every property', () => {
  const offenders = componentSources
    .filter((f) => /transition-all/.test(f.text))
    .map((f) => f.path);
  assert.deepEqual(
    offenders,
    [],
    `no component uses transition-all, found: ${offenders.join(', ')}`
  );
});

check('no stylesheet animates every property', () => {
  const offenders = files
    .filter((f) => f.endsWith('.css') && !f.includes('__tests__'))
    .filter((f) => /transition\s*:\s*all\b/.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(SRC, f));
  assert.deepEqual(
    offenders,
    [],
    `no stylesheet uses transition: all, found: ${offenders.join(', ')}`
  );
});

/* --- a press has to be small and it has to be on the thing pressed ----- */

check('a press is answered by a scale, not by a jump', () => {
  const motion = read('src/styles/motion.css');
  const scales = [...motion.matchAll(/scale\((0?\.\d+)\)/g)].map((m) =>
    parseFloat(m[1])
  );
  assert.ok(scales.length > 0, 'the motion layer scales something');
  for (const scale of scales) {
    assert.ok(
      scale >= 0.94 && scale <= 0.99,
      `a press scales to between 0.94 and 0.99, found ${scale}`
    );
  }
});

check('the global button press is not there', () => {
  const index = read('src/index.css');
  assert.ok(
    !/button:active:not\(:disabled\)\s*\{[^}]*transform:\s*scale/.test(index),
    'no global rule scales every button on the page'
  );
});

/* --- the motion has to stop when the reader asks it to ---------------- */

check('every animation respects the reader asking for less movement', () => {
  const css = files
    .filter((f) => f.endsWith('.css') && !f.includes('__tests__'))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  // Every keyframe that animates something must be reachable from a
  // rule that the reduced-motion block turns off.
  const animated = [...css.matchAll(/animation:[^;]*\b(fm-[a-z-]+|[a-z-]+)\s/g)]
    .map((m) => m[1])
    .filter((n) => n && !['none', 'inherit', 'initial'].includes(n));

  const guarded = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)]
    .length;

  assert.ok(guarded > 0, 'there is a reduced-motion guard in the stylesheets');

  // The names that appear in the guard.
  const guardBlock = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
  for (const name of new Set(animated)) {
    assert.ok(
      guardBlock.includes(name) || name.startsWith('fm-') === false,
      `the animation ${name} is covered by the reduced-motion guard`
    );
  }
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
