/**
 * The motion system has to be wired to something.
 *
 * A stylesheet full of rules that no component asks for is a
 * stylesheet that does nothing - that is the exact failure
 * `interfaceFeel.test.js` was written for, and the motion system is
 * big enough to repeat it. `motion-x-spring` was defined, imported,
 * shipped in the bundle, and applied to exactly one file.
 *
 * So these checks are about the wiring, not the look:
 *
 * - every class the motion system defines is asked for by a
 *   component somewhere;
 * - the four reference patterns each reach the surfaces the brief
 *   named (filter pills, progress bars, counters, bento grids);
 * - every animating rule is covered by the reduced-motion guard;
 * - the sheet is actually imported, or none of it runs at all.
 *
 * Run with: node src/styles/__tests__/motionSystem.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const SRC = path.join(ROOT, 'src');

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

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
};

const files = walk(SRC);
const components = files
  .filter((f) => /\.jsx?$/.test(f) && !f.includes('__tests__'))
  .map((f) => ({ path: path.relative(SRC, f), text: fs.readFileSync(f, 'utf8') }));
const usersOf = (cls) => components.filter((f) => f.text.includes(cls)).map((f) => f.path);

const MOTION = read('src/styles/motion-system.css');

console.log('the motion system is wired to real surfaces');

/* --- the sheet has to be loaded ---------------------------------------- */

check('the motion sheet is imported, or none of it runs', () => {
  const main = read('src/main.jsx');
  assert.ok(
    /motion-system\.css/.test(main),
    'main.jsx imports the motion sheet'
  );
});

/* --- every class defined has to be asked for --------------------------- */

check('every class the sheet defines is used by a component', () => {
  // The class selectors the sheet defines, minus the BEM-ish children
  // and state classes that are applied by their own parent rule.
  const defined = new Set(
    [...MOTION.matchAll(/^\.([a-z][a-z0-9-]*)/gm)].map((m) => m[1])
  );
  const orphans = [...defined].filter((cls) => usersOf(cls).length === 0);
  assert.deepEqual(
    orphans,
    [],
    `every motion class is asked for by something, orphans: ${orphans.join(', ')}`
  );
});

/* --- pattern 1: X-style spring on pills and buttons -------------------- */

check('the X spring reaches more than one surface', () => {
  const users = usersOf('motion-x-spring');
  assert.ok(
    users.length >= 3,
    `the spring is on at least three surfaces, found ${users.length}: ${users.join(', ')}`
  );
});

check('the X spring is on the shared button, so it reaches every action', () => {
  assert.ok(
    read('src/components/ui/Button.jsx').includes('motion-x-spring'),
    'the shared Button carries the spring'
  );
});

check('the X spring is on the date filter pills', () => {
  assert.ok(
    read('src/components/analytics/DateRangeFilterBar.jsx').includes('motion-x-spring'),
    'the analytics filter pills spring'
  );
});

check('the dashboard timeframe pills spring too', () => {
  assert.ok(
    read('src/pages/Dashboard.jsx').includes('motion-x-spring'),
    'the dashboard period pills spring'
  );
});

check('the spring uses the overshooting curve, not a linear slide', () => {
  assert.ok(
    MOTION.includes('cubic-bezier(0.34, 1.56, 0.64, 1)'),
    'the spring overshoots'
  );
  assert.ok(/scale\(0\.93\)/.test(MOTION), 'a press scales to 0.93');
  assert.ok(/scale\(1\.04\)/.test(MOTION), 'and settles past its own size');
});

/* --- pattern 2: YouTube-style scrubbing bars --------------------------- */

check('the scrubbing bar reaches the progress primitives', () => {
  const users = usersOf('motion-scrub-bar');
  assert.ok(
    users.length >= 2,
    `the scrub bar is on at least two surfaces, found: ${users.join(', ')}`
  );
});

check('the bar grows and glows rather than just changing colour', () => {
  assert.ok(/height:\s*0\.875rem/.test(MOTION), 'it grows on hover');
  assert.ok(/box-shadow:\s*0 0 14px rgba\(82, 121, 111, 0\.35\)/.test(MOTION), 'it glows');
});

