/**
 * The economy of Koban & Co., tested from plain node.
 *

 *   node src/features/koban-shop/__tests__/kobanEngine.test.js
 *
 * Time is an input to every rule, so every test here passes an exact
 * `nowMs` and no test waits.
 */

import assert from 'node:assert/strict';
import * as E from '../store/kobanEngine.js';

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok - ${name}`); }
  catch (err) { failures.push(name); console.log(`not ok - ${name}\n  ${err.message}`); }
};

const T0 = 1_700_000_000_000;
const fixedRng = (v) => () => v;

check('the database has what the shop needs', () => {
  assert.equal(E.DB.characters.length, 6);
  assert.equal(E.DB.facilities.length, 4);
  assert.ok(E.DB.items.length >= 150, `only ${E.DB.items.length} items`);
  assert.equal(E.DB.dungeons.length, 5);
  assert.equal(E.DB.customerRequests.length, 12);
  assert.ok(E.DB.items.every((i) => i.icon.startsWith('/koban-assets/svg/')));
  const facilities = new Set(E.DB.items.map((i) => i.facility));
  ['restaurant', 'blacksmith', 'seamstress', 'wizardry'].forEach((f) => assert.ok(facilities.has(f), f));
});

check('a new shop has stock, a little koban, and the clock set', () => {
  const s = E.initialState(T0);
  assert.equal(s.lastTickAt, T0);
  assert.ok(s.koban > 0);
  assert.ok(Object.keys(s.inventory).length >= 3);
  assert.equal(s.shelves.length, 3);
});

check('offline sales are computed from elapsed time, not ticks', () => {
  let s = E.initialState(T0);
  const itemId = Object.keys(s.inventory)[0];
  s = E.restockShelf(s, 'wood_rack', itemId, 4, T0);
  const price = s.shelves.find((x) => x.id === 'wood_rack').unitPrice;
  // Ten minutes away: 600s / 45s = 13 possible, capped at the 4 stocked.
  const after = E.reconcileOfflineAndElapsedState(s, T0 + 600_000);
  assert.equal(after.shelves.find((x) => x.id === 'wood_rack').qty, 0);
  assert.equal(after.koban, s.koban + price * 4);
  assert.equal(after.pendingOfflineReport.itemsSoldCount, 4);
  assert.equal(after.lastTickAt, T0 + 600_000);
});

check('a gap under a minute shows no offline report', () => {
  let s = E.initialState(T0);
  const itemId = Object.keys(s.inventory)[0];
  s = E.restockShelf(s, 'wood_rack', itemId, 4, T0);
  const after = E.reconcileOfflineAndElapsedState(s, T0 + 50_000);
  assert.equal(after.pendingOfflineReport, null);
  assert.equal(after.shelves.find((x) => x.id === 'wood_rack').qty, 3);
});

check('reconciling twice with the same clock changes nothing', () => {
  let s = E.initialState(T0);
  s = E.restockShelf(s, 'glass_case', Object.keys(s.inventory)[0], 2, T0);
  const a = E.reconcileOfflineAndElapsedState(s, T0 + 100_000);
  const b = E.reconcileOfflineAndElapsedState(a, T0 + 100_000);
  assert.equal(a, b);
});

check("Koneko's bell triples the sale rate", () => {
  let s = E.initialState(T0);
  const itemId = Object.keys(s.inventory)[0];
  s = { ...s, inventory: { ...s.inventory, [itemId]: 20 } };
  s = E.restockShelf(s, 'wood_rack', itemId, 20, T0);
  s = E.activateSkill(s, 'koneko', T0);
  assert.equal(s.activeBuffs.konekoBellUntil, T0 + 30_000);
  const after = E.reconcileOfflineAndElapsedState(s, T0 + 30_000);
  // 30s at 15s each = 2 sold; without the bell it would be 0.
  assert.equal(after.shelves.find((x) => x.id === 'wood_rack').qty, 18);
});

check('the gauge fills with sales and tips into fever at 100', () => {
  let s = E.initialState(T0);
  const itemId = Object.keys(s.inventory)[0];
  s = { ...s, inventory: { ...s.inventory, [itemId]: 20 }, kingVisitGauge: 90 };
  s = E.restockShelf(s, 'wood_rack', itemId, 20, T0);
  const after = E.reconcileOfflineAndElapsedState(s, T0 + 45_000 * 3);
  assert.ok(after.feverModeUntil > T0, 'fever started');
  assert.equal(after.kingVisitGauge, 0, 'gauge reset');
});

check('fever doubles the price', () => {
  let s = E.initialState(T0);
  const itemId = Object.keys(s.inventory)[0];
  s = E.restockShelf(s, 'wood_rack', itemId, 2, T0);
  s = { ...s, feverModeUntil: T0 + 999_000 };
  const price = s.shelves.find((x) => x.id === 'wood_rack').unitPrice;
  const after = E.reconcileOfflineAndElapsedState(s, T0 + 45_000);
  assert.equal(after.koban, s.koban + price * 2);
});

check('skills respect their cooldowns', () => {
  let s = E.initialState(T0);
  s = E.activateSkill(s, 'zenimaru', T0);
  assert.equal(s.skills.zenimaru.cooldownUntilMs, T0 + 600_000);
  const again = E.activateSkill(s, 'zenimaru', T0 + 1000);
  assert.equal(again, s, 'second tap during cooldown is ignored');
  const later = E.activateSkill(s, 'zenimaru', T0 + 600_001);
  assert.notEqual(later, s);
});

check('every character has the stated cooldown', () => {
  const want = { koneko: 300, minori: 600, kaneru: 900, kogane: 1800, mone: 1800, zenimaru: 600 };
  Object.entries(want).forEach(([id, cd]) => assert.equal(E.CHARACTERS[id].skill.cooldownSec, cd, id));
});

check("Kogane's watch pulls an hour of sales forward", () => {
  let s = E.initialState(T0);
  const itemId = Object.keys(s.inventory)[0];
  s = { ...s, inventory: { ...s.inventory, [itemId]: 20 } };
  s = E.restockShelf(s, 'wood_rack', itemId, 20, T0);
  const after = E.activateSkill(s, 'kogane', T0);
  // 3600s / 45s = 80 possible, capped at 20.
  assert.equal(after.shelves.find((x) => x.id === 'wood_rack').qty, 0);
  assert.equal(after.pendingOfflineReport, null, 'a warp is not an offline report');
});

check("Mone's interest pays 5% of the vault", () => {
  let s = { ...E.initialState(T0), koban: 1000 };
  s = E.depositVault(s, 400, T0);
  const k = s.koban;
  s = E.activateSkill(s, 'mone', T0);
  assert.equal(s.koban, k + 20);
});

check('a deposit is capped at the koban in hand', () => {
  const s = { ...E.initialState(T0), koban: 300 };
  const after = E.depositVault(s, 1000, T0);
  assert.equal(after.vault.balance, 300);
  assert.equal(after.koban, 0);
});

check('the vault compounds hourly while away', () => {
  let s = { ...E.initialState(T0), koban: 1000 };
  s = E.depositVault(s, 1000, T0);
  const after = E.reconcileOfflineAndElapsedState(s, T0 + 10 * 3600_000);
  assert.equal(after.vault.balance, Math.round(1000 * Math.pow(1.004, 10)));
});

check('discovery: the right raw combination unlocks and crafts', () => {
  let s = E.initialState(T0);
  const recipe = E.DB.recipes.find((r) => r.tier === 1 && !s.knownRecipes.includes(r.id));
  const raw = { ...s.rawInventory };
  recipe.ingredients.forEach((i) => { raw[i.itemId] = 5; });
  s = { ...s, rawInventory: raw };
  const out = E.discoverRecipe(s, recipe.ingredients.map((i) => i.itemId), T0, fixedRng(0.9));
  assert.equal(out.discovered, recipe.id);
  assert.ok(out.state.knownRecipes.includes(recipe.id));
  assert.equal(out.state.inventory[recipe.outputItemId], 1);
});

check('discovery: a wrong combination costs nothing', () => {
  const s = E.initialState(T0);
  const out = E.discoverRecipe(s, ['raw_nonexistent_a', 'raw_nonexistent_b'], T0);
  assert.equal(out.discovered, null);
  assert.equal(out.state, s);
});

check("Minori's harvest doubles a craft when the roll lands", () => {
  let s = E.initialState(T0);
  const rid = s.knownRecipes[0];
  const recipe = E.RECIPES[rid];
  const raw = { ...s.rawInventory };
  recipe.ingredients.forEach((i) => { raw[i.itemId] = 9; });
  s = { ...s, rawInventory: raw };
  s = E.activateSkill(s, 'minori', T0);
  const out = E.craftRecipe(s, rid, T0, fixedRng(0.1));
  assert.equal(out.crafted, 2);
  const miss = E.craftRecipe(s, rid, T0, fixedRng(0.9));
  assert.equal(miss.crafted, 1);
});

check('three tiers: perfect pays 150%, acceptable 100%, wrong 0 and keeps the item', () => {
  const req = E.DB.customerRequests[0];
  const perfectId = req.perfectMatches[0];
  const acceptableId = E.DB.items.find((i) => !req.perfectMatches.includes(i.id) && req.acceptableTags.some((t) => i.tags.includes(t))).id;
  const wrongId = E.DB.items.find((i) => !req.perfectMatches.includes(i.id) && !req.acceptableTags.some((t) => i.tags.includes(t))).id;
  const base = { ...E.initialState(T0), inventory: { [perfectId]: 1, [acceptableId]: 1, [wrongId]: 1 } };

  const p = E.solveRequest(base, req.id, perfectId, T0);
  assert.equal(p.result.tier, 'perfect');
  assert.equal(p.result.reward, Math.round(req.baseRewardKoban * 1.5));
  assert.equal(p.result.story, req.storySnippet);
  assert.equal(p.state.inventory[perfectId], 0);

  const a = E.solveRequest(base, req.id, acceptableId, T0);
  assert.equal(a.result.tier, 'acceptable');
  assert.equal(a.result.reward, req.baseRewardKoban);

  const w = E.solveRequest(base, req.id, wrongId, T0);
  assert.equal(w.result.tier, 'wrong');
  assert.equal(w.result.reward, 0);
  assert.equal(w.state.inventory[wrongId], 1, 'the wrong item is handed back');
  assert.ok(!w.state.solvedRequests.includes(req.id), 'the request stays open');
});

check('a request cannot be solved twice', () => {
  const req = E.DB.customerRequests[1];
  const id = req.perfectMatches[0];
  const s = { ...E.initialState(T0), inventory: { [id]: 2 } };
  const once = E.solveRequest(s, req.id, id, T0).state;
  const twice = E.solveRequest(once, req.id, id, T0);
  assert.equal(twice.result, null);
});

check('reputation raises rank and chapter', () => {
  const s = E.applyRank({ ...E.initialState(T0), reputation: 130 });
  assert.equal(s.rank, 3);
  assert.equal(s.chapter, 3);
});

check('an expedition costs koban and stamina, and gear raises the odds', () => {
  let s = E.initialState(T0);
  const weapon = E.DB.items.find((i) => i.tags.includes('weapon'));
  s = { ...s, koban: 5000, inventory: { ...s.inventory, [weapon.id]: 1 } };
  const bare = E.expeditionWinRate(s, 'whispering_woods', [], T0);
  const armed = E.expeditionWinRate(s, 'whispering_woods', [weapon.id], T0);
  assert.ok(armed > bare);
  const started = E.startExpedition(s, 'whispering_woods', [weapon.id], T0);
  assert.equal(started.koban, 5000 - 120);
  assert.equal(started.stamina, s.stamina - 1);
  assert.equal(started.inventory[weapon.id], 0);
  assert.equal(started.expeditions[0].status, 'running');
});

check("Kaneru's audit cuts the next contract by 30% once", () => {
  let s = { ...E.initialState(T0), koban: 5000 };
  s = E.activateSkill(s, 'kaneru', T0);
  assert.equal(E.mercenaryCost(s, 'ember_cavern'), 210);
  s = { ...s, chapter: 2 };
  s = E.startExpedition(s, 'ember_cavern', [], T0);
  assert.equal(s.koban, 5000 - 210);
  assert.equal(E.mercenaryCost(s, 'ember_cavern'), 300, 'discount is spent');
});

check('an expedition settles when its clock runs out, and resolves with loot', () => {
  let s = { ...E.initialState(T0), koban: 5000 };
  s = E.startExpedition(s, 'whispering_woods', [], T0);
  const mid = E.reconcileOfflineAndElapsedState(s, T0 + 100_000);
  assert.equal(mid.expeditions[0].status, 'running');
  const done = E.reconcileOfflineAndElapsedState(s, T0 + 180_000);
  assert.equal(done.expeditions[0].status, 'ready_to_claim');
  const won = E.resolveExpedition(done, done.expeditions[0].id, T0 + 180_000, fixedRng(0.1));
  assert.equal(won.outcome.won, true);
  assert.ok(won.outcome.loot.length >= 2);
  assert.ok(won.outcome.battleLog.length >= 3);
  const lost = E.resolveExpedition(done, done.expeditions[0].id, T0 + 180_000, fixedRng(0.99));
  assert.equal(lost.outcome.won, false);
  assert.equal(lost.outcome.loot.length, 0);
});

check('a locked dungeon cannot be entered', () => {
  const s = { ...E.initialState(T0), koban: 99999 };
  assert.equal(E.startExpedition(s, 'abyssal_rift', [], T0), s);
});

check('debt is paid in stages', () => {
  let s = { ...E.initialState(T0), koban: 300000 };
  s = E.payDebtStage(s, T0);
  assert.equal(s.debtPaid, 250000);
  assert.equal(s.koban, 50000);
  assert.equal(E.payDebtStage(s, T0), s, 'cannot afford stage two');
});

check('kakeibo: logging today gives stamina once a day; discipline gives a chest once a month', () => {
  const s = { ...E.initialState(T0), stamina: 1 };
  const snap = { transactionsToday: 3, budgetsTotal: 2, budgetsUnder: 2 };
  const first = E.claimKakeiboRewards(s, snap, T0);
  assert.equal(first.rewards.length, 2);
  assert.equal(first.state.stamina, 3);
  assert.equal(first.state.koban, s.koban + 400);
  const again = E.claimKakeiboRewards(first.state, snap, T0 + 1000);
  assert.equal(again.rewards.length, 0, 'nothing twice in a day');
  const tomorrow = E.claimKakeiboRewards(first.state, snap, T0 + 86_400_000);
  assert.equal(tomorrow.rewards.length, 1, 'stamina again tomorrow, chest not until next month');
});

check('kakeibo: over budget earns no chest', () => {
  const s = E.initialState(T0);
  const out = E.claimKakeiboRewards(s, { transactionsToday: 0, budgetsTotal: 2, budgetsUnder: 1 }, T0);
  assert.equal(out.rewards.length, 0);
});

check('a save round-trips, and a foreign save is discarded', () => {
  const s = E.initialState(T0);
  const back = E.deserialize(E.serialize(s), T0);
  assert.deepEqual(back, s);
  assert.equal(E.deserialize('{"version":99}', T0).version, E.SAVE_VERSION);
  assert.equal(E.deserialize('not json', T0).koban, s.koban);
});

console.log(`\nkoban engine: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
