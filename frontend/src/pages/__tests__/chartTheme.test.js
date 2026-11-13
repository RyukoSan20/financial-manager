/**
 * The charts follow the theme too.
 *
 * A chart is pixels, not text nodes, so a DOM contrast sweep walks
 * straight past it. Reading the canvas directly is the only thing that
 * finds these.
 *
 * What the live site showed, on the dashboard in BOTH modes:
 *
 *   rgb(107,114,128)   725 pixels   the crosshair and the axis text
 *
 * The same value in light and dark. A canvas that does not change
 * when the theme changes is a canvas drawn for one theme only, and on
 * the dark page that crosshair and those axis labels sit on a dark
 * card at 3.67:1.
 *
 * The cause was a palette object with a `dark` half that nothing read:
 * `CHART_COLORS.crosshair` was always used, and `CHART_COLORS.dark`
 * existed only to be dead.
 *
 * Run with: node src/pages/__tests__/chartTheme.test.js
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

const DASH = read('src/pages/Dashboard.jsx');

console.log('the charts follow the theme');

check('the dark half of the chart palette is actually read', () => {
  // The object existed and nothing asked it for, so the crosshair was
  // the light value on a dark page.
  assert.ok(
    /CHART_COLORS\.dark\.crosshair/.test(DASH),
    'the dark crosshair is used when the page is dark'
  );
  assert.ok(
    /CHART_COLORS\.dark\.grid/.test(DASH) || /gridColor = isDark/.test(DASH),
    'the dark grid is used when the page is dark'
  );
});

check('the crosshair picks a different colour in each mode', () => {
  const light = DASH.match(/crosshair:\s*'(#[0-9a-fA-F]{3,6})'/);
  const dark = DASH.match(/crosshair:\s*'(#[0-9a-fA-F]{3,6})'/g) || [];
  assert.ok(light, 'a light crosshair colour exists');
  assert.ok(dark.length >= 2, 'and a dark one - two crosshair colours in total');
  assert.notEqual(light[1], dark[1], 'they are not the same value');
});

check('the axis text colour follows the mode', () => {
  assert.ok(
    /const textColor = isDark \? /.test(DASH),
    'the text colour is chosen from the mode'
  );
});

check('the zero baseline is visible in both modes', () => {
  // Decorative rather than text, so it is not held to the body-text
  // floor - but it has to be visible. It used to be #6b7280 in the
  // dark mode and #9ca3af in the light one, which is backwards: a dim
  // grey line on a dark card is harder to see than on cream.
  assert.ok(
    /color: '#9ca3af',\s*\n\s*lineWidth: 1,\s*\n\s*lineStyle: LineStyle\.Dashed,\s*\n\s*title: 'Baseline'/.test(DASH),
    'the baseline is the same visible grey in both modes'
  );
});

check('the chart palette is an accessor, not a constant', () => {
  // `const COLORS = chartPalette` is right - it keeps the function.
  // `const COLORS = chartPalette()` would capture the scheme that was
  // on when the module was imported, before the appearance was applied.
  const analytics = read('src/pages/Analytics.jsx');
  assert.ok(/const COLORS = chartPalette;/.test(analytics), 'the accessor is kept');
  assert.ok(!/const COLORS = chartPalette\(\)/.test(analytics), 'and not called at module load');
  assert.ok(/COLORS\(\)\[/.test(analytics), 'it is called at render time');
});

check('the brand series follows the scheme, the semantic ones do not', () => {
  // The savings line is this app's accent; income and expense mean the
  // same thing in every scheme.
  assert.ok(/income: '#22c55e'/.test(DASH), 'income stays green');
  assert.ok(/expense: '#ef4444'/.test(DASH), 'expense stays red');
  assert.ok(/savingsColor\(\)/.test(DASH), 'the savings line reads the scheme at render time');
});

console.log('');
console.log(`chart theme: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
