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

check('the bar is not sticky', () => {
  const source = read(BAR);
  assert.ok(
    !/className="[^"]*\bsticky\b/.test(source),
    'the bar is still sticky, so it rides down over the cards'
  );
  assert.ok(
    !/className="[^"]*\bfixed\b/.test(source),
    'the bar is still fixed, so it rides down over the cards'
  );
});

check('the bar is relative and in the flow of the page', () => {
  const source = read(BAR);
  const wrapper = source.match(/className="([^"]*)"[^>]*aria-label=\{label\}/);
  assert.ok(wrapper, 'the wrapper of the bar was not found');
  const classes = wrapper[1];
  assert.ok(
    /\brelative\b/.test(classes),
    `the wrapper is not relative: ${classes}`
  );
  assert.ok(
    /\bz-20\b/.test(classes),
    `the wrapper has no layer of its own: ${classes}`
  );
  assert.ok(
    /\bmb-6\b/.test(classes),
    `the wrapper does not leave room below it: ${classes}`
  );
});

check('the bar does not cover the page with a solid band', () => {
  // It used to carry a full-width background and a border, which is
  // what made it read as a floating band over the cards. Now it is
  // just a bar in the flow.
  const source = read(BAR);
  const wrapper = source.match(/className="([^"]*)"[^>]*aria-label=\{label\}/);
  const classes = wrapper[1];
  assert.ok(
    !/bg-white\/85/.test(classes),
    'the wrapper is still a solid band across the page'
  );
  assert.ok(
    !/backdrop-blur/.test(classes),
    'the wrapper still floats over the page'
  );
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
