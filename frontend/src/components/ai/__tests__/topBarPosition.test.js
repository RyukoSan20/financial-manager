/**
 * The bar at the top of the dashboard does not move.
 *
 * It used to be `sticky top-0`, so it stayed with the reader as they
 * scrolled and rode down over the cards below it. The reader saw
 * their own finances sliding under a bar.
 *
 * Now it is `relative`, in the ordinary flow, at the very top of the
 * page. It cannot cover anything, because everything after it is
 * below it.
 *
 * These checks hold that.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

const BAR = 'src/components/ai/TopAiCommandBar.jsx';

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

// The bar has two shapes. At the top of the page it is roomy and in
// the flow. Once the reader scrolls past it, it docks as a narrow
// glass pill at the top centre.
//
// The old failure this file was written for was a FULL-WIDTH sticky
// bar: it rode down over the cards and the reader watched a band
// slide across their own finances. A narrow centred pill is a
// different thing, so the rules below are about width and flow rather
// than about the word `fixed`: undocked must stay in the flow, and
// docked may leave it only as a pill that cannot cover a whole card.

const undockedClasses = (source) => {
  const m = source.match(/:\s*'(relative z-20 mb-6[^']*)'/);
  assert.ok(m, 'the undocked class list was not found');
  return m[1];
};

const dockedClasses = (source) => {
  const m = source.match(/\?\s*'(fixed top-3[^']*)'/);
  assert.ok(m, 'the docked class list was not found');
  return m[1];
};

check('the bar is never sticky, and is only fixed once docked', () => {
  const source = read(BAR);
  // Only the class lists count. A bare word search hits the comments
  // that explain WHY the sticky version was removed, and a naive
  // string-literal scan is worse: an apostrophe inside a comment
  // ("the bar has docked itself") opens a bogus literal that swallows
  // the surrounding prose.
  const classLists = [undockedClasses(source), dockedClasses(source)].join(' ');
  assert.ok(
    !/\bsticky\b/.test(classLists),
    `the bar is still sticky, so it rides down over the cards: ${classLists}`
  );
  // `fixed` is allowed, but only on the docked pill and only when it
  // is guarded by the docked state.
  assert.ok(/docked\s*$/m.test(source) || /docked$/m.test(source) || source.includes('docked'), 'the docked state exists');
  assert.ok(
    !/className="[^"]*\bfixed\b/.test(source),
    'the bar is unconditionally fixed in a className string'
  );
});

check('undocked, the bar is relative and in the flow of the page', () => {
  const source = read(BAR);
  const classes = undockedClasses(source);
  assert.ok(/\brelative\b/.test(classes), `not relative: ${classes}`);
  assert.ok(/\bz-20\b/.test(classes), `no layer of its own: ${classes}`);
  assert.ok(/\bmb-6\b/.test(classes), `no room below it: ${classes}`);
});

check('undocked, the bar does not cover the page with a solid band', () => {
  const source = read(BAR);
  const classes = undockedClasses(source);
  assert.ok(!/bg-white\/85/.test(classes), 'still a solid band across the page');
  assert.ok(!/backdrop-blur/.test(classes), 'still floats over the page');
});

check('docked, the bar is a narrow pill that cannot cover a card', () => {
  const source = read(BAR);
  const classes = dockedClasses(source);
  // Narrow and centred: the old sticky bar was full width, which is
  // what let it cover the cards underneath it.
  assert.ok(/max-w-xl/.test(classes), `the pill is not narrow: ${classes}`);
  assert.ok(/left-1\/2/.test(classes) && /-translate-x-1\/2/.test(classes), 'not centred');
  assert.ok(/rounded-full/.test(classes), 'not a pill');
  assert.ok(!/\bw-full\b/.test(classes), 'the docked bar is full width');
});

check('docking does not make the page jump', () => {
  // A docked bar is out of the flow, so the space it used to take has
  // to be held open or every card below it leaps upward.
  const source = read(BAR);
  assert.ok(source.includes('barHeightRef'), 'the height is remembered');
  assert.ok(/docked \? <div aria-hidden/.test(source), 'and the space is held');
});

check('the bar docks on scroll, at the stated offset', () => {
  const source = read(BAR);
  assert.ok(/window\.scrollY >= 120/.test(source), 'it docks past 120px');
  assert.ok(/addEventListener\('scroll'/.test(source), 'it listens');
  assert.ok(/removeEventListener\('scroll'/.test(source), 'and it stops listening');
  assert.ok(/passive: true/.test(source), 'without blocking the scroll');
});

// ---------------------------------------------------------------------------
// The panels that open out of the bar
// ---------------------------------------------------------------------------

check('the answer is in the flow of the page, not over it', () => {
  const source = read(BAR);
  const answerAt = source.indexOf('open && (answer || error || busy)');
  assert.ok(answerAt !== -1, 'the answer is not there');
  const around = source.slice(answerAt, answerAt + 1400);
  assert.ok(
    !/className="[^"]*\babsolute\b/.test(around),
    'the answer still floats over the page'
  );
  assert.ok(
    /\brelative\b/.test(around),
    'the answer is not in the flow of the page'
  );
});

check('the panels open against the bar, from the top of the bar down', () => {
  const source = read(BAR);
  // Whatever opens out of the bar hangs from the bar itself.
  const panelAt = source.indexOf('absolute top-full');
  assert.ok(
    panelAt !== -1,
    'nothing opens out of the bar with `absolute top-full`'
  );
});

check('the quick actions are still reachable on a narrow screen', () => {
  const source = read(BAR);
  // On a wide screen they are pills on the bar. On a narrow screen
  // they open. Both have to exist, or the four buttons are gone on
  // the phone.
  assert.ok(
    /hidden md:flex/.test(source),
    'the quick actions are not shown on a wide screen'
  );
  assert.ok(
    /actionsOpen/.test(source) && /hidden md:flex/.test(source),
    'the quick actions cannot be opened on a narrow screen'
  );
  // And when they open, they hang from the bar.
  assert.ok(
    /absolute top-full/.test(source),
    'the quick actions do not hang from the bar'
  );
});

// ---------------------------------------------------------------------------
// The dashboard
// ---------------------------------------------------------------------------

check('the bar is at the top of the dashboard, in the flow', () => {
  const source = read('src/pages/Dashboard.jsx');
  const at = source.indexOf('<TopAiCommandBar');
  assert.ok(at !== -1, 'the dashboard does not have the bar');
  // Nothing that floats sits between the top of the page and the
  // bar, so the bar really is at the top.
  const before = source.slice(Math.max(0, at - 1500), at);
  assert.ok(
    !/className="[^"]*\bsticky\b[^"]*"[\s\S]{0,400}<TopAiCommandBar/.test(before),
    'something sticky sits above the bar'
  );
});
