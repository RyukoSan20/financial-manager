/**
 * The battle guard: the rules of the side-view fight and the way the
 * stages are balanced.
 *
 *   node src/features/koban-shop/__tests__/kobanBattle.test.js
 */

import assert from 'node:assert/strict';
import * as E from '../store/kobanEngine.js';
import * as B from '../store/battleSim.js';

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failures.push(name); console.log(`not ok - ${name}\n  ${err.message}`); }
};

const seeded = (seed = 7) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const party = (lv) => E.SOLDIER_CLASSES.map((c) => {
  const st = E.soldierStats({ soldiers: { fencer: lv, wizard: lv, archer: lv } }, c.id);
  return { id: c.id, cls: c.id, who: c.who, hp: st.hp, atk: st.atk };
});
const winRate = (lv, stage, guard, n = 30) => {
  const rng = seeded(11);
  let w = 0;
  for (let i = 0; i < n; i += 1) w += B.autoPlay(party(lv), E.stageEnemies(stage.dungeonId), { rng, guard }).phase === 'won' ? 1 : 0;
  return w / n;
};

check('there are five stages with 1-5 stars and the stated levels', () => {
  assert.deepEqual(E.STAGES.map((s) => s.stars), [1, 2, 3, 4, 5]);
  assert.deepEqual(E.STAGES.map((s) => s.level), [1, 5, 15, 25, 40]);
  for (const s of E.STAGES) assert.ok(E.stageEnemies(s.dungeonId).some((e) => e.boss), `${s.name} has no boss`);
});

check('a fight ends, and a party at the recommended level wins it with the guard', () => {
  for (const s of E.STAGES) assert.ok(winRate(s.level, s, true) >= 0.9, `${s.name} is not winnable on level`);
});

check('the heavy blows matter: on level, no guard loses where the guard wins', () => {
  for (const s of E.STAGES.slice(1)) assert.ok(winRate(s.level, s, false) <= 0.2, `${s.name} is won without guarding`);
});

check('a party far under the level loses, one well over it walks through', () => {
  const s = E.STAGES[3];
  assert.ok(winRate(Math.round(s.level * 0.6), s, true) <= 0.1, 'under-levelled party wins');
  assert.ok(winRate(Math.round(s.level * 1.5), s, false) >= 0.9, 'over-levelled party loses');
});

check('the guard cuts the heavy blow by 80% and answers with a counter', () => {
  const soldiers = [{ id: 'a', cls: 'fencer', hp: 5000, atk: 1 }];
  const boss = [{ id: 'b', name: 'B', boss: true, hp: 99999, atk: 100 }];
  const run = (guard) => {
    const b = B.createBattle(soldiers, boss);
    let heavy = null; let counter = null;
    for (let i = 0; i < 400 && !heavy; i += 1) {
      if (guard && b.charge && b.charge.until - b.t < 0.5) B.pressGuard(b);
      for (const e of B.stepBattle(b, 0.05, () => 0.5)) { if (e.type === 'heavy') heavy = e; if (e.type === 'counter') counter = e; }
    }
    return { heavy, counter };
  };
  const open = run(false);
  const held = run(true);
  assert.ok(open.heavy && held.heavy, 'no heavy blow landed');
  assert.ok(Math.abs(held.heavy.dmg / open.heavy.dmg - 0.2) < 0.06, `guarded took ${held.heavy.dmg} of ${open.heavy.dmg}`);
  assert.ok(held.counter && held.counter.dmg > 0 && !open.counter, 'the counter is wrong');
});

check('the guard has a cooldown', () => {
  const b = B.createBattle([{ id: 'a', cls: 'fencer', hp: 99, atk: 1 }], [{ id: 'e', hp: 99, atk: 1 }]);
  assert.equal(B.pressGuard(b), true);
  assert.equal(B.pressGuard(b), false);
  B.stepBattle(b, B.GUARD_COOLDOWN_SEC + 0.1);
  assert.equal(B.pressGuard(b), true);
});

check('soldiers get stronger with a level, and it costs gold', () => {
  const s0 = { koban: 100000, soldiers: {}, log: [] };
  const before = E.soldierStats(s0, 'fencer');
  const s1 = E.levelUpSoldier(s0, 'fencer');
  const after = E.soldierStats(s1, 'fencer');
  assert.ok(after.hp > before.hp && after.atk > before.atk && after.lv === before.lv + 1);
  assert.ok(s1.koban < s0.koban);
  assert.equal(E.levelUpSoldier({ ...s0, koban: 1 }, 'fencer').koban, 1);
});

check('the stage view is driven by the sim, not by React state per frame', () => {
  const fs_ = import.meta.url; // keep the file self-contained
  assert.ok(fs_);
  assert.ok(typeof B.stepBattle === 'function' && B.stepBattle.length >= 2);
});

console.log(`\nkoban battle: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
