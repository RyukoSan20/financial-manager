/**
 * The tilemap guard.
 *
 * The rooms of Koban & Co. are built from tiles, not from the
 * photographs in asset/places/ (those are moodboards). This checks
 * that: that the shop stage never loads a photograph, that the tiles
 * exist, that depth is one rule (floor of the feet's y in pixels),
 * that bodies cannot walk through furniture, and that customers can
 * always find a way from the door to every display slot.
 *
 *   node src/features/koban-shop/__tests__/kobanTilemap.test.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../store/shopMap.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.join(HERE, '..', '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(FRONT, rel), 'utf8');

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failures.push(name); console.log(`not ok - ${name}\n  ${err.message}`); }
};

const SHOP = M.SHOP_MAP;
const COMPONENTS = 'src/features/koban-shop/components';

check('no scene component loads atelier or workshop as a picture', () => {
  for (const f of fs.readdirSync(path.join(FRONT, COMPONENTS))) {
    const src = read(`${COMPONENTS}/${f}`);
    assert.ok(!/atelier\.(jpe?g|webp|png)|workshop\.(jpe?g|webp|png)|facility_\w+\.(png|webp)/.test(src), `${f} loads a moodboard`);
    assert.ok(!/DB\.meta\.scenes/.test(src), `${f} reads the scene photographs`);
  }
  assert.ok(!fs.existsSync(path.join(FRONT, COMPONENTS, 'IsometricAtelierStage.jsx')), 'the photo-backed stage is still there');
});

check('the named tiles exist as transparent or full PNGs', () => {
  for (const n of ['floor_wood', 'wall_brick', 'counter_front', 'shelf_wood', 'umbrella_table']) {
    const f = path.join(FRONT, 'public/koban-assets/tiles', `tile_${n}.png`);
    assert.ok(fs.existsSync(f), `tile_${n}.png is missing`);
    assert.equal(fs.readFileSync(f).subarray(1, 4).toString(), 'PNG');
  }
});

check('every tile the map names is on disk', () => {
  const used = new Set(SHOP.props.map((p) => p.tile));
  for (let r = 0; r < SHOP.rows; r += 1) for (let c = 0; c < SHOP.cols; c += 1) used.add(SHOP.groundAt(c, r));
  for (const t of used) assert.ok(fs.existsSync(path.join(FRONT, 'public/koban-assets/tiles', `tile_${t}.png`)), `tile_${t}.png`);
});

check('the stage is built cell by cell, props are depth-sorted by one rule', () => {
  const stage = read(`${COMPONENTS}/IsometricTilemapStage.jsx`);
  assert.ok(stage.includes('map.rows') && stage.includes('map.cols'), 'no grid');
  assert.ok(stage.includes('depthOf('), 'props are not sorted by depthOf');
  assert.equal(M.depthOf(11.3), Math.floor(11.3 * M.TILE));
  const sim = read(`${COMPONENTS}/useShopSimulationLoop.js`);
  assert.ok(sim.includes('depthOf(npc.y)'), 'customers are not sorted by depthOf');
  assert.ok(sim.includes('moveBody(') && sim.includes('findPath('), 'customers do not collide or path-find');
});

check('a person above the counter is behind it, below it in front', () => {
  const counterY = SHOP.props.find((p) => p.id === 'counter_8').y;
  assert.ok(M.depthOf(SHOP.spots.browseY) < M.depthOf(counterY));
  assert.ok(M.depthOf(SHOP.spots.koneko.y) > M.depthOf(counterY));
  assert.ok(M.depthOf(SHOP.spots.kaneru.y) < M.depthOf(SHOP.spots.koneko.y));
});

check('bodies are stopped by the counter, the pillars and the tables', () => {
  assert.equal(M.canStand(SHOP, 8, 12), false, 'stands in the counter');
  assert.equal(M.canStand(SHOP, 4.15, 6.0), false, 'stands in a pillar');
  assert.equal(M.canStand(SHOP, 1.1, 10.2), false, 'stands in a table');
  assert.equal(M.canStand(SHOP, 8, 9), true, 'cannot stand on the carpet');
  const moved = M.moveBody(SHOP, { x: 8, y: 11.0 }, 0, 0.8);
  assert.ok(moved.hit && moved.y < 11.6, 'walked through the counter');
  const slid = M.moveBody(SHOP, { x: 8, y: 11.0 }, 0.3, 0.8);
  assert.ok(slid.x > 8, 'does not slide along the counter');
});

check('furniture has bounding boxes and the walk grid respects them', () => {
  const solids = M.solidsOf(SHOP);
  assert.ok(solids.length >= 7, 'too little furniture is solid');
  for (const s of solids) for (const k of ['x', 'y', 'w', 'h']) assert.equal(typeof s[k], 'number');
  const grid = M.walkGrid(SHOP);
  assert.equal(grid[11][8], false, 'the counter row is walkable');
  assert.equal(grid[9][8], true, 'the carpet is not walkable');
});

check('a customer can walk from the door to every slot, and never through a solid', () => {
  for (const x of M.SLOT_X) {
    const path_ = M.findPath(SHOP, SHOP.spots.door, { x, y: SHOP.spots.browseY });
    assert.ok(path_.length >= 2, `no path to slot at ${x}`);
    const last = path_[path_.length - 1];
    assert.ok(Math.abs(last.x - x) < 1e-6 && Math.abs(last.y - SHOP.spots.browseY) < 1e-6, 'path does not end at the slot');
    let at = { ...SHOP.spots.door };
    for (const p of path_) {
      for (let i = 1; i <= 8; i += 1) {
        const x2 = at.x + ((p.x - at.x) * i) / 8;
        const y2 = at.y + ((p.y - at.y) * i) / 8;
        assert.ok(M.canStand(SHOP, x2, y2, M.BODY), `path to ${x} crosses a solid at ${x2.toFixed(2)},${y2.toFixed(2)}`);
      }
      at = p;
    }
  }
  for (const seat of SHOP.spots.seats) assert.ok(M.findPath(SHOP, SHOP.spots.door, seat).length >= 2, 'no way to a seat');
});

check('the four workshops are tilemaps with a keeper standing on the floor', () => {
  for (const id of ['restaurant', 'wizardry', 'blacksmith', 'seamstress']) {
    const m = M.facilityMap(id);
    assert.ok(m.cols > 0 && m.rows > 0);
    assert.ok(M.canStand(m, m.spots.keeper.x, m.spots.keeper.y + 0.9) || m.spots.keeper.y < m.walk.y1, `${id} keeper is off the floor`);
  }
});

check('the portrait art is not on the overworld', () => {
  for (const f of ['ParallelShopViewport.jsx', 'IsometricTilemapStage.jsx', 'useShopSimulationLoop.js', 'ParallelRpgSprite.jsx', 'SideViewBattleStage.jsx', 'QuestTab.jsx']) {
    assert.ok(!/koban-assets\/(chara|motion|rig)\//.test(read(`${COMPONENTS}/${f}`)), `${f} uses a portrait on the map`);
  }
  assert.ok(read(`${COMPONENTS}/RiggedCharacterPuppet.jsx`).includes('rig'), 'the puppet lost its rig');
});

console.log(`\nkoban tilemap: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
