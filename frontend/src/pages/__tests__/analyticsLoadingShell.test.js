/**
 * A page must not unmount its own controls while it loads.
 *
 * The bug this guards, exactly as it reached production: clicking
 * "Rentang Tanggal Kustom" on /analytics did nothing. The button was
 * wired correctly, the panel markup was correct, and every unit test
 * passed - because the fault was nowhere near the filter bar.
 *
 * Analytics began with:
 *
 *   if (loading) return <Spinner/>;
 *
 * which replaces the WHOLE page, filter bar included. Choosing a
 * range calls setRange, which re-fetches, which sets loading, which
 * unmounted DateRangeFilterBar. An unmounted component loses its
 * state, so `open` went back to false and the studio closed in the
 * same tick it opened. The reader saw a dead button.
 *
 * The rule: a control that owns state must stay mounted across a
 * re-fetch that the control itself triggers. The spinner replaces the
 * CONTENT, never the controls.
 *
 * Run with: node src/pages/__tests__/analyticsLoadingShell.test.js
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

const ANALYTICS = read('src/pages/Analytics.jsx');

console.log('the analytics page keeps its controls mounted while loading');

check('the page never returns early with a bare spinner', () => {
  // `if (loading) { return <Spinner .../> }` before the real return
  // is the exact shape that unmounted the filter bar.
  assert.ok(
    !/if\s*\(\s*loading\s*\)\s*\{\s*return\s*\(/.test(ANALYTICS),
    'no early return that swaps the whole page for a spinner'
  );
});

check('the filter bar is rendered unconditionally, not behind !loading', () => {
  const i = ANALYTICS.indexOf('<DateRangeFilterBar');
  assert.ok(i > -1, 'the page renders the filter bar');

  // Walk back to the nearest JSX conditional and make sure the bar is
  // not inside a `{!loading && ...}` / `{loading ? ... }` wrapper.
  const before = ANALYTICS.slice(Math.max(0, i - 400), i);
  assert.ok(
    !/\{\s*!?\s*loading\s*(&&|\?)[^}]*$/.test(before),
    'the filter bar is not gated on the loading flag'
  );
});

check('the spinner is rendered inline, after the filter bar', () => {
  const bar = ANALYTICS.indexOf('<DateRangeFilterBar');
  const spinner = ANALYTICS.indexOf('data-testid="analytics-loading"');
  assert.ok(spinner > -1, 'there is an inline loading block');
  assert.ok(spinner > bar, 'the spinner comes after the filter bar, not instead of the page');
});

check('the spinner is the one thing shown while loading', () => {
  assert.ok(
    /\{loading && \(\s*<div className="flex items-center justify-center h-64"/.test(ANALYTICS),
    'the loading block is a plain conditional, not an early return'
  );
});

check('the content blocks are all held back while loading', () => {
  // Every heavy block must be guarded, or it renders empty cards
  // underneath the spinner.
  for (const marker of [
    '{!loading && health && (',
    '{!loading && dailySpending?.days?.length ? (',
    '{!loading && (\n        <div className="grid lg:grid-cols-2 gap-5">',
    '{!loading && fintech && (',
    '{!loading && visible.length === 0 && (',
  ]) {
    assert.ok(
      ANALYTICS.includes(marker),
      `the block starting "${marker.slice(0, 40)}" waits for the data`
    );
  }
});

check('choosing a range still re-fetches', () => {
  // The fix must not have cut the wire it was protecting.
  assert.ok(/const dateParams = useMemo\(\(\) => rangeParams\(range\)/.test(ANALYTICS));
  assert.ok(/\}, \[period, t, dateParams\]\)/.test(ANALYTICS), 'the fetch depends on the dates');
});

check('the filter bar still lifts its choice up to the page', () => {
  assert.ok(
    /onChange=\{\(next\) => \{\s*setRange\(next\);/.test(ANALYTICS),
    'the page takes the new range'
  );
});

/* --- the general rule, checked across the app ------------------------- */

check('no page unmounts a stateful filter control behind a loading flag', () => {
  // A page that renders one of these stateful controls must not also
  // return early on `loading`. These controls own open/draft state
  // that an unmount would silently discard.
  const STATEFUL_CONTROLS = ['<DateRangeFilterBar'];
  const pagesDir = path.join(ROOT, 'src', 'pages');

  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(full);
        continue;
      }
      if (!entry.name.endsWith('.jsx')) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (!STATEFUL_CONTROLS.some((c) => text.includes(c))) continue;
      if (/if\s*\(\s*loading\s*\)\s*\{\s*return\s*\(/.test(text)) {
        offenders.push(path.relative(ROOT, full));
      }
    }
  };
  walk(pagesDir);

  assert.deepEqual(
    offenders,
    [],
    `a page with a stateful filter must not early-return on loading: ${offenders.join(', ')}`
  );
});

console.log('');
console.log(`analytics loading shell: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