check('the bar answers touch and keyboard, not only the mouse', () => {
  assert.ok(/:focus-within/.test(MOTION), 'a keyboard reader gets the same affordance');
  assert.ok(/is-scrubbing/.test(MOTION), 'a touch can drive it too');
});

/* --- pattern 3: Apple/Stripe rolling counters -------------------------- */

check('the rolling counter entrance is on the shared counter', () => {
  assert.ok(
    read('src/components/ui/CountUpNumber.jsx').includes('motion-roll-in'),
    'CountUpNumber carries the roll'
  );
});

check('the roll replays when the value changes, not only on first mount', () => {
  const counter = read('src/components/ui/CountUpNumber.jsx');
  // A class on a stable element would not re-run its animation; the
  // element has to be remounted, which is what the key change does.
  assert.ok(/key=\{rollRef\.current\}/.test(counter), 'the element is remounted per value');
  assert.ok(/lastTargetRef/.test(counter), 'the previous target is tracked');
});

check('the roll is 650ms on the reference easing curve', () => {
  assert.ok(
    /animation: motion-roll-in 650ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/.test(MOTION),
    'the brief asked for 650ms and that curve'
  );
  assert.ok(/translateY\(6px\)/.test(MOTION), 'it slides in vertically from 6px');
});

check('the counter still respects a reader who asked for less movement', () => {
  const counter = read('src/components/ui/CountUpNumber.jsx');
  assert.ok(
    /prefersReducedMotion/.test(counter),
    'the count itself is skipped for a reduced-motion reader'
  );
});

/* --- pattern 4: Linear-style staggered cascade ------------------------- */

check('the cascade reaches the three pages the brief named', () => {
  for (const page of [
    'src/pages/Analytics.jsx',
    'src/pages/Dashboard.jsx',
    'src/components/health/CuteWellnessBento.jsx',
  ]) {
    assert.ok(read(page).includes('bento-cascade'), `${page} cascades`);
  }
});

check('the stagger is driven by a per-card index, not a fixed delay', () => {
  assert.ok(/--stagger-index/.test(MOTION), 'the sheet reads a per-card index');
  assert.ok(
    /animation-delay:\s*calc\(var\(--stagger-index\) \* 40ms\)/.test(MOTION),
    'the brief asked for 40ms per card'
  );
  const setters = components.filter((f) => /'--stagger-index'/.test(f.text));
  assert.ok(
    setters.length >= 3,
    `at least three grids set the index, found ${setters.length}`
  );
});

check('the cascade fades up from 10px, as the brief described', () => {
  const kf = MOTION.slice(MOTION.indexOf('@keyframes bentoFadeUp'));
  assert.ok(/opacity: 0/.test(kf) && /translateY\(10px\)/.test(kf), 'from');
  assert.ok(/opacity: 1/.test(kf) && /translateY\(0\)/.test(kf), 'to');
});

/* --- nothing animates every property ----------------------------------- */

check('the motion sheet never animates every property', () => {
  assert.ok(!/transition:\s*all\b/.test(MOTION), 'no transition: all');
});

/* --- every animating rule is guarded ----------------------------------- */

check('every class the sheet animates is covered by the reduced-motion guard', () => {
  // The guard is the @media block, not the mention of it in the
  // header comment - searching for the bare phrase finds the comment
  // first and leaves an empty body to scan.
  const guardStart = MOTION.search(/@media[^{]*prefers-reduced-motion/);
  assert.ok(guardStart > -1, 'there is a reduced-motion @media block');
  const guard = MOTION.slice(guardStart);
  const body = MOTION.slice(0, guardStart);

  // Every class that carries an animation or a transition. Comments
  // are stripped first, so a commented-out rule is not counted.
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const animating = new Set();
  for (const m of clean.matchAll(/\.([a-z][a-z0-9-]*)[^{}]*\{([^}]*)\}/g)) {
    if (/(^|[\s;])(animation|transition):/.test(m[2])) animating.add(m[1]);
  }
  assert.ok(animating.size >= 4, `the sheet animates several classes, found ${animating.size}`);

  const unguarded = [...animating].filter((cls) => !guard.includes(cls));
  assert.deepEqual(
    unguarded,
    [],
    `every animating class is in the guard, missing: ${unguarded.join(', ')}`
  );
});

console.log('');
console.log(`motion system: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
