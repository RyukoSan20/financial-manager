/**
 * The Petit Chibi Guild.
 *
 * Two kinds of check:
 *
 * - the registry, read as a plain module: all six of them, their
 *   kanji, the meaning behind each name in all three languages, the
 *   palette every drawing reads, and the page each one specialises in;
 * - the drawing, really done: each character is bundled and rendered
 *   to a string the way a server would render it, so a silhouette or
 *   a prop that throws fails here and not in front of a reader.
 *
 * Run with: node src/components/mascot/__tests__/petitChibiGuild.test.js
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

import {
  DEFAULT_PETIT_PERSONA,
  PETIT_CHIBI_CAST,
  PETIT_HAIR_STYLES,
  PETIT_PERSONA_IDS,
  PETIT_PROPS,
  getPetitPersona,
  petitText,
} from '../petitChibiCast.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..', '..', '..');
const read = (p) => readFileSync(join(FRONTEND, p), 'utf8');

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

const EXPECTED = {
  mone: { kanji: '萌音', hair: 'twin_locks_hat', prop: 'konpeito_bottle', page: '/' },
  kaneru: { kanji: '奏る', hair: 'fluffy_bangs', prop: 'kakeibo_melody', page: '/budgets' },
  kogane: { kanji: '黄金', hair: 'twin_tails_bows', prop: 'golden_watch', page: '/accounts' },
  zenimaru: { kanji: '銭丸', hair: 'short_spikes_band', prop: 'lucky_coin', page: '/transactions' },
  minori: { kanji: '実り', hair: 'side_braid', prop: 'harvest_basket', page: '/goals' },
  koneko: { kanji: '貯猫', hair: 'cat_ear_hood', prop: 'fuku_koban', page: '/household' },
};

// ---------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------

check('all six of them are in the cast, and nobody else', () => {
  assert.deepEqual(PETIT_PERSONA_IDS, Object.keys(EXPECTED));
  assert.equal(PETIT_PERSONA_IDS.length, 6);
});

check('each one carries their kanji, their hair and their prop', () => {
  for (const [id, want] of Object.entries(EXPECTED)) {
    const member = PETIT_CHIBI_CAST[id];
    assert.ok(member, id);
    assert.equal(member.id, id, `${id}: knows its own id`);
    assert.equal(member.kanji, want.kanji, `${id}: the kanji`);
    assert.equal(member.hair, want.hair, `${id}: the silhouette`);
    assert.equal(member.prop, want.prop, `${id}: the prop`);
  }
});

check('the hidden meaning is written out in all three languages', () => {
  for (const id of PETIT_PERSONA_IDS) {
    const member = PETIT_CHIBI_CAST[id];
    for (const field of ['meaning', 'tagline', 'bio']) {
      for (const lang of ['id', 'en', 'ja']) {
        const text = member[field][lang];
        assert.ok(text && text.length > 4, `${id}.${field}.${lang}`);
      }
    }
  }
});

check('the wordplay is actually in the meaning, not just asserted', () => {
  // Each name is a small joke; the joke has to be written down or the
  // character is just a colour scheme with a name.
  assert.ok(PETIT_CHIBI_CAST.mone.meaning.en.includes('sprout'), 'mone: the sprout');
  assert.ok(PETIT_CHIBI_CAST.mone.meaning.en.toLowerCase().includes('money'), 'mone: money');
  assert.ok(PETIT_CHIBI_CAST.kaneru.meaning.en.includes('melody'), 'kaneru: the melody');
  assert.ok(PETIT_CHIBI_CAST.kogane.meaning.en.includes('gold'), 'kogane: gold');
  assert.ok(PETIT_CHIBI_CAST.zenimaru.meaning.en.includes('small change'), 'zenimaru: small change');
  assert.ok(PETIT_CHIBI_CAST.minori.meaning.en.includes('harvest'), 'minori: the harvest');
  assert.ok(PETIT_CHIBI_CAST.koneko.meaning.en.includes('cat'), 'koneko: the cat');
});

check('every palette has every colour the drawing reads', () => {
  const needed = [
    'hairDark', 'hairLight', 'highlight',
    'irisTop', 'irisMid', 'irisBottom',
    'cloth', 'clothAlt', 'accent', 'ribbon', 'skin', 'cheek',
  ];
  for (const id of PETIT_PERSONA_IDS) {
    const palette = PETIT_CHIBI_CAST[id].palette;
    for (const key of needed) {
      assert.ok(
        /^#[0-9A-Fa-f]{6}$/.test(palette[key] || ''),
        `${id}.${key} is not a hex colour: ${palette[key]}`
      );
    }
  }
});

check('no palette uses pure black for its lineart tones', () => {
  for (const id of PETIT_PERSONA_IDS) {
    const values = Object.values(PETIT_CHIBI_CAST[id].palette).map((v) => v.toLowerCase());
    assert.ok(!values.includes('#000000'), `${id} uses pure black`);
  }
});

check('the two personas are each other, not copies', () => {
  // Six characters that share a palette are one character with six
  // names.
  const seen = new Map();
  for (const id of PETIT_PERSONA_IDS) {
    const key = JSON.stringify(PETIT_CHIBI_CAST[id].palette);
    assert.ok(!seen.has(key), `${id} has the same palette as ${seen.get(key)}`);
    seen.set(key, id);
  }
  const hairs = new Set(PETIT_HAIR_STYLES);
  const props = new Set(PETIT_PROPS);
  assert.equal(hairs.size, 6, 'six distinct silhouettes');
  assert.equal(props.size, 6, 'six distinct props');
});

// ---------------------------------------------------------------------
// Who turns up on which page
// ---------------------------------------------------------------------

check('each page is answered by its own specialist', () => {
  for (const [id, want] of Object.entries(EXPECTED)) {
    assert.equal(getPetitPersona(want.page).id, id, `${want.page} -> ${id}`);
  }
});

check('the root does not swallow every other page', () => {
  // "/" is a prefix of everything. Matched carelessly, Mone would
  // answer for all six pages.
  assert.equal(getPetitPersona('/').id, 'mone', 'the root is Mone');
  assert.equal(getPetitPersona('/goals').id, 'minori', 'but /goals is not');
  assert.equal(getPetitPersona('/household').id, 'koneko', 'and /household is not');
});

check('a longer page wins over a shorter one', () => {
  assert.equal(getPetitPersona('/health-coach').id, 'minori');
  assert.equal(getPetitPersona('/goals/42').id, 'minori', 'a child path too');
});

check('an unknown id or page still gets somebody', () => {
  for (const nonsense of ['', null, undefined, 'nobody', '/a-page-nobody-owns']) {
    const who = getPetitPersona(nonsense);
    assert.ok(who && who.id, `${String(nonsense)} got nobody`);
    assert.equal(who.id, DEFAULT_PETIT_PERSONA, `${String(nonsense)} -> the default`);
  }
});

check('an id is answered directly, not treated as a path', () => {
  for (const id of PETIT_PERSONA_IDS) {
    assert.equal(getPetitPersona(id).id, id);
  }
});

check('petitText falls back rather than printing undefined', () => {
  const mone = PETIT_CHIBI_CAST.mone;
  assert.equal(petitText(mone, 'tagline', 'ja'), mone.tagline.ja);
  // A language nobody wrote falls back to Indonesian, not to blank.
  assert.equal(petitText(mone, 'tagline', 'de'), mone.tagline.id);
  assert.equal(petitText(mone, 'nothing', 'id'), '');
  assert.equal(petitText(null, 'tagline', 'id'), '');
});

// ---------------------------------------------------------------------
// Really drawn
// ---------------------------------------------------------------------

let drawn = null;

const renderAll = async () => {
  if (drawn) return drawn;
  const dir = mkdtempSync(join(FRONTEND, 'node_modules', '.petit-test-'));
  const entry = join(dir, 'entry.jsx');
  const out = join(dir, 'out.cjs');
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
    absWorkingDir: FRONTEND,
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://localhost/api', MODE: 'test' }) },
    logLevel: 'silent',
  });
  const require = createRequire(import.meta.url);
  const mod = require(out);
  drawn = { html: {}, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  for (const id of PETIT_PERSONA_IDS) {
    drawn.html[id] = mod.draw({ persona: id });
  }
  drawn.moods = {
    happy: mod.draw({ persona: 'mone', mood: 'happy' }),
    alert: mod.draw({ persona: 'mone', mood: 'alert' }),
    idle: mod.draw({ persona: 'mone', mood: 'idle' }),
  };
  return drawn;
};

check('all six render a valid svg tree', async () => {
  const d = await renderAll();
  for (const id of PETIT_PERSONA_IDS) {
    const html = d.html[id];
    assert.ok(html.includes('<svg'), `${id}: an svg`);
    assert.ok(html.includes('viewBox="0 0 200 220"'), `${id}: the plump chibi box`);
    assert.ok(html.includes(`data-persona="${id}"`), `${id}: labelled`);
    assert.ok(html.includes(`data-petit-kanji="${EXPECTED[id].kanji}"`), `${id}: the kanji is in the drawing`);
    assert.ok(html.split('<path').length > 12, `${id}: drawn with many paths`);
  }
});

check('each one wears their own silhouette and carries their own prop', async () => {
  const d = await renderAll();
  for (const [id, want] of Object.entries(EXPECTED)) {
    assert.ok(d.html[id].includes(`data-hair="${want.hair}"`), `${id}: ${want.hair}`);
    assert.ok(d.html[id].includes(`data-part="${want.prop}"`), `${id}: ${want.prop}`);
  }
});

check('nobody is carrying somebody else\u2019s prop', async () => {
  const d = await renderAll();
  for (const [id, want] of Object.entries(EXPECTED)) {
    for (const prop of PETIT_PROPS) {
      if (prop === want.prop) continue;
      assert.ok(
        !d.html[id].includes(`data-part="${prop}"`),
        `${id} is carrying ${prop}, which belongs to somebody else`
      );
    }
  }
});

check('every one of the six is a different drawing', async () => {
  const d = await renderAll();
  const seen = new Map();
  for (const id of PETIT_PERSONA_IDS) {
    // The uid differs per render, so compare the shape rather than
    // the exact string.
    const shape = d.html[id].replace(/id="[^"]*"|url\(#[^)]*\)|filter="[^"]*"/g, '');
    assert.ok(!seen.has(shape), `${id} is drawn identically to ${seen.get(shape)}`);
    seen.set(shape, id);
  }
});

check('the eyes are tinted with each character\u2019s own iris', async () => {
  const d = await renderAll();
  for (const id of PETIT_PERSONA_IDS) {
    const palette = PETIT_CHIBI_CAST[id].palette;
    assert.ok(d.html[id].includes(palette.irisTop), `${id}: irisTop`);
    assert.ok(d.html[id].includes(palette.irisMid), `${id}: irisMid`);
    assert.ok(d.html[id].includes(palette.irisBottom), `${id}: irisBottom`);
  }
});

check('the lineart stays berry-sepia for every character', async () => {
  const d = await renderAll();
  for (const id of PETIT_PERSONA_IDS) {
    assert.ok(d.html[id].includes('#4A3540'), `${id}: the ink`);
    assert.ok(!d.html[id].includes('#000000'), `${id}: no pure black`);
  }
});

check('every character keeps the 2000s angel ring and the sticker border', async () => {
  const d = await renderAll();
  for (const id of PETIT_PERSONA_IDS) {
    assert.ok(d.html[id].includes('data-part="halo-highlight"'), `${id}: the angel ring`);
    assert.ok(d.html[id].includes('feMorphology'), `${id}: the sticker border`);
  }
});

// ---------------------------------------------------------------------
// The emotes
// ---------------------------------------------------------------------

check('the mood decides which 2000s reaction symbol is shown', async () => {
  const d = await renderAll();
  assert.ok(d.moods.happy.includes('data-emote="kirakira"'), 'happy: stars');
  assert.ok(d.moods.happy.includes('data-emote-part="flower"'), 'happy: the flower');
  assert.ok(d.moods.alert.includes('data-emote="sweat"'), 'alert: the sweat drop');
  assert.ok(d.moods.alert.includes('data-emote-part="bangs"'), 'alert: the double bang');
  assert.ok(d.moods.alert.includes('#90CAF9'), 'alert: the drop is blue');
  assert.ok(d.moods.idle.includes('data-emote="melody"'), 'idle: the notes');
});

check('the emotes are drawn, not typed as emoji', () => {
  const emoteBlock = ART.slice(ART.indexOf('export function renderAnimeEmote'));
  const body = emoteBlock.slice(0, emoteBlock.indexOf('\nexport function renderPetitPersona'));
  // An emoji here would be a different picture on every machine.
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(body), 'an emoji got into the emote renderer');
  assert.ok(body.includes('<path'), 'the symbols are paths');
});

// ---------------------------------------------------------------------
// The motion loops and the dock
// ---------------------------------------------------------------------

check('the three petit motion loops exist', () => {
  assert.ok(/\.petit-poyo-bounce[^{]*\{[^}]*petitPoyo/.test(CSS), 'the bounce');
  assert.ok(/@keyframes petitPoyo/.test(CSS), 'its keyframes');
  assert.ok(/scale\(1\.07, 0\.93\)/.test(CSS), 'the squash');
  assert.ok(/scale\(0\.96, 1\.05\)/.test(CSS), 'and the stretch');
  assert.ok(/\.petit-totoko-walk[^{]*\{[^}]*petitWaddle/.test(CSS), 'the waddle');
  assert.ok(/rotate\(-3deg\)/.test(CSS) && /rotate\(3deg\)/.test(CSS), 'the waddle tilt');
  assert.ok(/\.shoujo-kirakira-float\s*\{[^}]*shoujoKirakira/.test(CSS), 'the drifting sparkles');
});

check('the bounce is a one-shot, so it can play again', () => {
  // A class that is never taken off plays once and never again.
  assert.ok(MASCOT.includes('setBounced(true)'), 'it goes on');
  assert.ok(MASCOT.includes('setBounced(false)'), 'and it comes off');
  assert.ok(MASCOT.includes("'petit-poyo-bounce'"), 'the class');
});

check('the reduced-motion request silences the petit loops too', () => {
  // Every reduced-motion block, not only the last: reading just the
  // final one silently tests whichever group was appended most
  // recently.
  const blocks = CSS.split('@media (prefers-reduced-motion: reduce)').slice(1).join('\n');
  for (const sel of ['.petit-poyo-bounce', '.petit-totoko-walk', '.shoujo-kirakira-float']) {
    assert.ok(blocks.includes(sel), sel);
  }
});

check('the popover offers all six plus auto-by-page', async () => {
  const d = await renderAll();
  assert.ok(MASCOT.includes('AUTO_PERSONA'), 'the auto mode exists');
  assert.ok(MASCOT.includes('shoujo-petit-dock'), 'the dock');
  assert.ok(MASCOT.includes('data-testid={`shoujo-persona-${id}`}'), 'a portrait each');
  assert.ok(MASCOT.includes('shoujo-persona-auto'), 'and the auto button');
  // The header shows the name, the kanji and what it means.
  assert.ok(MASCOT.includes('shoujo-petit-kanji'), 'the kanji badge');
  assert.ok(MASCOT.includes('shoujo-petit-tagline'), 'the tagline');
  assert.ok(d.html.mone.includes('data-testid="shoujo-mascot-svg"'), 'and the character still draws');
});

check('the question box is still wired to the real agent', () => {
  assert.ok(MASCOT.includes('api.ai.agent('), 'the agent');
  assert.ok(MASCOT.includes('shoujo-ask-input'), 'the input');
  for (const chip of ['chip_analyse', 'chip_snack', 'chip_record']) {
    assert.ok(MASCOT.includes(chip), chip);
  }
});

// ---------------------------------------------------------------------
// Wearable as a face
// ---------------------------------------------------------------------

check('the six are offered as avatars, and the server knows them', () => {
  const picker = read('src/components/settings/AvatarPicker.jsx');
  assert.ok(picker.includes('PETIT_PERSONA_IDS'), 'the picker offers them');
  assert.ok(picker.includes('avatar-petit-'), 'by their asset name');

  const helper = read('src/utils/avatarHelper.js');
  for (const id of PETIT_PERSONA_IDS) {
    assert.ok(helper.includes(`avatar-petit-${id}`), `the helper knows ${id}`);
  }

  // The server has a whitelist, and an avatar it does not recognise is
  // answered with the default - so a member wearing one of the guild
  // would be handed the green circle back without being told.
  const service = read('../backend/app/services/household_service.py');
  assert.ok(service.includes('PETIT_AVATARS'), 'the server has them');
  for (const id of PETIT_PERSONA_IDS) {
    assert.ok(service.includes(`avatar-petit-${id}`), `the server whitelists ${id}`);
  }
});

check('every guild avatar id fits the column it is stored in', () => {
  // household.avatar is String(40).
  for (const id of PETIT_PERSONA_IDS) {
    const asset = `avatar-petit-${id}`;
    assert.ok(asset.length <= 40, `${asset} is ${asset.length} chars`);
  }
});

check('the avatar drawings are generated, not hand-written', () => {
  // The preflight checks the generated files against the generator
  // byte for byte, so a hand-written SVG here would fail the build.
  const gen = read('../scripts/generate_assets.py');
  assert.ok(gen.includes('_petit_avatar'), 'the generator draws them');
  assert.ok(gen.includes('avatar-petit-'), 'and registers them');
  assert.ok(gen.includes('lambda persona=persona'), 'binding the loop variable per entry');
  for (const id of PETIT_PERSONA_IDS) {
    assert.ok(gen.includes(`"${id}"`), `${id} is in the generator`);
    readFileSync(join(FRONTEND, `public/assets/generated/brand/avatar-petit-${id}.svg`));
  }
});

// ---------------------------------------------------------------------

const run = async () => {
  for (const fn of pending) await fn();
  if (drawn) drawn.cleanup();
  console.log('');
  if (failed === 0) {
    console.log(`petit chibi guild: all ${passed} checks passed`);
  } else {
    console.log(`petit chibi guild: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
};

run();
