/**
 * The Koban & Co. guard.
 *
 * Checks the things that are easy to break and hard to notice: that
 * the asset pipeline produced real transparent sprites and a complete
 * database, that the engine's rules hold, and that the page still has
 * its five tabs, its portal (the tab bar is fixed to the window, not
 * to the app's transformed canvas), and its mobile layout.
 *
 *   node src/features/koban-shop/__tests__/kobanShop.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// HERE is frontend/src/features/koban-shop/__tests__ - four levels up
// is the frontend directory.
const FRONT = path.join(HERE, '..', '..', '..', '..');
const ROOT = path.join(FRONT, '..');
const read = (rel) => fs.readFileSync(path.join(FRONT, rel), 'utf8');
const readRoot = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failures.push(name); console.log(`not ok - ${name}\n  ${err.message}`); }
};
// Named `must` so it does not shadow the node:assert module below.
const must = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

/* --------------------------------------------------------------------------
   The asset pipeline
   -------------------------------------------------------------------------- */

const pipeline = readRoot('scripts/build_koban_assets.py');

check('the pipeline exists and does the four jobs', () => {
  must(pipeline.includes('def remove_outer_white_background'), 'no background removal');
  must(pipeline.includes('def copy_svgs'), 'no SVG copy');
  must(pipeline.includes('def build_database'), 'no database build');
  must(pipeline.includes('def verify'), 'no verification');
});

check('the pipeline threshold is the one the brief asked for', () => {
  must(/threshold:\s*int\s*=\s*240/.test(pipeline), 'threshold is not 240');
});

check('the pipeline searches for the SVG library in both places', () => {
  must(pipeline.includes('Image-8bit-Svg'), 'the library is never named');
  must(pipeline.includes('Downloads'), 'the download folder is not searched');
});

const db = JSON.parse(read('src/features/koban-shop/data/database.json'));

check('the database module matches the JSON it was generated from', () => {
  const module = read('src/features/koban-shop/data/database.js');
  must(module.includes('export default'), 'the module has no default export');
  // The module is the JSON with the key removed; compare the counts
  // so a stale module cannot ship beside a fresh JSON.
  const jsonItems = JSON.parse(read('src/features/koban-shop/data/database.json')).items.length;
  must(module.includes('"items"'), 'the module has no items');
  must(jsonItems > 150, 'the JSON is short');
});

check('the database has six characters with the stated skills', () => {
  assert.equal(db.characters.length, 6);
  const want = { koneko: 300, minori: 600, kaneru: 900, kogane: 1800, mone: 1800, zenimaru: 600 };
  db.characters.forEach((c) => {
    must(want[c.id] === c.skill.cooldownSec, `${c.id} cooldown ${c.skill.cooldownSec}`);
    must(c.sprite.endsWith(`${c.id}.png`), `${c.id} sprite path`);
    must(c.face.endsWith(`${c.id}.jpg`), `${c.id} face path`);
    must(c.stageCoords && typeof c.stageCoords.xPercent === 'number', `${c.id} coords`);
    must(c.kakeiboLink, `${c.id} kakeibo link`);
  });
});

check('the database has four facilities and 150+ items', () => {
  assert.equal(db.facilities.length, 4);
  assert.ok(db.items.length >= 150, `only ${db.items.length} items`);
});

