/**
 * The household page, the mascot and the pacing card.
 *
 * Three kinds of check:
 *
 * - the arithmetic and the grids, read as plain modules;
 * - the components, really drawn: they are bundled and rendered to a
 *   string, the way a server would render them, so a component that
 *   throws or prints a raw key fails here and not in front of a reader;
 * - the wiring, read from the source: the route, the menu, the calls,
 *   and the words in all three languages.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

import {
  BODY, EARS, FACES, OUTFITS, PALETTE, GRID, SPARKS, STATES, MODES,
  IDLE_HOLD_MS, BLINK_MS, JUMP_CYCLE_MS, frameHold, gridToRects, mascotLayers,
} from '../../components/mascot/mascotFrames.js';
import {
  PACING_COLORS, indicatorFor, pacingColor, pacingPercent, pacingTick, pacingTone, pacingWidth,
} from '../../components/ui/budggtPacing.js';
import {
  ACTIVITY_ACTIONS, ATTENTION_KINDS, ERROR_CODES, ROLES, TABS,
  activityKey, agendaBadge, agendaLine, errorKey, joinCodeFromSearch, monthLabel,
  pacingRows, parseDay, pickAccount, roleKey, todayIso, upcomingAgendas,
} from '../../utils/household.js';
import id from '../../i18n/id.js';
import en from '../../i18n/en.js';
import ja from '../../i18n/ja.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..');
const ROOT = join(FRONTEND, '..');
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

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

// ---------------------------------------------------------------------------
// The components, bundled so they can be drawn here
// ---------------------------------------------------------------------------

const ENTRY = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from './src/i18n';
import RiggedSvgMascot from './src/components/mascot/RiggedSvgMascot.jsx';
import { BudggtPacingCard, BudggtQuickPills } from './src/components/ui/BudggtTactileComponents.jsx';
import { HouseholdView } from './src/pages/HouseholdPage.jsx';

const draw = (node) => renderToStaticMarkup(React.createElement(I18nProvider, null, node));

export const mascot = (props) => draw(React.createElement(RiggedSvgMascot, props));
export const pacing = (props) => draw(React.createElement(BudggtPacingCard, props));
export const pills = (props) => draw(React.createElement(BudggtQuickPills, props));
export const household = (props) => draw(React.createElement(HouseholdView, props));
`;

const outdir = mkdtempSync(join(tmpdir(), 'household-test-'));
const outfile = join(outdir, 'bundle.cjs');

// The few things of a browser the modules reach for as they load.
const memory = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  },
});
globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
globalThis.window.dispatchEvent ??= () => true;

let drawn;
try {
  await build({
    stdin: { contents: ENTRY, resolveDir: FRONTEND, loader: 'jsx', sourcefile: 'entry.jsx' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    jsx: 'automatic',
    loader: { '.js': 'jsx', '.svg': 'dataurl', '.png': 'dataurl', '.css': 'empty' },
    define: {
      'import.meta.env': JSON.stringify({ BASE_URL: '/', MODE: 'test', DEV: false, PROD: true }),
    },
    logLevel: 'silent',
  });
  drawn = createRequire(import.meta.url)(outfile);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}

const count = (text, needle) => text.split(needle).length - 1;

// ---------------------------------------------------------------------------
// The mascot's grids
// ---------------------------------------------------------------------------

const everyGrid = {
  body: BODY,
  ears0: EARS[0],
  ears1: EARS[1],
  family: OUTFITS.family,
  business: OUTFITS.business,
  ...Object.fromEntries(
    Object.entries(FACES).flatMap(([state, frames]) => frames.map((grid, i) => [`${state}${i}`, grid]))
  ),
};

check('every layer is sixteen squares by sixteen', () => {
  for (const [name, grid] of Object.entries(everyGrid)) {
    assert.equal(grid.length, GRID, `${name} has ${grid.length} rows`);
    grid.forEach((line, row) => assert.equal(line.length, GRID, `${name} row ${row}`));
  }
});

check('every square is a colour the palette knows', () => {
  for (const [name, grid] of Object.entries(everyGrid)) {
    for (const line of grid) {
      for (const key of line) {
        if (key !== '.') assert.ok(PALETTE[key], `${name} uses "${key}"`);
      }
    }
  }
});

check('there are four states and two outfits', () => {
  assert.deepEqual(STATES, ['idle', 'happy', 'celebrate', 'alert']);
  assert.deepEqual(MODES, ['family', 'business']);
  for (const state of STATES) assert.equal(FACES[state].length, 2, state);
});

check('the two frames of every state are different drawings', () => {
  for (const state of STATES) {
    assert.notDeepEqual(FACES[state][0], FACES[state][1], state);
  }
  assert.notDeepEqual(EARS[0], EARS[1], 'the ear twitches');
});

check('the four states are four different faces', () => {
  const faces = STATES.map((state) => FACES[state][0].join(''));
  assert.equal(new Set(faces).size, 4);
});

check('the blink shuts the eyes: no light in them', () => {
  assert.ok(FACES.idle[0].join('').includes('w'), 'open eyes carry a light');
  assert.ok(!FACES.idle[1].join('').includes('w'), 'shut eyes do not');
});

check('the frames are held for the times that were asked for', () => {
  assert.equal(IDLE_HOLD_MS, 3200);
  assert.equal(BLINK_MS, 180);
  assert.equal(JUMP_CYCLE_MS, 350);
  assert.equal(frameHold('idle', 0), 3200);
  assert.equal(frameHold('idle', 1), 180);
  assert.equal(frameHold('alert', 0), 3200);
  assert.equal(frameHold('happy', 0), 350);
  assert.equal(frameHold('happy', 1), 350);
  assert.equal(frameHold('celebrate', 1), 350);
});

check('squares of one colour side by side become one rectangle', () => {
  const rects = gridToRects(['..aa.a']);
  assert.deepEqual(
    rects.map((r) => [r.x, r.y, r.width]),
    [[2, 0, 2], [5, 0, 1]]
  );
  assert.equal(rects[0].fill, PALETTE.a);
});

check('a frame is four layers, and the outfit is on top', () => {
  const layers = mascotLayers({ state: 'idle', mode: 'family', frame: 0 });
  assert.deepEqual(layers.map((l) => l.name), ['body', 'ears', 'face', 'outfit']);
  for (const layer of layers) assert.ok(layer.rects.length > 0, layer.name);
});

check('a state or an outfit nobody defined falls back and does not throw', () => {
  const odd = mascotLayers({ state: 'sleepy', mode: 'pirate', frame: 7 });
  const plain = mascotLayers({ state: 'idle', mode: 'family', frame: 0 });
  assert.deepEqual(odd, plain);
});

check('the sparks are eight, stars and coins, all flying outward', () => {
  assert.equal(SPARKS.length, 8);
  assert.deepEqual([...new Set(SPARKS.map((s) => s.kind))].sort(), ['coin', 'star']);
  for (const spark of SPARKS) assert.ok(Math.hypot(spark.dx, spark.dy) >= 20, `spark ${spark.id}`);
});

// ---------------------------------------------------------------------------
// The mascot, drawn
// ---------------------------------------------------------------------------

check('the mascot draws in every state, outfit and frame', () => {
  const seen = new Set();
  for (const state of STATES) {
    for (const mode of MODES) {
      for (const initialFrame of [0, 1]) {
        const html = drawn.mascot({ state, mode, initialFrame });
        assert.ok(html.includes('<svg'), `${state}/${mode}/${initialFrame}`);
        assert.ok(html.includes(`data-state="${state}"`));
        assert.ok(html.includes(`data-mode="${mode}"`));
        assert.ok(html.includes(`data-frame="${initialFrame}"`));
        seen.add(html);
      }
    }
  }
  assert.equal(seen.size, 16, 'all sixteen drawings are different');
});

check('the mascot is drawn on the pixel grid, with crisp edges', () => {
  const html = drawn.mascot({});
  assert.ok(html.includes('shape-rendering="crispEdges"'));
  assert.ok(html.includes('viewBox="0 0 16 16"'));
  for (const layer of ['body', 'ears', 'face', 'outfit']) {
    assert.ok(html.includes(`data-layer="${layer}"`), layer);
  }
});

check('the mascot is rectangles and never a freehand path', () => {
  const html = drawn.mascot({ state: 'celebrate', mode: 'business' });
  assert.ok(count(html, '<rect') > 30);
  assert.equal(count(html, '<path'), 0);
});

check('the mascot bobs at rest and can be pressed', () => {
  const html = drawn.mascot({ label: 'Maskot' });
  assert.ok(html.includes('mascot-float'));
  assert.ok(html.includes('<button'));
  assert.ok(html.includes('aria-label="Maskot"'));
});

check('the family wears the sprout and the business wears the visor', () => {
  const family = drawn.mascot({ mode: 'family' });
  const business = drawn.mascot({ mode: 'business' });
  assert.ok(family.includes(PALETTE.l) && !family.includes(PALETTE.v));
  assert.ok(business.includes(PALETTE.v) && !business.includes(PALETTE.g));
});

// ---------------------------------------------------------------------------
// The movement
// ---------------------------------------------------------------------------

const css = read('frontend/src/styles/mascot-motion.css');

check('the stylesheet is loaded by the application', () => {
  assert.ok(read('frontend/src/main.jsx').includes("import './styles/mascot-motion.css'"));
});

check('the bob and the jump are the animations that were asked for', () => {
  assert.match(css, /\.mascot-float\s*\{\s*animation:\s*mascotBob 2\.8s cubic-bezier\(0\.45, 0, 0\.55, 1\) infinite;/);
  assert.match(css, /\.mascot-jump\s*\{\s*animation:\s*mascotJump 0\.55s cubic-bezier\(0\.16, 1, 0\.3, 1\);/);
  for (const name of ['mascotBob', 'mascotJump', 'mascotSparkle']) {
    assert.ok(css.includes(`@keyframes ${name}`), name);
  }
  assert.ok(css.includes('.mascot-sparkle'));
});

check('the speech bubble is the dark pill with the lime edge', () => {
  const bubble = css.slice(css.indexOf('.mascot-bubble {'), css.indexOf('.mascot-bubble::after'));
  assert.ok(bubble.includes('#0F291E'));
  assert.ok(bubble.includes('#ECFDF5'));
  assert.ok(bubble.includes('#A3E635'));
});

check('the pills move for 280ms on the asked curve, and shrink when pressed', () => {
  assert.ok(css.includes('--tactile-ease: cubic-bezier(0.16, 1, 0.3, 1)'));
  assert.ok(css.includes('--tactile-press: 280ms'));
  assert.match(css, /\.tactile-pill:active\s*\{\s*transform:\s*scale\(0\.95\);/);
});

check('the bars fill over 750ms', () => {
  assert.ok(css.includes('--tactile-fill: 750ms'));
  assert.match(css, /\.pacing-fill\s*\{[^}]*width var\(--tactile-fill\) var\(--tactile-ease\)/);
});

check('no transition animates every property', () => {
  assert.ok(!/transition\s*:\s*all\b/.test(css));
});

check('a reader who asked for less movement gets less', () => {
  const guard = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(guard.length > 50, 'there is a guard');
  const names = [...css.matchAll(/@keyframes\s+([A-Za-z]+)/g)].map((m) => m[1]);
  assert.ok(names.length >= 8);
  for (const name of names) assert.ok(guard.includes(name), `${name} is named in the guard`);
  for (const rule of ['.mascot-float', '.mascot-jump', '.mascot-sparkle', '.pacing-fill', '.tactile-pill-indicator']) {
    assert.ok(guard.includes(rule), rule);
  }
});

check('the page has its light and its dark palette', () => {
  assert.ok(css.includes('--hh-canvas: #F5F3EC'));
  assert.ok(css.includes('--hh-canvas: #0B1512'));
  assert.ok(css.includes('--hh-forest: #112A20'));
  assert.ok(css.includes('--hh-lime: #BEF264'));
  assert.ok(css.includes('--hh-line: #E5E0D5'));
});

// ---------------------------------------------------------------------------
// The pacing arithmetic
// ---------------------------------------------------------------------------

check('the share of the limit that is used', () => {
  assert.equal(pacingPercent(2490000, 3000000), 83);
  assert.equal(pacingPercent(0, 3000000), 0);
  assert.equal(pacingPercent(4500000, 3000000), 150);
  assert.equal(pacingPercent(500, 0), 0, 'no limit is not a division by zero');
  assert.equal(pacingPercent(-5, 100), 0);
});

check('the bar stops at the end of the track', () => {
  assert.equal(pacingWidth(4500000, 3000000), 100);
  assert.equal(pacingWidth(1500000, 3000000), 50);
});

check('the tick is where today is in the month', () => {
  assert.equal(Math.round(pacingTick(24, 31)), 77);
  assert.equal(pacingTick(15, 30), 50);
  assert.equal(pacingTick(31, 31), 100);
  assert.equal(pacingTick(5, 0), 0);
});

check('a row says how it is doing', () => {
  const at = (spent, extra = {}) =>
    pacingTone({ spent, limit: 100, currentDay: 15, totalDays: 30, ...extra });
  assert.equal(at(20), 'calm');
  assert.equal(at(60), 'ahead', 'sixty per cent used at the half-way day');
  assert.equal(at(80), 'near');
  assert.equal(at(100), 'near');
  assert.equal(at(101), 'over');
  assert.equal(pacingTone({ spent: 50, limit: 0, currentDay: 1, totalDays: 30 }), 'empty');
});

check('filling the savings bar is good news and never a warning', () => {
  const at = (spent) =>
    pacingTone({ spent, limit: 100, currentDay: 15, totalDays: 30, goodWhenFull: true });
  assert.equal(at(90), 'calm');
  assert.equal(at(100), 'reached');
  assert.equal(at(180), 'reached');
});

check('the colours: violet, emerald, and coral near or past the limit', () => {
  assert.equal(PACING_COLORS.needs, '#7C3AED');
  assert.equal(PACING_COLORS.savings, '#10B981');
  assert.equal(PACING_COLORS.warning, '#F97316');
  assert.equal(pacingColor({ id: 'needs' }, 'calm'), '#7C3AED');
  assert.equal(pacingColor({ id: 'wants' }, 'near'), '#F97316');
  assert.equal(pacingColor({ id: 'wants' }, 'over'), '#F97316');
  assert.equal(pacingColor({ id: 'savings' }, 'reached'), '#10B981');
});

check('the lit pill sits under the chosen one', () => {
  const boxes = [{ id: 'a', left: 4, width: 60 }, { id: 'b', left: 66, width: 90 }];
  assert.deepEqual(indicatorFor(boxes, 'b'), { x: 66, width: 90, visible: true });
  assert.equal(indicatorFor(boxes, 'zzz').visible, false);
  assert.equal(indicatorFor(null, 'a').visible, false);
});

// ---------------------------------------------------------------------------
// The pacing card and the pills, drawn
// ---------------------------------------------------------------------------

const rupiah = (n) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

const samplePacing = {
  monthLabel: 'Budget Oktober 2026',
  dayLabel: 'Hari 24 dari 31',
  currentDay: 24,
  totalDays: 31,
  formatAmount: rupiah,
  noLimitLabel: 'belum ada batas',
  rows: [
    { id: 'needs', label: 'Kebutuhan', spent: 2490000, limit: 3000000 },
    { id: 'wants', label: 'Keinginan', spent: 1900000, limit: 1500000 },
    { id: 'savings', label: 'Tabungan', spent: 400000, limit: 1000000, goodWhenFull: true },
  ],
};

check('the pacing card draws its three rows with their amounts', () => {
  const html = drawn.pacing(samplePacing);
  assert.ok(html.includes('Budget Oktober 2026'));
  assert.ok(html.includes('Hari 24 dari 31'));
  for (const label of ['Kebutuhan', 'Keinginan', 'Tabungan']) assert.ok(html.includes(label), label);
  assert.ok(html.includes('Rp2.490.000'));
  assert.ok(html.includes('Rp3.000.000'));
  assert.equal(count(html, 'role="progressbar"'), 3);
});

check('every bar carries the tick of today', () => {
  const html = drawn.pacing(samplePacing);
  assert.equal(count(html, 'class="pacing-tick"'), 3);
  assert.ok(html.includes(`left:${pacingTick(24, 31)}%`));
});

check('the row that is past its limit is coral and marked over', () => {
  const html = drawn.pacing(samplePacing);
  assert.ok(html.includes('data-pacing-row="wants" data-tone="over"'));
  assert.ok(html.includes('data-pacing-row="needs" data-tone="near"'));
  assert.ok(html.includes('data-pacing-row="savings" data-tone="calm"'));
  assert.ok(html.includes('pacing-fill-over'));
  assert.ok(html.includes('#F97316'));
  assert.ok(html.includes('#10B981'));
});

check('the bars start empty, so they can be seen to fill', () => {
  const html = drawn.pacing(samplePacing);
  assert.equal(count(html, 'width:0%'), 3);
});

check('a row with no limit says so instead of drawing against nothing', () => {
  const html = drawn.pacing({
    ...samplePacing,
    rows: [{ id: 'needs', label: 'Kebutuhan', spent: 50000, limit: 0 }],
  });
  assert.ok(html.includes('belum ada batas'));
  assert.ok(html.includes('data-tone="empty"'));
  assert.ok(html.includes('aria-valuenow="0"'));
});

check('the pills draw one tab each and mark the chosen one', () => {
  const html = drawn.pills({
    items: [{ id: 'makan', label: 'Makan' }, { id: 'transport', label: 'Transport', icon: '🚗' }],
    activeId: 'transport',
    ariaLabel: 'Kategori',
  });
  assert.equal(count(html, 'role="tab"'), 2);
  assert.equal(count(html, 'aria-selected="true"'), 1);
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('tactile-pill-indicator'));
  assert.ok(html.includes('Makan') && html.includes('Transport'));
});

// ---------------------------------------------------------------------------
// The household page's small decisions
// ---------------------------------------------------------------------------

check('a date is read as the day that was written', () => {
  const day = parseDay('2026-11-13');
  assert.equal(day.getFullYear(), 2026);
  assert.equal(day.getMonth(), 10);
  assert.equal(day.getDate(), 13);
  assert.equal(parseDay('besok'), null);
  assert.equal(todayIso(new Date(2026, 0, 5)), '2026-01-05');
});

check('the date badge reads NOV 13 and the line reads Jum 19.00 · Rumah Nenek', () => {
  const badge = agendaBadge('2026-11-13', 'id');
  assert.equal(badge.month, 'NOV');
  assert.equal(badge.day, '13');
  assert.equal(badge.weekday, 'Jum');
  assert.equal(
    agendaLine({ date: '2026-11-13', time: '19.00', location: 'Rumah Nenek' }, 'id'),
    'Jum 19.00 · Rumah Nenek'
  );
  assert.equal(agendaLine({ date: '2026-11-13' }, 'en'), 'Fri');
});

check('the next agendas are the ones still to come, soonest first', () => {
  const agendas = [
    { id: 1, date: '2026-11-30', status: 'upcoming' },
    { id: 2, date: '2026-11-01', status: 'upcoming' },
    { id: 3, date: '2026-11-12', status: 'done' },
    { id: 4, date: '2026-11-10', status: 'upcoming' },
    { id: 5, date: '2026-12-01', status: 'upcoming' },
    { id: 6, date: '2026-12-02', status: 'upcoming' },
  ];
  assert.deepEqual(upcomingAgendas(agendas, '2026-11-10', 3).map((a) => a.id), [4, 1, 5]);
  assert.deepEqual(upcomingAgendas(null, '2026-11-10'), []);
});

check('the month is named in the reader\'s language', () => {
  assert.equal(monthLabel(2026, 11, 'id'), 'November 2026');
  assert.equal(monthLabel(2026, 11, 'en'), 'November 2026');
  assert.ok(monthLabel(2026, 11, 'ja').includes('11'));
  assert.equal(monthLabel(0, 0, 'id'), '');
});

check('a join link carries a code only when it is one', () => {
  assert.equal(joinCodeFromSearch('?join=76b63290'), '76B63290');
  assert.equal(joinCodeFromSearch('?join=abc'), '');
  assert.equal(joinCodeFromSearch('?join=76B6-290'), '');
  assert.equal(joinCodeFromSearch(''), '');
});

check('the server\'s three buckets become the card\'s three rows', () => {
  const rows = pacingRows(
    {
      kebutuhan: { spent: 10, limit: 100, limit_source: 'budgets' },
      keinginan: { spent: 20, limit: 60, limit_source: 'income_rule' },
      tabungan: { spent: 30, limit: 40, limit_source: 'income_rule' },
    },
    { needs: 'Kebutuhan', wants: 'Keinginan', savings: 'Tabungan' }
  );
  assert.deepEqual(rows.map((r) => [r.id, r.label, r.spent, r.limit]), [
    ['needs', 'Kebutuhan', 10, 100],
    ['wants', 'Keinginan', 20, 60],
    ['savings', 'Tabungan', 30, 40],
  ]);
  assert.equal(rows[2].goodWhenFull, true);
  assert.deepEqual(pacingRows(null), []);
});

check('the account to pay from is the remembered one, if it is still there', () => {
  const accounts = [{ id: 1, name: 'BCA' }, { id: 2, name: 'GoPay' }];
  assert.equal(pickAccount(accounts, '2').name, 'GoPay');
  assert.equal(pickAccount(accounts, '99').name, 'BCA');
  assert.equal(pickAccount([], '1'), null);
});

check('a refusal the server names gets its own sentence, anything else the general one', () => {
  assert.equal(errorKey(new Error('code_not_found')), 'household.err_code_not_found');
  assert.equal(errorKey(new Error('Failed to fetch')), 'household.err_generic');
  assert.equal(errorKey(null), 'household.err_generic');
  assert.equal(roleKey('host'), 'household.role_host');
  assert.equal(roleKey('king'), 'household.role_member');
  assert.equal(activityKey('task_done'), 'household.act_task_done');
  assert.equal(activityKey('unknown'), null);
});

// ---------------------------------------------------------------------------
// The words, in all three languages
// ---------------------------------------------------------------------------

const LANGUAGES = { id, en, ja };

const PAGE_SOURCES = [
  'frontend/src/pages/HouseholdPage.jsx',
  'frontend/src/components/household/HouseholdTabs.jsx',
];

const literalKeys = new Set(
  PAGE_SOURCES.flatMap((file) =>
    [...read(file).matchAll(/t\('household\.([a-z0-9_]+)'/g)].map((m) => m[1])
  )
);

// The keys that are put together while the page runs.
const builtKeys = [
  ...TABS.map((tab) => `tab_${tab}`),
  ...ROLES.map((role) => `role_${role}`),
  ...ACTIVITY_ACTIONS.map((action) => `act_${action}`),
  ...ATTENTION_KINDS.map((kind) => `attn_${kind}`),
  ...ERROR_CODES.map((code) => `err_${code}`),
  'err_generic',
];

check('the page asks for a good many words', () => {
  assert.ok(literalKeys.size > 100, `${literalKeys.size} keys`);
});

for (const [language, table] of Object.entries(LANGUAGES)) {
  check(`every word the page asks for is there in ${language}`, () => {
    const missing = [...literalKeys, ...builtKeys].filter(
      (key) => typeof table.household?.[key] !== 'string' || !table.household[key].trim()
    );
    assert.deepEqual(missing, []);
  });

  check(`the menu has the household's name in ${language}`, () => {
    assert.ok(table.nav?.household, 'nav.household');
  });
}

check('the three languages hold the same household words', () => {
  const keys = (table) => Object.keys(table.household).sort();
  assert.deepEqual(keys(en), keys(id));
  assert.deepEqual(keys(ja), keys(id));
});

check('a sentence with a hole has the same hole in every language', () => {
  const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(id.household)) {
    assert.deepEqual(holes(en.household[key]), holes(id.household[key]), `en ${key}`);
    assert.deepEqual(holes(ja.household[key]), holes(id.household[key]), `ja ${key}`);
  }
});

check('every code the server refuses with has a sentence', () => {
  const service = read('backend/app/services/household_service.py');
  const route = read('backend/app/api/routes/household.py');
  const codes = new Set([
    ...[...service.matchAll(/HouseholdError\(\d+, "([a-z_]+)"\)/g)].map((m) => m[1]),
    ...[...route.matchAll(/detail="([a-z_]+)"/g)].map((m) => m[1]),
  ]);
  assert.ok(codes.size >= 8, `${codes.size} codes`);
  // One of them is a fault of the server and not of the reader; it
  // is said with the general sentence.
  codes.delete('invite_code_unavailable');
  for (const code of codes) assert.ok(ERROR_CODES.includes(code), code);
});

check('everything the server writes in the trail has a sentence', () => {
  const service = read('backend/app/services/household_service.py');
  const route = read('backend/app/api/routes/household.py');
  const written = new Set(
    [...(service + route).matchAll(/\blog\(\s*db,[^\n]*?"([a-z_]+)"/g)].map((m) => m[1])
  );
  for (const kind of ['agenda', 'task', 'need', 'note']) written.add(`${kind}_removed`);
  assert.ok(written.size >= 15, `${written.size} actions`);
  for (const action of written) assert.ok(ACTIVITY_ACTIONS.includes(action), action);
});

// ---------------------------------------------------------------------------
// The page, drawn
// ---------------------------------------------------------------------------

const sample = {
  id: 1,
  name: 'Keuangan Keluarga & Partner',
  mode: 'family',
  invite_code: '76B63290',
  invite_link: 'https://example.com/household?join=76B63290',
  created_at: '2026-11-01T08:00:00',
  can_manage: true,
  members: [
    { id: 1, name: 'Ani', role: 'host', avatar: 'avatar-sun', status: 'active', online: true },
    { id: 2, name: 'Budi', role: 'partner', avatar: 'avatar-sky', status: 'invited', online: false },
  ],
  budget_pacing: {
    kebutuhan: { spent: 2490000, limit: 3000000, limit_source: 'budgets' },
    keinginan: { spent: 1900000, limit: 1500000, limit_source: 'income_rule' },
    tabungan: { spent: 400000, limit: 1000000, limit_source: 'income_rule' },
    current_day: 24,
    days_in_month: 30,
    month: 11,
    year: 2026,
  },
  attention_items: [
    { kind: 'upcoming_bill', title: 'Listrik PLN', amount: 350000, days_left: 3, href: '/recurring' },
    { kind: 'over_budget', title: 'Hiburan', amount: 150000, href: '/budgets' },
    { kind: 'unsettled_split', title: 'Makan bareng', amount: 80000, days_outstanding: 5, href: '/split' },
  ],
  agendas: [
    { id: 1, title: 'Rapat mingguan tim', date: '2099-11-13', time: '19.00', location: 'Rumah Nenek', kind: 'meeting', status: 'upcoming' },
    { id: 2, title: 'Bayar sekolah', date: '2099-12-01', kind: 'bill', status: 'done' },
  ],
  tasks: [
    { id: 1, title: 'Buang sampah', assignee: 'Budi', completed: false, reward_points: 10 },
    { id: 2, title: 'Cuci piring', assignee: null, completed: true, reward_points: 15 },
  ],
  needs: [
    { id: 1, title: 'Beras 5kg', estimated_price: 78000, assignee: 'Ani', purchased: false },
    { id: 2, title: 'Minyak goreng', estimated_price: 40000, assignee: null, purchased: true },
    { id: 3, title: 'Entah berapa', estimated_price: 0, assignee: null, purchased: false },
  ],
  goals: [
    { id: 1, name: 'Liburan Bali', target_amount: 8000000, current_amount: 2000000, currency: 'IDR', progress_percent: 25, target_date: '2027-06-01', shared_by: 'Ani', mine: true },
  ],
  notes: [
    { id: 1, author: 'Ani', body: 'Jangan lupa bayar arisan', color: 'mint', created_at: '2026-11-09T10:00:00' },
  ],
  activity: [
    { id: 2, actor: 'Ani', action: 'task_done', detail: 'Cuci piring', created_at: '2026-11-09T11:00:00' },
    { id: 1, actor: 'Ani', action: 'household_created', detail: '', created_at: '2026-11-01T08:00:00' },
  ],
  reward_points: 15,
  wishlist_waiting: 2,
};

const noActions = new Proxy({}, { get: () => async () => null });
const page = (props = {}) =>
  drawn.household({
    data: sample,
    actions: noActions,
    accounts: [{ id: 1, name: 'BCA' }],
    accountId: 1,
    myGoals: [{ id: 1, name: 'Liburan Bali' }, { id: 2, name: 'Dana Darurat' }],
    ...props,
  });

check('the page draws: the name, the badge, the subtitle', () => {
  const html = page();
  assert.ok(html.includes('Keuangan Keluarga &amp; Partner'));
  assert.ok(html.includes('HOUSEHOLD · REKAN BISNIS'));
  assert.ok(html.includes('Selaraskan agenda, tanggung jawab, anggaran bersama, dan target.'));
  assert.ok(html.includes('data-household-mode="family"'));
});

check('the page never prints a key where a word should be', () => {
  for (const tab of TABS) {
    const html = page({ initialTab: tab });
    assert.ok(!/household\.[a-z_]+/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), `a raw key on ${tab}`);
    assert.ok(!/\{[a-z_]+\}/.test(html), `an unfilled hole on ${tab}`);
  }
});

check('the members are drawn with our own faces, their role and whether they are here', () => {
  const html = page();
  assert.ok(html.includes('Ani') && html.includes('Budi'));
  assert.ok(html.includes('/assets/generated/brand/avatar-sun.svg'));
  assert.ok(html.includes('/assets/generated/brand/avatar-sky.svg'));
  assert.ok(html.includes('Host') && html.includes('Partner'));
  assert.ok(html.includes('Diundang'));
  assert.ok(html.includes('+ Tambah Anggota'));
  assert.ok(html.includes('2 anggota'));
});

check('the mascot sits on the members card, in the outfit of the mode', () => {
  assert.ok(page().includes('data-mode="family"'));
  const business = page({ data: { ...sample, mode: 'business' } });
  assert.ok(business.includes('data-mode="business"'));
});

check('the mascot is alarmed when a budget is gone past, and calm when none is', () => {
  assert.ok(page().includes('data-state="alert"'));
  const calm = page({ data: { ...sample, attention_items: [] } });
  assert.ok(calm.includes('data-state="idle"'));
});

check('the invite code is on the ticket with its copy button', () => {
  const html = page();
  assert.ok(html.includes('KODE UNDANGAN'));
  assert.ok(/data-invite-code="true">76B63290</.test(html));
  assert.ok(html.includes('hh-ticket'));
  assert.ok(html.includes('Salin'));
});

check('the pacing card is on the page with the real numbers', () => {
  const html = page();
  assert.ok(html.includes('data-pacing-card'));
  assert.ok(html.includes('Budget November 2026'));
  assert.ok(html.includes('Hari 24 dari 30'));
  assert.ok(html.includes('2.490.000'));
  assert.equal(count(html, 'data-pacing-row='), 3);
});

check('the page says the numbers are the reader\'s own', () => {
  assert.ok(page().includes('Anggota lain tidak melihat akun atau transaksimu'));
});

check('there are six tabs and the summary is the one open', () => {
  const html = page();
  for (const label of ['Ringkasan', 'Agenda', 'Tugas', 'Kebutuhan', 'Target', 'Catatan']) {
    assert.ok(html.includes(`<span>${label}</span>`), label);
  }
  assert.ok(html.includes('data-tab="summary"'));
});

check('the summary shows what needs attention, each with a way to fix it', () => {
  const html = page();
  assert.ok(html.includes('Perlu perhatian'));
  for (const kind of ATTENTION_KINDS) assert.ok(html.includes(`data-attention="${kind}"`), kind);
  assert.ok(html.includes('Listrik PLN') && html.includes('3 hari lagi'));
  for (const fix of ['Lihat tagihan', 'Atur budget', 'Tagih patungan']) assert.ok(html.includes(fix), fix);
});

check('the summary shows the next agenda with its date badge', () => {
  const html = page();
  assert.ok(html.includes('Agenda terdekat'));
  assert.ok(html.includes('Rapat mingguan tim'));
  assert.ok(html.includes('>NOV<') && html.includes('>13<'));
  assert.ok(html.includes('19.00 · Rumah Nenek'));
  assert.ok(html.includes('+ Agenda'));
  // The one that is done is not "coming up".
  assert.ok(!html.includes('Bayar sekolah'));
});

check('the agenda tab has the form and the list', () => {
  const html = page({ initialTab: 'agenda' });
  assert.ok(html.includes('data-tab="agenda"'));
  assert.ok(html.includes('<form'));
  assert.ok(html.includes('type="date"'));
  assert.ok(html.includes('Tambah Agenda'));
  assert.ok(html.includes('Bayar sekolah') && html.includes('Pengingat tagihan'));
  assert.ok(html.includes('Tandai selesai') && html.includes('Batalkan selesai'));
});

check('the tasks tab draws a checklist, and the finished one is struck through', () => {
  const html = page({ initialTab: 'tasks' });
  assert.equal(count(html, 'role="checkbox"'), 2);
  assert.equal(count(html, 'aria-checked="true"'), 1);
  assert.ok(/hh-task-done[^>]*data-task="2"/.test(html));
  assert.ok(!/hh-task-done[^>]*data-task="1"/.test(html));
  assert.ok(html.includes('+10') && html.includes('+15'));
});

check('the needs tab draws prices, who is to buy, and the button that records it', () => {
  const html = page({ initialTab: 'needs' });
  assert.ok(html.includes('Beras 5kg'));
  assert.ok(html.includes('78.000'));
  assert.ok(html.includes('✓ Sudah Dibeli (Catat Transaksi)'));
  assert.ok(html.includes('Bayar dari akun') && html.includes('BCA'));
  assert.ok(html.includes('Sudah dibeli'), 'the bought one says so');
  assert.ok(html.includes('Ambil 2 item dari wishlist-ku'));
});

check('a need with no price cannot be recorded as bought for nothing', () => {
  const html = page({ initialTab: 'needs' });
  const row = html.slice(html.indexOf('data-need="3"'), html.indexOf('</li>', html.indexOf('data-need="3"')));
  assert.ok(/<button[^>]*disabled=""[^>]*>✓ Sudah Dibeli/.test(row));
  const priced = html.slice(html.indexOf('data-need="1"'), html.indexOf('</li>', html.indexOf('data-need="1"')));
  assert.ok(!/<button[^>]*disabled=""[^>]*>✓ Sudah Dibeli/.test(priced));
});

check('with no account the reader is sent to make one, and nothing can be bought', () => {
  const html = page({ initialTab: 'needs', accounts: [], accountId: null });
  assert.ok(html.includes('Buat akun dulu untuk mencatat pembelian'));
  const priced = html.slice(html.indexOf('data-need="1"'), html.indexOf('</li>', html.indexOf('data-need="1"')));
  assert.ok(/<button[^>]*disabled=""[^>]*>✓ Sudah Dibeli/.test(priced));
});

check('the goals tab draws the liquid bar and offers only goals not yet shared', () => {
  const html = page({ initialTab: 'goals' });
  assert.ok(html.includes('Liburan Bali'));
  assert.ok(html.includes('hh-liquid-fill'));
  assert.ok(html.includes('width:25%'));
  assert.ok(html.includes('+ Tambah Target Bersama'));
  assert.ok(html.includes('<option value="2">Dana Darurat</option>'));
  assert.ok(!html.includes('<option value="1">Liburan Bali</option>'));
});

check('the notes tab draws the sticky notes and the trail of what happened', () => {
  const html = page({ initialTab: 'notes' });
  assert.ok(html.includes('hh-note-mint'));
  assert.ok(html.includes('Jangan lupa bayar arisan'));
  assert.ok(html.includes('Jejak aktivitas'));
  assert.ok(html.includes('menyelesaikan tugas &quot;Cuci piring&quot;'));
  assert.ok(html.includes('membuat household ini'));
});

check('somebody who only joined is not offered the rename or the mode switch', () => {
  const html = page({ data: { ...sample, can_manage: false } });
  assert.ok(!html.includes('Ubah nama'));
  assert.ok(!html.includes('Partner Bisnis'));
  assert.ok(page().includes('Ubah nama') && page().includes('Partner Bisnis'));
});

check('a link somebody was sent is asked about and not acted on', () => {
  const html = page({ pendingJoin: 'ABCD1234' });
  assert.ok(html.includes('ABCD1234'));
  assert.ok(html.includes('Gabung sekarang') && html.includes('Nanti saja'));
  // The reader's own code is not an invitation to themselves.
  assert.ok(!page({ pendingJoin: '76B63290' }).includes('Gabung sekarang'));
});

check('an empty household draws its empty states and does not throw', () => {
  const empty = {
    ...sample,
    attention_items: [], agendas: [], tasks: [], needs: [], goals: [], notes: [], activity: [],
    reward_points: 0, wishlist_waiting: 0, budget_pacing: null,
  };
  const expected = {
    summary: 'Semua aman',
    agenda: 'Belum ada agenda',
    tasks: 'Belum ada tugas',
    needs: 'Belum ada kebutuhan',
    goals: 'Belum ada target bersama',
    notes: 'Belum ada catatan',
  };
  for (const tab of TABS) {
    const html = page({ data: empty, initialTab: tab, myGoals: [] });
    assert.ok(html.includes(expected[tab]), tab);
  }
});

check('what a reader typed is drawn as text and never as markup', () => {
  const html = page({
    initialTab: 'notes',
    data: { ...sample, notes: [{ id: 9, author: 'x', body: '<img src=x onerror=alert(1)>', color: 'lemon' }] },
  });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
});

// ---------------------------------------------------------------------------
// The wiring
// ---------------------------------------------------------------------------

check('the page is on the /household route', () => {
  const app = read('frontend/src/App.jsx');
  assert.ok(app.includes('<Route path="household" element={<HouseholdPage />} />'));
  assert.ok(read('frontend/src/pages/index.js').includes("export { default as HouseholdPage } from './HouseholdPage';"));
});

check('the household is in the menu, in sight without opening anything', async () => {
  const { NAV_GROUPS, buildNavMap } = await import('../../components/layout/navGroups.js');
  const { ITEMS_BEFORE_THE_REST } = await import('../../components/layout/navDisclosure.js');
  const map = buildNavMap((key) => key);
  assert.equal(map.household.href, '/household');
  assert.equal(map.household.icon, 'Home');
  const first = NAV_GROUPS[0];
  const position = first.items.indexOf('household');
  assert.ok(position !== -1 && position < ITEMS_BEFORE_THE_REST, `position ${position}`);

  const navigation = read('frontend/src/components/layout/Navigation.jsx');
  assert.ok(/ICONS = \{[^}]*\bHome\b/.test(navigation), 'the icon is one the sidebar can draw');
  assert.ok(navigation.includes("href: '/household', icon: Home"), 'the flat menu');
  assert.ok(navigation.includes("{ icon: Home, label: t('nav.household'), href: '/household'"), 'the phone menu');
});

check('every call the page makes goes through the one api module', () => {
  for (const file of PAGE_SOURCES) {
    const source = read(file);
    assert.ok(!/\bfetch\(/.test(source), `${file} calls fetch`);
    assert.ok(!/axios/.test(source), `${file} uses axios`);
  }
  const api = read('frontend/src/services/api.js');
  const used = new Set(
    PAGE_SOURCES.flatMap((file) => [...read(file).matchAll(/api\.household\.(\w+)/g)].map((m) => m[1]))
  );
  assert.ok(used.size >= 15, `${used.size} calls`);
  const block = api.slice(api.indexOf('  household: {'), api.indexOf('  // Exchange rates'));
  for (const name of used) assert.ok(new RegExp(`\\b${name}: `).test(block), name);
});

check('the api calls go where the server listens', () => {
  const api = read('frontend/src/services/api.js');
  const route = read('backend/app/api/routes/household.py');
  const block = api.slice(api.indexOf('  household: {'), api.indexOf('  // Exchange rates'));
  const calls = [...block.matchAll(/api\.request\([`']\/household([^`'?]*)[`'](?:,\s*\{\s*method: '(\w+)')?/g)]
    .map((m) => [m[2] || 'GET', m[1].replace(/\$\{\w+\}/g, '{}')]);
  assert.ok(calls.length >= 16, `${calls.length} calls`);
  const served = new Set(
    [...route.matchAll(/@router\.(get|post|patch|delete)\("([^"]*)"/g)]
      .map((m) => `${m[1].toUpperCase()} ${m[2].replace(/\{\w+\}/g, '{}')}`)
  );
  for (const [method, path] of calls) {
    assert.ok(served.has(`${method} ${path}`), `${method} /household${path}`);
  }
});

check('the other pages are told about a purchase only after the server confirmed it', () => {
  const source = read('frontend/src/pages/HouseholdPage.jsx');
  const write = source.indexOf('api.household.purchaseNeed');
  const announce = source.indexOf("emitDataMutated('transaction')");
  assert.ok(write !== -1 && announce > write);
  assert.ok(/if \(answer\?\.created\) emitDataMutated/.test(source));
});

check('the page does no arithmetic on money of its own', () => {
  const source = read('frontend/src/pages/HouseholdPage.jsx');
  assert.ok(!/spent\s*[-+*/]|limit\s*[-+*/]/.test(source));
  assert.ok(read('backend/app/services/household_service.py').includes('metrics.budget_pacing('));
  assert.ok(read('backend/app/services/metrics.py').includes('def budget_pacing('));
});

// ---------------------------------------------------------------------------

for (const run of pending) await run();

console.log('');
console.log(`household page: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
