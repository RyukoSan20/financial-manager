/**
 * Phase 2: the Kakeibo companion and the hover board.
 *
 * Three things are held here:
 *
 * - the companion is a flat stationery drawing - one warm-brown
 *   outline, round shapes, pastel fills - and not the old sixteen
 *   pixel grid;
 * - the hover board is a stationery postcard that measures where it
 *   is, so it is never clipped off the side of the screen;
 * - and the stamp card is seven slots that fill with the reader's
 *   own days.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', '..');
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failed += 1; console.error(`not ok - ${name}`); console.error(`  ${err.message}`); }
};

const MASCOT = read('components/mascot/KanaheiStationeryMascot.jsx');
const BOARD = read('components/ui/KakeiboHoverBoard.jsx');
const STAMPS = read('components/goals/KanaheiStampRallyCard.jsx');
const RIGGED = read('components/mascot/RiggedSvgMascot.jsx');
const CSS = read('styles/mascot-motion.css');

// ---------------------------------------------------------------------------
// The companion
// ---------------------------------------------------------------------------

check('the companion is one flat vector, not a pixel grid', () => {
  assert.ok(MASCOT.includes('viewBox="0 0 120 120"'), 'the 120x120 vector viewBox');
  assert.ok(!MASCOT.includes('shape-rendering="crispEdges"'), 'no crisp pixel edges');
  assert.ok(!MASCOT.includes('<rect'), 'no pixel rectangles');
});

check('the companion is drawn in named parts, so each can move', () => {
  for (const group of ['kanahei-shadow', 'kanahei-ears', 'kanahei-body', 'kanahei-face', 'kanahei-prop']) {
    assert.ok(MASCOT.includes(`className="${group}"`), group);
  }
});

check('the outline is one warm stationery brown', () => {
  assert.ok(MASCOT.includes("outline: '#4A3F35'"), 'the warm brown outline');
  assert.ok(MASCOT.includes("body: '#FFFDF9'"), 'the cream body');
  assert.ok(MASCOT.includes("cheek: '#F7B2AD'"), 'the soft pink cheeks');
  assert.ok(MASCOT.includes("sage: '#52796F'"), 'the sage accents');
  assert.ok(MASCOT.includes("coin: '#F4E285'"), 'the butter coin');
  assert.ok(MASCOT.includes('strokeWidth="3"'), 'a thick clean outline');
});

check('the cheeks are pink and have no outline of their own', () => {
  assert.ok(MASCOT.includes('cx="38"'), 'the left cheek');
  assert.ok(MASCOT.includes('cx="82"'), 'the right cheek');
  assert.ok(MASCOT.includes('fill={kanaheiColours.cheek}'), 'the cheek fill');
});

check('the eyes blink on a timer, and the mouth has a mood', () => {
  assert.ok(MASCOT.includes('BLINK_MS = 3200'), 'the three second blink');
  assert.ok(MASCOT.includes('blinking ?'), 'the blink swaps the drawing');
  assert.ok(MASCOT.includes("Q60 80 70 70") || MASCOT.includes('Q 60 80 70 70'), 'the happy mouth');
});

check('the prop changes with the mode and the mood', () => {
  assert.ok(MASCOT.includes("mode === 'business'"), 'the business coin');
  assert.ok(MASCOT.includes('kanahei-stars'), 'the stars for a happy character');
  assert.ok(MASCOT.includes("mood === 'happy' || mood === 'celebrate'"), 'the good moods get stars');
});

check('the companion opens the hover board and hops when it is greeted', () => {
  assert.ok(MASCOT.includes('<KakeiboHoverBoard'), 'the board is there');
  assert.ok(MASCOT.includes('setBoardOpen'), 'it opens');
  assert.ok(MASCOT.includes('hop()'), 'it hops');
  assert.ok(MASCOT.includes('-translate-y-1.5'), 'the hop lifts it six pixels');
});

check('the reflection is written in every language', () => {
  for (const lang of ['id', 'en', 'ja']) {
    assert.ok(MASCOT.includes(`${lang}: {`), `the ${lang} tip`);
  }
  for (const mood of ['idle', 'happy', 'celebrate', 'alert']) {
    assert.ok(MASCOT.includes(`${mood}:`), `the ${mood} tip`);
  }
});

// ---------------------------------------------------------------------------
// The hover board
// ---------------------------------------------------------------------------

check('the hover board is a stationery postcard', () => {
  assert.ok(BOARD.includes('bg-[#FFFDF9]'), 'the warm cream surface');
  assert.ok(BOARD.includes('dark:bg-[#1E2624]'), 'the dark surface');
  assert.ok(BOARD.includes('border-[#4A3F35]'), 'the warm brown outline');
  assert.ok(BOARD.includes('dark:border-[#3D5A52]'), 'the dark outline');
  assert.ok(BOARD.includes('rounded-[18px]'), 'the rounded corner');
  assert.ok(BOARD.includes('shadow-[0_10px_26px_-4px_rgba(74,63,53,0.14)]'), 'the soft shadow');
});

check('the hover board opens with a spring', () => {
  assert.ok(BOARD.includes('duration-[220ms]'), 'the entry time');
  assert.ok(BOARD.includes('cubic-bezier(0.16,1,0.3,1)'), 'the spring curve');
});

check('the hover board is never clipped off the screen', () => {
  assert.ok(BOARD.includes('min-w-[200px]'), 'the minimum width');
  assert.ok(BOARD.includes('max-w-[260px]'), 'the maximum width');
  assert.ok(BOARD.includes('whitespace-normal'), 'the text wraps');
  assert.ok(BOARD.includes('break-words'), 'a long word does not overflow');
  assert.ok(BOARD.includes('z-40'), 'it is above the page');
  assert.ok(BOARD.includes("setFlip"), 'it measures the edge');
  assert.ok(BOARD.includes('right-0 translate-x-0'), 'and opens the other way near the right edge');
});

check('the hover board takes the props it is meant to take', () => {
  for (const prop of ['title', 'subtitle', 'badge', 'metrics', 'actionLabel', 'onAction', 'position', 'children']) {
    assert.ok(BOARD.includes(prop), `the ${prop} prop`);
  }
});

// ---------------------------------------------------------------------------
// The stamp card
// ---------------------------------------------------------------------------

check('the stamp card has seven slots', () => {
  assert.ok(STAMPS.includes('length: 7'), 'seven days');
  assert.ok(STAMPS.includes('stamp_day'), 'each slot is named');
});

check('a filled stamp is a paw or a leaf, in the Kakeibo colours', () => {
  assert.ok(STAMPS.includes("'#52796F'"), 'the sage stamp');
  assert.ok(STAMPS.includes("'#E07A5F'"), 'the terracotta stamp');
  assert.ok(STAMPS.includes('PawStamp'), 'the paw');
  assert.ok(STAMPS.includes('LeafStamp'), 'the leaf');
});

check('a stamp opens the hover board with its episode', () => {
  assert.ok(STAMPS.includes('<KakeiboHoverBoard'), 'the board is there');
  assert.ok(STAMPS.includes('stamp_episode_'), 'the episode text');
});

// ---------------------------------------------------------------------------
// The wiring
// ---------------------------------------------------------------------------

check('the shoujo drawing is the default, and the older two are kept', () => {
  // Phase 3: the shoujo companion is the default. The flat Kakeibo
  // drawing this file is about is still rendered, by name, and so is
  // the old pixel grid.
  assert.ok(RIGGED.includes("variant = 'shoujo'"), 'the shoujo drawing is the default');
  assert.ok(RIGGED.includes('<ClampShoujoMascot'), 'and it is drawn');
  assert.ok(RIGGED.includes("variant !== 'pixel'"), 'the flat drawing is still drawn');
  assert.ok(RIGGED.includes('<KanaheiStationeryMascot'), 'it is still the Kakeibo one');
  assert.ok(RIGGED.includes('variant="kanahei"'), 'reachable by name');
  assert.ok(RIGGED.includes('variant="pixel"'), 'the old grid is still there');
});

check('the old contract still holds - the props, the ref and the test ids', () => {
  for (const prop of ['state', 'mood', 'mode', 'size', 'message', 'lines', 'label', 'initialFrame']) {
    assert.ok(RIGGED.includes(prop), `the ${prop} prop`);
  }
  for (const method of ['cheer', 'nod', 'warn']) {
    assert.ok(RIGGED.includes(`${method}:`), `the ${method} method`);
  }
  assert.ok(RIGGED.includes('      say,'), 'the say method');
  for (const attribute of ['data-state', 'data-mode', 'data-frame']) {
    assert.ok(RIGGED.includes(attribute), `the ${attribute} attribute`);
  }
  assert.ok(RIGGED.includes('mascot-bubble'), 'the speech bubble');
  assert.ok(RIGGED.includes('mascot-float'), 'the bob');
});

check('the stylesheet moves the new parts', () => {
  for (const rule of ['.kanahei-ears', '.kanahei-stars', '.kanahei-shadow', '.kanahei-board']) {
    assert.ok(CSS.includes(rule), rule);
  }
  for (const keyframe of ['kanaheiEarWiggle', 'kanaheiStars', 'kanaheiShadow', 'kanaheiBoardIn']) {
    assert.ok(CSS.includes(keyframe), keyframe);
  }
});

console.log('');
console.log(`the kakeibo companion: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
