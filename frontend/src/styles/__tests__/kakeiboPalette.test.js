/**
 * The Kakeibo palette holds.
 *
 * Phase 1 and Phase 2 replaced the old look - a muddy brown button,
 * a neon lime word on a cream card, a serif heading beside a sans
 * label beside a coding mono number, and neon blur blobs under the
 * page - with a calm Japanese stationery one.
 *
 * These checks hold that. They are cheap and they read the whole
 * stylesheet, so a single stray colour cannot come back.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failed += 1; console.error(`not ok - ${name}`); console.error(`  ${err.message}`); }
};

// Every stylesheet, so nothing hides in a sheet nobody thought of.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
  return out;
}
const CSS_FILES = walk(join(SRC, 'styles')).concat([join(SRC, 'index.css')]);
const allCss = CSS_FILES.map((f) => ({ file: f.slice(SRC.length + 1), text: readFileSync(f, 'utf8') }));

// The retired colours. These are the ones the brief bans.
const BANNED = [
  { hex: '#BEF264', why: 'neon lime' },
  { hex: '#b45309', why: 'muddy brown button' },
  { hex: '#B45309', why: 'muddy brown button' },
  { hex: '#A14A0A', why: 'muddy brown button' },
  { hex: '#a14a0a', why: 'muddy brown button' },
];

check('the retired colours are gone from every stylesheet', () => {
  const hits = [];
  for (const { file, text } of allCss) {
    for (const banned of BANNED) {
      if (text.includes(banned.hex)) {
        // The botanical sheet keeps two selectors that CATCH the old
        // brown, so a page that still names it is repointed.
        if (file.endsWith('botanical.css') && /b45309|a14a0a/i.test(banned.hex)) continue;
        hits.push(`${file}: ${banned.hex} (${banned.why})`);
      }
    }
  }
  assert.deepEqual(hits, [], hits.join('\n      '));
});

check('there is no pure black border on a light card', () => {
  // The brief bans a 1px pure-black border. A black border is written
  // as #000 or #000000.
  const hits = [];
  for (const { file, text } of allCss) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!/border[^;]*#000(000)?\b/i.test(line)) return;
      // A shadow may use black; a border may not.
      if (/box-shadow|drop-shadow/.test(line)) return;
      hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(hits, [], hits.join('\n      '));
});

check('there is no serif and no coding mono left in the application', () => {
  const hits = [];
  for (const { file, text } of allCss) {
    if (/Iowan Old Style|Palatino/.test(text)) hits.push(`${file}: a serif face`);
    if (/font-family:[^;]*ui-monospace/.test(text)) hits.push(`${file}: a coding mono face`);
  }
  assert.deepEqual(hits, [], hits.join('\n      '));
});

check('one font stack, everywhere', () => {
  const index = read('index.css');
  const appearance = read('utils/appearance.js');
  // The root stack.
  assert.ok(
    index.includes("--font-sans: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"),
    'the root --font-sans is the geometric stack'
  );
  // And the numeric stack is the same one, so the money is not a
  // different face.
  assert.ok(
    index.includes("--font-mono: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"),
    'the numeric stack is the same face'
  );
  // Every theme in the picker draws in it too.
  const stacks = [...appearance.matchAll(/stack:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(stacks.length >= 4, 'every theme has a stack');
  for (const stack of stacks) {
    assert.ok(stack.includes('Plus Jakarta Sans'), `the theme stack is the one sans: ${stack}`);
  }
});

check('the canvas is the warm off-white, in every place it is set', () => {
  // The bootstrap and the theme module both write the canvas as an
  // inline style on the root element, which beats every stylesheet -
  // so they have to agree with the stylesheet.
  const html = readFileSync(join(SRC, '..', 'index.html'), 'utf8');
  const theme = read('utils/theme.js');
  assert.ok(html.includes("'#FAF9F6'"), 'the bootstrap canvas is the warm off-white');
  assert.ok(theme.includes("'#FAF9F6'"), 'the theme module canvas is the warm off-white');
  assert.ok(!html.includes('#f9fafb'), 'the old cold grey canvas is gone from the bootstrap');
  assert.ok(!theme.includes('#f9fafb'), 'the old cold grey canvas is gone from the theme module');
});

check('the light mode has no neon blur blobs', () => {
  const aurora = read('styles/aurora.css');
  assert.ok(
    aurora.includes('html:not(.dark)[data-ui-aurora="on"] .aurora-blob'),
    'the light mode rules out the blobs'
  );
  const block = aurora.slice(aurora.indexOf('html:not(.dark)[data-ui-aurora="on"] .aurora-blob'));
  assert.ok(block.includes('display: none !important'), 'the blobs are not drawn in the light mode');
});

check('the forest ticket is a readable surface in both modes', () => {
  const bot = read('styles/botanical.css');
  assert.ok(bot.includes('background: #2F4842 !important'), 'the ticket surface is pinned');
  assert.ok(bot.includes('#FFF8E7'), 'the amount is warm cream');
  assert.ok(bot.includes('#EDE6D6'), 'the caption is a readable cream');
  // The dark mode does not swap the surface for a light one.
  const darkBlock = bot.slice(bot.indexOf('.dark {'));
  assert.ok(!darkBlock.includes('background: #F4F1EA'), 'the dark mode does not lighten the ticket');
});

check('the Kakeibo palette is the one that is written down', () => {
  const bot = read('styles/botanical.css');
  for (const hex of ['#FAF9F6', '#FFFFFF', '#EAE6DF', '#52796F', '#2F4842', '#F4F1EA', '#E07A5F', '#2D312E']) {
    assert.ok(bot.includes(hex), `${hex} is in the palette`);
  }
});

console.log('');
console.log(`the kakeibo palette: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