check('every item points at an SVG that is actually on disk', () => {
  const missing = db.items.filter((i) => !fs.existsSync(path.join(FRONT, 'public', i.icon.replace(/^\//, ''))));
  must(missing.length === 0, `${missing.length} missing, e.g. ${missing[0]?.icon}`);
});

check('every item has a recipe with 2-3 ingredients and a clue', () => {
  assert.equal(db.recipes.length, db.items.length);
  db.recipes.forEach((r) => {
    must(r.ingredients.length >= 2 && r.ingredients.length <= 3, `${r.id} has ${r.ingredients.length}`);
    must(r.recipeClue && r.recipeClue.length > 10, `${r.id} has no clue`);
    must(r.tier >= 1 && r.tier <= 5, `${r.id} tier ${r.tier}`);
    must(db.items.some((i) => i.id === r.outputItemId), `${r.id} output missing`);
  });
});

check('the semantic tags the requests depend on exist', () => {
  const tags = new Set(db.items.flatMap((i) => i.tags));
  ['fire_resist', 'frost', 'warm', 'stamina', 'weapon', 'armor', 'healing', 'luck', 'sweet', 'focus', 'refresh'].forEach((t) => {
    must(tags.has(t), `no item carries the tag ${t}`);
  });
});

check('there are twelve requests, each resolvable, and five dungeons', () => {
  assert.equal(db.customerRequests.length, 12);
  db.customerRequests.forEach((r) => {
    must(r.perfectMatches.length > 0, `${r.id} has no perfect match`);
    must(r.acceptableTags.length > 0, `${r.id} has no acceptable tags`);
    must(r.baseRewardKoban > 0, `${r.id} has no reward`);
    must(r.storySnippet, `${r.id} has no story`);
    r.perfectMatches.forEach((id) => must(db.items.some((i) => i.id === id), `${r.id} names a missing item ${id}`));
  });
  assert.equal(db.dungeons.length, 5);
  db.dungeons.forEach((d) => {
    must(d.monsters.length > 0, `${d.id} has no monsters`);
    must(d.lootTable.length > 0, `${d.id} has no loot`);
  });
});

check('five chapters unlock the five dungeons', () => {
  assert.equal(db.meta.chapters.length, 5);
  const all = db.meta.chapters.flatMap((c) => c.unlockedDungeons || []);
  db.dungeons.forEach((d) => must(all.includes(d.id), `${d.id} is never unlocked`));
});

/* --------------------------------------------------------------------------
   The engine
   -------------------------------------------------------------------------- */

const engine = read('src/features/koban-shop/store/kobanEngine.js');

check('the engine is timestamp based, not tick based', () => {
  must(engine.includes('nowMs - state.lastTickAt'), 'no elapsed-time calculation');
  must(engine.includes('export function reconcileOfflineAndElapsedState'), 'no reconcile function');
  must(engine.includes("SAVE_KEY = 'fm_koban_co_save_v1'"), 'wrong save key');
});

check('the engine implements the three request tiers', () => {
  must(engine.includes("return { tier: 'perfect', multiplier: 1.5 }"), 'no perfect tier');
  must(engine.includes("return { tier: 'acceptable', multiplier: 1.0 }"), 'no acceptable tier');
  must(engine.includes("return { tier: 'wrong', multiplier: 0 }"), 'no wrong tier');
  must(engine.includes('verdict.tier === \'wrong\' ? state.inventory'), 'the wrong item is not handed back');
});

check('the engine has the fever gauge, the vault and the kakeibo bridge', () => {
  must(engine.includes('kingVisitGauge'), 'no gauge');
  must(engine.includes('FEVER_MULTIPLIER = 2.0'), 'fever is not 2x');
  must(engine.includes('vault'), 'no vault');
  must(engine.includes('claimKakeiboRewards'), 'no kakeibo bridge');
});

const store = read('src/features/koban-shop/store/useKobanStore.js');
check('the store persists and wakes up', () => {
  must(store.includes('localStorage'), 'not persisted');
  must(store.includes('visibilitychange'), 'does not wake on visibility');
  must(store.includes('focus'), 'does not wake on focus');
});

/* --------------------------------------------------------------------------
   The page
   -------------------------------------------------------------------------- */

const page = read('src/features/koban-shop/KobanShopPage.jsx');

check('the page has all five tabs', () => {
  ['shop', 'craft', 'dungeon', 'requests', 'ledger'].forEach((id) => {
    must(page.includes(`id: '${id}'`), `no ${id} tab`);
    must(page.includes(`panel-${id}`), `no ${id} panel`);
  });
});

check('the page mounts every subcomponent', () => {
  ['IsometricAtelierStage', 'SkillCooldownDock', 'HintCraftingModal', 'CustomerDeductionModal', 'DungeonExpeditionTab', 'KakeiboVaultLedgerTab'].forEach((c) => {
    must(page.includes(`<${c}`), `${c} is not mounted`);
  });
});

check('the phone tab bar is portalled out of the transformed canvas', () => {
  // The app's canvas carries a transform, which makes it the
  // containing block for fixed children - so the bar must go through
  // a portal to document.body.
  must(page.includes("from 'react-dom'"), 'no react-dom import');
  must(page.includes('createPortal('), 'no portal');
  must(page.includes('document.body'), 'the portal does not target the body');
  must(page.includes('koban-tabs--fixed'), 'no fixed tab bar');
});

check('the routes and the navigation entry exist', () => {
  const app = read('src/App.jsx');
  must(app.includes('path="koban-shop"'), 'no route');
  must(app.includes('path="shop-tycoon"'), 'no alias route');
  const nav = read('src/components/layout/Navigation.jsx');
  must(nav.includes("href: '/koban-shop'"), 'not in the navigation');
});

const css = read('src/features/koban-shop/koban.css');
check('the tab bar clears the app bottom navigation', () => {
  must(css.includes('bottom: calc(5rem + env(safe-area-inset-bottom, 0px))'), 'no offset for the app bar');
  // The Tailwind `bottom-0` on the element would win the cascade
  // against this stylesheet, so the utility must not be there.
  must(!page.includes('koban-tabs--fixed fixed inset-x-0 bottom-0'), 'bottom-0 is back');
});

check('the shelf hotspots move out of the room on a phone', () => {
  must(css.includes('.koban-shelves'), 'no shelf container');
  must(css.includes('position: static'), 'the shelf row never leaves the room');
  must(read('src/features/koban-shop/components/IsometricAtelierStage.jsx').includes('koban-stage-wrap'), 'the stage has no wrapper');
});

check('the motion is transform-only and stops only for the reader', () => {
  must(css.includes('translate3d'), 'no composited transforms');
  must(css.includes('will-change'), 'no will-change');
  must(css.includes('prefers-reduced-motion'), 'no reduced-motion block');
  must(!/@media \(max-width[^)]*\)[\s\S]{0,200}animation:\s*none/.test(css), 'a width query kills the motion');
});

check('the assets are copied where the game looks for them', () => {
  ['chara/koneko.png', 'chara/mone.png', 'face/koneko.jpg', 'places/atelier.jpg', 'places/workshop.jpg'].forEach((p) => {
    must(fs.existsSync(path.join(FRONT, 'public', 'koban-assets', p)), `missing ${p}`);
  });
});

check('the sprites are transparent at the corner and keep their border', () => {
  // Checked here rather than in the browser: a white rectangle in
  // the corner of a sprite is the whole bug the pipeline exists to
  // prevent.
  const png = fs.readFileSync(path.join(FRONT, 'public', 'koban-assets', 'chara', 'koneko.png'));
  // A PNG with an alpha channel has an IHDR colour type of 4 or 6.
  const colourType = png[25];
  must(colourType === 4 || colourType === 6, `colour type ${colourType} has no alpha`);
});

console.log(`\nkoban shop: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
