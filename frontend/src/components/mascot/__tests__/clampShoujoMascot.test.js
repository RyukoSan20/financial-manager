/**
 * The shoujo companion.
 *
 * Two kinds of check:
 *
 * - the component is really drawn, both personas, bundled and
 *   rendered to a string the way a server would render it, so a
 *   drawing that throws fails here rather than in front of a reader;
 * - the art rules are read from the source: the proportions, the
 *   seven eye layers, the lineart colour, the sticker filter, and the
 *   five motion channels in the stylesheet.
 *
 * Run with: node src/components/mascot/__tests__/clampShoujoMascot.test.js
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..', '..');
const read = (relative) => readFileSync(join(FRONTEND, relative), 'utf8');

let passed = 0;
let failed = 0;
const pending = [];
const check = (name, fn) => {
  pending.push(async () => {
    try {
      await fn();
      passed += 1;
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(`  ${err.message}`);
    }
  });
};

const ART = read('src/components/mascot/shoujoArtLayers.jsx');
const MASCOT = read('src/components/mascot/ClampShoujoMascot.jsx');
const CSS = read('src/styles/mascot-motion.css');
const RIGGED = read('src/components/mascot/RiggedSvgMascot.jsx');

const count = (haystack, needle) => haystack.split(needle).length - 1;

// ---------------------------------------------------------------------
// Really drawn
// ---------------------------------------------------------------------

let drawn = null;

const renderBoth = async () => {
  if (drawn) return drawn;
  // The entry sits inside the frontend tree so that react and
  // react-dom resolve against the frontend's node_modules; an entry
  // in a temp dir cannot see them.
  const dir = mkdtempSync(join(FRONTEND, 'node_modules', '.shoujo-test-'));
  const entry = join(dir, 'entry.jsx');
  const out = join(dir, 'out.cjs');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    entry,
    `
    import { renderToStaticMarkup } from 'react-dom/server';
    import ClampShoujoMascot from ${JSON.stringify(join(FRONTEND, 'src/components/mascot/ClampShoujoMascot.jsx'))};
    import { I18nProvider } from ${JSON.stringify(join(FRONTEND, 'src/i18n/index.jsx'))};
    export const draw = (props) =>
      renderToStaticMarkup(
        <I18nProvider>
          <ClampShoujoMascot {...props} />
        </I18nProvider>
      );
    `
  );
  await build({
    entryPoints: [entry],
    bundle: true,
    outfile: out,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    loader: { '.js': 'jsx', '.jsx': 'jsx', '.css': 'empty' },
    // Nothing is left external: the bundle is written to a temp dir,
    // where node would resolve react against the temp dir rather
    // than against the frontend and fail to find it.
    absWorkingDir: FRONTEND,
    // The api client reads import.meta.env, which node does not have.
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://localhost/api', MODE: 'test' }) },
    logLevel: 'silent',
  });
  const require = createRequire(import.meta.url);
  const mod = require(out);
  drawn = {
    kobato: mod.draw({ persona: 'kobato' }),
    bishounen: mod.draw({ persona: 'bishounen' }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
  return drawn;
};

check('both personas render a valid svg tree', async () => {
  const d = await renderBoth();
  for (const [name, html] of [['kobato', d.kobato], ['bishounen', d.bishounen]]) {
    assert.ok(html.includes('<svg'), `${name}: an svg`);
    assert.ok(html.includes('viewBox="0 0 200 260"'), `${name}: the 2.5-head box`);
    assert.ok(count(html, '<path') > 10, `${name}: drawn with many paths`);
    assert.ok(html.includes(`data-persona="${name}"`), `${name}: labelled`);
    assert.ok(html.includes('data-testid="shoujo-mascot-svg"'), `${name}: the testid`);
  }
});

check('the two personas are genuinely different drawings', async () => {
  const d = await renderBoth();
  assert.notEqual(d.kobato, d.bishounen, 'the two personas differ');
  // Kobato has the straw hat and the konpeito bottle; the boy has the
  // ledger and the pocket watch.
  assert.ok(d.kobato.includes('konpeito-bottle'), 'the bottle');
  assert.ok(d.kobato.includes('data-part="sakura"'), 'the sakura on the brim');
  assert.ok(d.bishounen.includes('kakeibo-ledger'), 'the ledger');
  assert.ok(!d.kobato.includes('kakeibo-ledger'), 'the girl does not carry the ledger');
  assert.ok(!d.bishounen.includes('konpeito-bottle'), 'the boy does not carry the bottle');
});

check('the eye is really drawn in seven layers', async () => {
  const d = await renderBoth();
  const html = d.kobato;
  // Two eyes, each with the full stack.
  assert.equal(count(html, 'data-eye='), 2, 'two eyes');
  // Layer 1 the white, 2 the graded iris, 4 the pupil: three ellipses
  // per eye at least, plus the catchlights.
  assert.ok(count(html, '<ellipse') >= 8, 'the stacked ellipses');
  assert.ok(html.includes('rx="9.5" ry="11.5"'), 'the sclera');
  assert.ok(html.includes('rx="8" ry="10.5"'), 'the iris');
  assert.ok(html.includes('rx="3.8" ry="4.8"'), 'the pupil');
  assert.ok(html.includes('rgba(58, 34, 44, 0.35)'), 'the lash shadow');
  assert.ok(html.includes('#FFF8E7'), 'the light along the bottom rim');
  // Three catchlights per eye: the big circle, the droplet, the star.
  assert.ok(count(html, 'fill="#FFFFFF"') >= 6, 'the catchlights');
  assert.ok(html.includes('#7A5A64'), 'the double-eyelid crease');
});

check('the eye closes to a happy curve when it blinks', () => {
  // The blink swaps layers 1-6 for a single curve with a sparkle.
  assert.ok(ART.includes('data-blinking="true"'), 'a closed state');
  assert.ok(ART.includes('isBlinking'), 'the blink is a parameter of the eye');
  assert.ok(MASCOT.includes('blink-cover'), 'the component covers the open eye');
});

check('the lineart is a warm berry-sepia and never pure black', async () => {
  const d = await renderBoth();
  for (const [name, html] of [['kobato', d.kobato], ['bishounen', d.bishounen]]) {
    assert.ok(html.includes('#4A3540'), `${name}: the berry-sepia ink`);
    assert.ok(!html.includes('#000000'), `${name}: no pure black`);
    assert.ok(!html.includes('"black"'), `${name}: no named black`);
  }
  assert.ok(ART.includes("export const INK = '#4A3540'"), 'the ink is named once');
  assert.ok(ART.includes('STROKE_OUTER = 2.0'), 'the silhouette weight');
  assert.ok(ART.includes('STROKE_INNER = 1.3'), 'the inner-detail weight');
});

check('the whole figure wears the die-cut sticker border', async () => {
  const d = await renderBoth();
  const html = d.kobato;
  assert.ok(html.includes('feMorphology'), 'the silhouette is grown');
  assert.ok(html.includes('operator="dilate"'), 'grown outwards');
  assert.ok(html.includes('radius="3.5"'), 'by three and a half');
  assert.ok(html.includes('feFlood'), 'and flooded');
  assert.ok(html.includes('#FFFDF9'), 'in the sticker white');
  assert.ok(html.includes('feDropShadow'), 'with a shadow under it');
  assert.ok(html.includes('-sticker'), 'the filter is applied');
});

check('the gradient ids are unique per instance', () => {
  // Two companions on one page must not share "#iris": the second
  // definition would win for both of them.
  assert.ok(MASCOT.includes('useId()'), 'an id per instance');
  assert.ok(ART.includes('${uid}-iris'), 'the iris id is scoped');
  assert.ok(ART.includes('${uid}-sticker'), 'the filter id is scoped');
});

check('the 2.5-head proportions are held to the stated bands', () => {
  // head 24..118, torso 114..196, legs 192..238 in a 200x260 box.
  assert.ok(ART.includes('head: { top: 24, bottom: 118'), 'the head band');
  assert.ok(ART.includes('torso: { top: 114, bottom: 196'), 'the torso band');
  assert.ok(ART.includes('legs: { top: 192, bottom: 238'), 'the leg band');
  assert.ok(ART.includes('leftCx: 80, rightCx: 120'), 'the eyes at 80 and 120');
  assert.ok(ART.includes('chinY: 114'), 'the pointed chin');
});

// ---------------------------------------------------------------------
// The persona switcher and the question
// ---------------------------------------------------------------------

check('the reader can switch companion, and the choice is remembered', () => {
  assert.ok(MASCOT.includes("PERSONA_KEY = 'fm.mascot.persona'"), 'a place to remember it');
  assert.ok(MASCOT.includes('localStorage.setItem'), 'it is written');
  assert.ok(MASCOT.includes('localStorage.getItem'), 'and read back');
  // The two-pill switcher became the guild's six-portrait dock plus
  // an "auto" button; the per-character testid is the same shape.
  assert.ok(MASCOT.includes('data-testid={`shoujo-persona-${id}`}'), 'a portrait per character');
  assert.ok(MASCOT.includes('shoujo-persona-auto'), 'and the auto-by-page button');
  assert.ok(/catch\s*\{/.test(MASCOT), 'a browser that refuses storage still works');
});

check('the companion can be asked a real question', () => {
  assert.ok(MASCOT.includes('api.ai.agent('), 'it asks the real agent');
  assert.ok(MASCOT.includes('shoujo-ask-input'), 'there is an input');
  assert.ok(MASCOT.includes('shoujo-chip-'), 'and one-tap questions');
  for (const chip of ['chip_analyse', 'chip_snack', 'chip_record']) {
    assert.ok(MASCOT.includes(chip), chip);
  }
  assert.ok(MASCOT.includes('setAskError'), 'a failure is reported, not swallowed');
});

check('the board only opens where the page asked for it', () => {
  assert.ok(MASCOT.includes('interactive = true'), 'interactivity is a prop');
  assert.ok(MASCOT.includes('interactive && (hovering || boardOpen)'), 'and it gates the board');
});

// ---------------------------------------------------------------------
// The five motion channels
// ---------------------------------------------------------------------

check('the body breathes and the hair follows a beat behind it', () => {
  assert.ok(/\.shoujo-rig-body\s*\{[^}]*shoujoBreathe 3\.2s/.test(CSS), 'the 3.2s breath');
  assert.ok(/translateY\(-4px\)/.test(CSS), 'it rises four pixels');
  assert.ok(/rotate\(1\.5deg\)/.test(CSS), 'with a small tilt');
  assert.ok(/\.shoujo-rig-hair\s*\{[^}]*shoujoHairBreeze 3\.2s/.test(CSS), 'the hair on the same period');
  assert.ok(/animation-delay:\s*-1\.05s/.test(CSS), 'but a third of a beat behind');
  assert.ok(/transform-origin:\s*100px 50px/.test(CSS), 'hinged at the crown');
});

check('the blink is a double blink', () => {
  assert.ok(MASCOT.includes('BLINK_EVERY_MS = 3800'), 'every 3.8 seconds');
  assert.ok(MASCOT.includes('BLINK_HOLD_MS = 140'), 'closed for 140ms');
  assert.ok(MASCOT.includes('DOUBLE_BLINK_GAP_MS'), 'twice, not once');
});

check('the companion can stroll, and stops when it is greeted', () => {
  assert.ok(/\.shoujo-roaming-walker\s*\{[^}]*shoujoRoam/.test(CSS), 'the walk');
  assert.ok(/translateX\(120px\)/.test(CSS), 'between waypoints');
  assert.ok(/scaleX\(-1\)/.test(CSS), 'turning round at the end');
  assert.ok(/@keyframes shoujoStepLeft/.test(CSS), 'the left foot');
  assert.ok(/@keyframes shoujoStepRight/.test(CSS), 'and the right');
  assert.ok(/rotate\(12deg\)/.test(CSS) && /rotate\(-12deg\)/.test(CSS), 'alternating');
  assert.ok(/animation-play-state:\s*paused/.test(CSS), 'it stops when hovered');
  assert.ok(MASCOT.includes('is-paused'), 'the component says when');
});

check('greeting it springs and bursts petals', () => {
  assert.ok(/@keyframes shoujoHop/.test(CSS), 'the spring');
  assert.ok(MASCOT.includes('is-greeted'), 'on a greeting');
  assert.ok(/@keyframes shoujoSparkle/.test(CSS), 'the sparkles');
  assert.ok(ART.includes('ShoujoSparkles'), 'the petals and stars exist');
});

check('a reader who asked for less movement gets a still character', () => {
  // There are several reduced-motion blocks in this sheet now, one per
  // group of animations. Reading only the last one tested whichever
  // group happened to be appended most recently, so every block is
  // joined and searched instead.
  const blocks = CSS.split('@media (prefers-reduced-motion: reduce)').slice(1).join('\n');
  for (const sel of ['.shoujo-rig-body', '.shoujo-rig-hair', '.shoujo-roaming-walker', '.shoujo-sparkle']) {
    assert.ok(blocks.includes(sel), sel);
  }
});

// ---------------------------------------------------------------------
// Wired in without breaking what was there
// ---------------------------------------------------------------------

check('the shoujo companion is the default drawing', () => {
  assert.ok(RIGGED.includes("variant = 'shoujo'"), 'it is the default variant');
  assert.ok(RIGGED.includes('data-variant="shoujo"'), 'and says so');
  assert.ok(RIGGED.includes('<ClampShoujoMascot'), 'it is rendered');
});

check('the older drawings are still reachable by name', () => {
  assert.ok(RIGGED.includes('data-variant="kanahei"'), 'the flat drawing');
  assert.ok(RIGGED.includes('data-variant="pixel"'), 'the pixel grid');
});

check('the existing props still pass through', () => {
  // A page that already said state/mode/size/label/lines must keep
  // working untouched.
  for (const prop of ['state', 'mode', 'size', 'label', 'lines', 'onClick']) {
    assert.ok(RIGGED.includes(prop), prop);
  }
  assert.ok(RIGGED.includes('said={said}'), 'what it says still reaches it');
});

check('the words exist in all three languages', () => {
  for (const lang of ['id', 'en', 'ja']) {
    const dict = read(`src/i18n/${lang}.js`);
    assert.ok(/shoujo:\s*\{/.test(dict), `${lang}: the block`);
    for (const key of ['name_kobato', 'pill_kobato', 'pill_bishounen', 'chip_analyse', 'ask_placeholder', 'ask_failed']) {
      assert.ok(dict.includes(`${key}:`), `${lang}: ${key}`);
    }
  }
});

// ---------------------------------------------------------------------

const run = async () => {
  for (const fn of pending) await fn();
  if (drawn) drawn.cleanup();
  console.log('');
  if (failed === 0) {
    console.log(`shoujo companion: all ${passed} checks passed`);
  } else {
    console.log(`shoujo companion: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
};

run();
