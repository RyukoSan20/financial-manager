/**
 * The rules of Koban & Co., as pure functions.
 *
 * Nothing in this file touches React, the DOM, localStorage or the
 * clock. Every function takes a state and a `nowMs` and returns a new
 * state, which is what lets the whole economy be tested from plain
 * node and lets the idle engine be immune to tab throttling: time is
 * an INPUT, read once from Date.now() when the tab wakes, never
 * accumulated from setInterval ticks that a background tab slows to
 * one a minute.
 */

import db from '../data/database.js';

export const SAVE_KEY = 'fm_koban_co_save_v1';
export const SAVE_VERSION = 1;

const SHELF_IDS = ['glass_case', 'wood_rack', 'vip_umbrella_table'];
export const SHELVES = [
  { id: 'glass_case', name: 'Etalase Kaca', xPercent: 36, yPercent: 72, capacity: 12 },
  { id: 'wood_rack', name: 'Rak Kayu', xPercent: 60, yPercent: 44, capacity: 20 },
  { id: 'vip_umbrella_table', name: 'Meja Payung VIP', xPercent: 82, yPercent: 68, capacity: 6 },
];

export const BASE_SALE_INTERVAL_SEC = 45;
export const BELL_SALE_INTERVAL_SEC = 15;
export const FEVER_MULTIPLIER = 2.0;
export const FEVER_DURATION_SEC = 90;
export const GAUGE_PER_SALE = 5;

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const ITEMS = byId(db.items);
export const RAW = byId(db.rawMaterials);
export const RECIPES = byId(db.recipes);
export const RECIPES_BY_OUTPUT = Object.fromEntries(db.recipes.map((r) => [r.outputItemId, r]));
export const CHARACTERS = byId(db.characters);
export const DUNGEONS = byId(db.dungeons);
export const REQUESTS = byId(db.customerRequests);
export const MONSTERS = byId(db.monsters);
export const DB = db;

/* ---------------------------------------------------------------------------
   The starting state
   --------------------------------------------------------------------------- */

export function initialState(nowMs = Date.now()) {
  // A new shopkeeper starts with a little stock so the first screen
  // is a shop, not an empty room with a tutorial.
  const starterRaw = {};
  db.rawMaterials.filter((r) => r.tier <= 2).slice(0, 8).forEach((r) => { starterRaw[r.id] = 6; });
  const starterRecipes = db.recipes.filter((r) => r.tier === 1).slice(0, 6).map((r) => r.id);
  const inventory = {};
  starterRecipes.slice(0, 3).forEach((rid) => { inventory[RECIPES[rid].outputItemId] = 4; });

  return {
    version: SAVE_VERSION,
    createdAt: nowMs,
    lastTickAt: nowMs,
    koban: 600,
    gems: 2,
    reputation: 0,
    rank: 1,
    chapter: 1,
    kingVisitGauge: 0,
    feverModeUntil: 0,
    debtPaid: 0,
    vault: { balance: 0, lastInterestAt: nowMs, totalInterestEarned: 0 },
    rawInventory: starterRaw,
    inventory,
    knownRecipes: starterRecipes,
    shelves: SHELF_IDS.map((id) => ({ id, itemId: null, qty: 0, unitPrice: 0 })),
    skills: Object.fromEntries(db.characters.map((c) => [c.id, { cooldownUntilMs: 0, activeUntilMs: 0 }])),
    activeBuffs: { konekoBellUntil: 0, minoriHarvestUntil: 0, zenimaruChargeUntil: 0, kaneruDiscountPending: false },
    expeditions: [],
    stamina: 3,
    staminaMax: 5,
    solvedRequests: [],
    requestLog: [],
    unlockedStory: [1],
    kakeibo: { lastClaimDay: null, lastDisciplineMonth: null, lifetimeTickets: 0 },
    stats: { totalEarned: 0, itemsSold: 0, crafted: 0, expeditionsWon: 0, expeditionsLost: 0 },
    pendingOfflineReport: null,
    log: [],
  };
}

const pushLog = (state, text, nowMs) => ({
  ...state,
  log: [{ at: nowMs, text }, ...state.log].slice(0, 60),
});

/* ---------------------------------------------------------------------------
   The idle engine
   --------------------------------------------------------------------------- */

/**
 * Settle everything that happened between `state.lastTickAt` and now.
 *
 * Sales are computed per shelf from elapsed seconds, so an hour away
 * is one call with elapsedSec=3600, not 3600 ticks. The gauge, fever,
 * vault interest and expeditions all settle in the same pass.
 */
export function reconcileOfflineAndElapsedState(state, nowMs = Date.now()) {
  const elapsedSec = Math.max(0, Math.floor((nowMs - state.lastTickAt) / 1000));
  if (elapsedSec <= 0) return state;

  let earnedKoban = 0;
  let itemsSoldCount = 0;
  // A buff counts for the window if it was alive at the START of the
  // window: a bell rung at T and reconciled at exactly T+30s should
  // still have sold at the bell's pace, not the ordinary one.
  const bellActive = state.activeBuffs.konekoBellUntil > state.lastTickAt;
  const feverActive = state.feverModeUntil > state.lastTickAt;

  const shelves = state.shelves.map((slot) => {
    if (!slot.itemId || slot.qty <= 0) return slot;
    const interval = bellActive ? BELL_SALE_INTERVAL_SEC : BASE_SALE_INTERVAL_SEC;
    const possible = Math.min(slot.qty, Math.floor(elapsedSec / interval));
    if (possible <= 0) return slot;
    const price = Math.round(slot.unitPrice * (feverActive ? FEVER_MULTIPLIER : 1));
    earnedKoban += price * possible;
    itemsSoldCount += possible;
    return { ...slot, qty: slot.qty - possible };
  });

  // The gauge fills from sales; at 100 it tips into fever on its own.
  let gauge = Math.min(100, state.kingVisitGauge + itemsSoldCount * GAUGE_PER_SALE);
  let feverModeUntil = state.feverModeUntil;
  if (gauge >= 100 && feverModeUntil <= nowMs) {
    feverModeUntil = nowMs + FEVER_DURATION_SEC * 1000;
    gauge = 0;
  }

  // Vault interest, compounded per hour of real time.
  const vaultHours = Math.floor((nowMs - state.vault.lastInterestAt) / 3600000);
  let vault = state.vault;
  if (vaultHours > 0 && state.vault.balance > 0) {
    const grown = Math.round(state.vault.balance * Math.pow(1 + db.meta.vaultInterestPerHour, vaultHours));
    vault = {
      ...state.vault,
      balance: grown,
      totalInterestEarned: state.vault.totalInterestEarned + (grown - state.vault.balance),
      lastInterestAt: state.vault.lastInterestAt + vaultHours * 3600000,
    };
  }

  const expeditions = state.expeditions.map((exp) =>
    exp.status === 'running' && nowMs >= exp.endTimeMs ? { ...exp, status: 'ready_to_claim' } : exp
  );

  return {
    ...state,
    koban: state.koban + earnedKoban,
    kingVisitGauge: gauge,
    feverModeUntil,
    shelves,
    vault,
    expeditions,
    stats: { ...state.stats, totalEarned: state.stats.totalEarned + earnedKoban, itemsSold: state.stats.itemsSold + itemsSoldCount },
    pendingOfflineReport:
      elapsedSec >= 60 && earnedKoban > 0
        ? { elapsedSec, earnedKoban, itemsSoldCount }
        : state.pendingOfflineReport,
    lastTickAt: nowMs,
  };
}

/* ---------------------------------------------------------------------------
   Shelves
   --------------------------------------------------------------------------- */

export function restockShelf(state, shelfId, itemId, qty, nowMs = Date.now()) {
  const have = state.inventory[itemId] || 0;
  const shelf = SHELVES.find((s) => s.id === shelfId);
  if (!shelf || have <= 0) return state;
  const slot = state.shelves.find((s) => s.id === shelfId);
  if (slot.itemId && slot.itemId !== itemId && slot.qty > 0) return state;
  const room = shelf.capacity - (slot.itemId === itemId ? slot.qty : 0);
  const moved = Math.max(0, Math.min(have, qty, room));
  if (moved <= 0) return state;
  const item = ITEMS[itemId];
  const vipBonus = shelfId === 'vip_umbrella_table' ? 1.25 : 1;
  return pushLog({
    ...state,
    inventory: { ...state.inventory, [itemId]: have - moved },
    shelves: state.shelves.map((s) =>
      s.id === shelfId
        ? { id: s.id, itemId, qty: (s.itemId === itemId ? s.qty : 0) + moved, unitPrice: Math.round(item.sellPrice * vipBonus) }
        : s
    ),
  }, `Koneko menata ${moved}× ${item.name} di ${shelf.name}.`, nowMs);
}

/* ---------------------------------------------------------------------------
   Crafting
   --------------------------------------------------------------------------- */

const hasIngredients = (state, recipe) =>
  recipe.ingredients.every((ing) => (state.rawInventory[ing.itemId] || 0) >= ing.qty);

const spendIngredients = (state, recipe) => {
  const raw = { ...state.rawInventory };
  recipe.ingredients.forEach((ing) => { raw[ing.itemId] -= ing.qty; });
  return raw;
};

/**
 * Try a combination of raw materials. If it matches a recipe the
 * recipe becomes known (and is crafted once); if not, nothing is
 * spent - a failed experiment costs time, not ore.
 */
export function discoverRecipe(state, rawIds, nowMs = Date.now(), rng = Math.random) {
  const wanted = [...rawIds].sort().join('|');
  const match = db.recipes.find(
    (r) => r.unlockChapter <= state.chapter && [...r.ingredients.map((i) => i.itemId)].sort().join('|') === wanted
  );
  if (!match) return { state, discovered: null };
  if (state.knownRecipes.includes(match.id)) return craftRecipe(state, match.id, nowMs, rng);
  const next = pushLog({ ...state, knownRecipes: [...state.knownRecipes, match.id] },
    `Minori menemukan resep baru: ${ITEMS[match.outputItemId].name}!`, nowMs);
  return { ...craftRecipe(next, match.id, nowMs, rng), discovered: match.id };
}

export function craftRecipe(state, recipeId, nowMs = Date.now(), rng = Math.random) {
  const recipe = RECIPES[recipeId];
  if (!recipe || !state.knownRecipes.includes(recipeId) || !hasIngredients(state, recipe)) {
    return { state, crafted: 0 };
  }
  const harvest = state.activeBuffs.minoriHarvestUntil > nowMs;
  const doubled = harvest && rng() < CHARACTERS.minori.skill.value;
  const made = doubled ? 2 : 1;
  const item = ITEMS[recipe.outputItemId];
  const next = pushLog({
    ...state,
    rawInventory: spendIngredients(state, recipe),
    inventory: { ...state.inventory, [item.id]: (state.inventory[item.id] || 0) + made },
    stats: { ...state.stats, crafted: state.stats.crafted + made },
  }, doubled ? `Bountiful Harvest! ${item.name} jadi ${made}.` : `Minori meracik ${item.name}.`, nowMs);
  return { state: next, crafted: made, doubled };
}

/* ---------------------------------------------------------------------------
   Skills
   --------------------------------------------------------------------------- */

export function activateSkill(state, charId, nowMs = Date.now()) {
  const c = CHARACTERS[charId];
  const slot = state.skills[charId];
  if (!c || !slot || slot.cooldownUntilMs > nowMs) return state;
  const s = c.skill;
  const skills = { ...state.skills, [charId]: { cooldownUntilMs: nowMs + s.cooldownSec * 1000, activeUntilMs: nowMs + s.durationSec * 1000 } };
  let next = { ...state, skills };
  const buffs = { ...state.activeBuffs };
  switch (s.effectType) {
    case 'CUSTOMER_SPEED_MULTIPLIER':
      buffs.konekoBellUntil = nowMs + s.durationSec * 1000;
      break;
    case 'DOUBLE_CRAFT_CHANCE':
      buffs.minoriHarvestUntil = nowMs + s.durationSec * 1000;
      break;
    case 'NEXT_EXPEDITION_DISCOUNT':
      buffs.kaneruDiscountPending = true;
      break;
    case 'DUNGEON_WIN_BOOST':
      buffs.zenimaruChargeUntil = nowMs + s.durationSec * 1000;
      break;
    case 'INSTANT_TIME_WARP_SEC': {
      // Pull every clock forward by an hour: shelves sell as if the
      // hour passed, expeditions finish sooner.
      const warp = s.value * 1000;
      next = { ...next, lastTickAt: next.lastTickAt - warp, expeditions: next.expeditions.map((e) => ({ ...e, endTimeMs: e.endTimeMs - warp })) };
      next = reconcileOfflineAndElapsedState(next, nowMs);
      next = { ...next, pendingOfflineReport: null };
      break;
    }
    case 'VAULT_INTEREST_PAYOUT': {
      const payout = Math.round(next.vault.balance * s.value);
      next = { ...next, koban: next.koban + payout, vault: { ...next.vault, totalInterestEarned: next.vault.totalInterestEarned + payout } };
      break;
    }
    default:
      break;
  }
  return pushLog({ ...next, activeBuffs: buffs }, `${c.name.split(' ')[0]} memakai ${s.name}.`, nowMs);
}

/* ---------------------------------------------------------------------------
   Requests: the three-tier evaluation
   --------------------------------------------------------------------------- */

export function evaluateRequest(request, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { tier: 'wrong', multiplier: 0 };
  if (request.perfectMatches.includes(itemId)) return { tier: 'perfect', multiplier: 1.5 };
  if (request.acceptableTags.some((t) => item.tags.includes(t))) return { tier: 'acceptable', multiplier: 1.0 };
  return { tier: 'wrong', multiplier: 0 };
}

export function solveRequest(state, requestId, itemId, nowMs = Date.now()) {
  const req = REQUESTS[requestId];
  if (!req || state.solvedRequests.includes(requestId)) return { state, result: null };
  const have = state.inventory[itemId] || 0;
  if (have <= 0) return { state, result: null };
  const verdict = evaluateRequest(req, itemId);
  const reward = Math.round(req.baseRewardKoban * verdict.multiplier);
  // A wrong item is handed back: no Koban, but the item is not lost.
  const inventory = verdict.tier === 'wrong' ? state.inventory : { ...state.inventory, [itemId]: have - 1 };
  const reputation = state.reputation + (verdict.tier === 'perfect' ? req.reputationPoints : verdict.tier === 'acceptable' ? Math.floor(req.reputationPoints / 2) : 0);
  const solved = verdict.tier === 'wrong' ? state.solvedRequests : [...state.solvedRequests, requestId];
  const unlockedStory = verdict.tier === 'perfect' && !state.unlockedStory.includes(req.chapter + 1)
    ? [...state.unlockedStory, req.chapter + 1].sort()
    : state.unlockedStory;
  const next = pushLog({
    ...state, inventory, reputation, solvedRequests: solved, unlockedStory,
    koban: state.koban + reward,
    requestLog: [{ requestId, itemId, tier: verdict.tier, reward, at: nowMs }, ...state.requestLog].slice(0, 40),
  }, verdict.tier === 'wrong'
    ? `${req.customerName} mengembalikan ${ITEMS[itemId].name}. Bukan itu.`
    : `${req.customerName} puas (${verdict.tier}) — +${reward} Koban.`, nowMs);
  return { state: applyRank(next), result: { ...verdict, reward, story: verdict.tier === 'perfect' ? req.storySnippet : null } };
}

/* ---------------------------------------------------------------------------
   Rank & chapter
   --------------------------------------------------------------------------- */

export const RANK_THRESHOLDS = [0, 40, 120, 260, 480];

export function applyRank(state) {
  let rank = 1;
  RANK_THRESHOLDS.forEach((t, i) => { if (state.reputation >= t) rank = i + 1; });
  const chapter = Math.max(state.chapter, Math.min(5, rank));
  return rank === state.rank && chapter === state.chapter ? state : { ...state, rank, chapter };
}

/* ---------------------------------------------------------------------------
   Dungeons
   --------------------------------------------------------------------------- */

export function expeditionWinRate(state, dungeonId, gearItemIds = [], nowMs = Date.now()) {
  const d = DUNGEONS[dungeonId];
  if (!d) return 0;
  let rate = d.baseWinRate;
  gearItemIds.forEach((id) => {
    const it = ITEMS[id];
    if (!it) return;
    if (it.tags.includes('weapon')) rate += 0.08 + 0.02 * it.tier;
    if (it.tags.includes('armor')) rate += 0.06 + 0.02 * it.tier;
    if (it.tags.includes('healing') || it.tags.includes('stamina')) rate += 0.05;
  });
  if (state.activeBuffs.zenimaruChargeUntil > nowMs) rate += CHARACTERS.zenimaru.skill.value;
  return Math.min(1, Math.round(rate * 100) / 100);
}

export function mercenaryCost(state, dungeonId) {
  const d = DUNGEONS[dungeonId];
  const discount = state.activeBuffs.kaneruDiscountPending ? CHARACTERS.kaneru.skill.value : 0;
  return Math.round(d.mercenaryCost * (1 - discount));
}

export function startExpedition(state, dungeonId, gearItemIds = [], nowMs = Date.now()) {
  const d = DUNGEONS[dungeonId];
  if (!d || d.chapter > state.chapter || state.stamina <= 0) return state;
  const cost = mercenaryCost(state, dungeonId);
  if (state.koban < cost) return state;
  if (state.expeditions.some((e) => e.status === 'running')) return state;
  const inventory = { ...state.inventory };
  const gear = gearItemIds.filter((id) => (inventory[id] || 0) > 0);
  gear.forEach((id) => { inventory[id] -= 1; });
  const winRate = expeditionWinRate(state, dungeonId, gear, nowMs);
  return pushLog({
    ...state,
    koban: state.koban - cost,
    stamina: state.stamina - 1,
    inventory,
    activeBuffs: { ...state.activeBuffs, kaneruDiscountPending: false },
    expeditions: [{ id: `exp_${nowMs}`, dungeonId, startTimeMs: nowMs, endTimeMs: nowMs + d.durationSec * 1000, winRate, gear, cost, status: 'running' }, ...state.expeditions].slice(0, 10),
  }, `Zenimaru berangkat ke ${d.name} (peluang ${Math.round(winRate * 100)}%).`, nowMs);
}

/** A seeded battle log and the outcome. Deterministic given `rng`. */
export function resolveExpedition(state, expeditionId, nowMs = Date.now(), rng = Math.random) {
  const exp = state.expeditions.find((e) => e.id === expeditionId);
  if (!exp || exp.status !== 'ready_to_claim') return { state, outcome: null };
  const d = DUNGEONS[exp.dungeonId];
  const won = rng() < exp.winRate;
  const rounds = 3 + Math.floor(rng() * 3);
  const battleLog = [];
  for (let i = 0; i < rounds; i += 1) {
    const mon = MONSTERS[d.monsters[i % Math.max(1, d.monsters.length)]];
    battleLog.push(won || i < rounds - 1
      ? `Ronde ${i + 1}: Zenimaru menebas ${mon ? mon.name : 'monster'}.`
      : `Ronde ${i + 1}: ${mon ? mon.name : 'monster'} memukul mundur pasukan.`);
  }
  const rawInventory = { ...state.rawInventory };
  const loot = [];
  if (won) {
    const count = 2 + Math.floor(rng() * 2) + (state.activeBuffs.zenimaruChargeUntil > exp.startTimeMs ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const id = d.lootTable[Math.floor(rng() * d.lootTable.length)];
      rawInventory[id] = (rawInventory[id] || 0) + 1;
      loot.push(id);
    }
  }
  const next = pushLog({
    ...state,
    rawInventory,
    expeditions: state.expeditions.map((e) => (e.id === expeditionId ? { ...e, status: won ? 'won' : 'lost', loot, battleLog } : e)),
    stats: { ...state.stats, expeditionsWon: state.stats.expeditionsWon + (won ? 1 : 0), expeditionsLost: state.stats.expeditionsLost + (won ? 0 : 1) },
  }, won ? `Ekspedisi ${d.name} menang! ${loot.length} bahan dibawa pulang.` : `Ekspedisi ${d.name} gagal. Kaneru mencatat kerugian ${exp.cost} Koban.`, nowMs);
  return { state: next, outcome: { won, loot, battleLog } };
}

/* ---------------------------------------------------------------------------
   Ledger: debt and vault
   --------------------------------------------------------------------------- */

export function payDebtStage(state, nowMs = Date.now()) {
  const stages = db.meta.debtStages;
  let acc = 0; let idx = -1;
  for (let i = 0; i < stages.length; i += 1) { acc += stages[i]; if (state.debtPaid < acc) { idx = i; break; } }
  if (idx < 0) return state;
  const due = acc - state.debtPaid;
  if (state.koban < due) return state;
  return pushLog({ ...state, koban: state.koban - due, debtPaid: state.debtPaid + due, reputation: state.reputation + 20 },
    `Kaneru melunasi tahap ${idx + 1} utang Kerajaan: ${due} Koban.`, nowMs);
}

export function depositVault(state, amount, nowMs = Date.now()) {
  const amt = Math.floor(Math.min(amount, state.koban));
  if (amt <= 0) return state;
  return { ...state, koban: state.koban - amt, vault: { ...state.vault, balance: state.vault.balance + amt, lastInterestAt: state.vault.balance === 0 ? nowMs : state.vault.lastInterestAt } };
}

export function withdrawVault(state, amount) {
  const amt = Math.floor(Math.min(amount, state.vault.balance));
  if (amt <= 0) return state;
  return { ...state, koban: state.koban + amt, vault: { ...state.vault, balance: state.vault.balance - amt } };
}

/* ---------------------------------------------------------------------------
   The Kakeibo bridge
   --------------------------------------------------------------------------- */

/**
 * Turn the reader's real finances into rewards.
 *
 * `snapshot` is what the app knows today: how many transactions were
 * logged today, how many budgets are under their limit, and savings
 * progress. Tickets for logging, a chest for discipline - each
 * claimable once per day / month, so the reward is for the habit,
 * not for reloading the page.
 */
export function claimKakeiboRewards(state, snapshot, nowMs = Date.now()) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const rewards = [];
  let next = state;
  if (snapshot.transactionsToday > 0 && state.kakeibo.lastClaimDay !== day) {
    const tickets = Math.min(2, snapshot.transactionsToday >= 3 ? 2 : 1);
    next = { ...next, stamina: Math.min(next.staminaMax, next.stamina + tickets), kakeibo: { ...next.kakeibo, lastClaimDay: day, lifetimeTickets: next.kakeibo.lifetimeTickets + tickets } };
    rewards.push({ kind: 'stamina', amount: tickets, by: 'zenimaru' });
  }
  if (snapshot.budgetsTotal > 0 && snapshot.budgetsUnder === snapshot.budgetsTotal && state.kakeibo.lastDisciplineMonth !== month) {
    next = { ...next, koban: next.koban + 400, gems: next.gems + 3, kakeibo: { ...next.kakeibo, lastDisciplineMonth: month } };
    rewards.push({ kind: 'chest', koban: 400, gems: 3, by: 'mone' });
  }
  if (rewards.length === 0) return { state, rewards };
  return { state: pushLog(next, 'Hadiah Kakeibo diklaim dari catatan keuangan asli.', nowMs), rewards };
}

/**
 * A daily habit quest from the Health Coach, paid into the shop.
 *
 * Each quest pays once per day: the key is `${day}:${questId}`, so
 * ticking, unticking and ticking again does not mint koban.
 */
export function grantDailyQuest(state, questId, reward, nowMs = Date.now()) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const key = `${day}:${questId}`;
  const claimed = (state.kakeibo && state.kakeibo.questsClaimed) || [];
  if (claimed.includes(key)) return { state, granted: false };
  const koban = Math.max(0, Math.floor((reward && reward.koban) || 0));
  const gems = Math.max(0, Math.floor((reward && reward.gems) || 0));
  // Keep only the last two weeks of keys, so the save does not grow.
  const recent = [...claimed, key].filter((k) => k.slice(0, 10) >= new Date(nowMs - 14 * 86400000).toISOString().slice(0, 10));
  const next = {
    ...state,
    koban: state.koban + koban,
    gems: state.gems + gems,
    kakeibo: { ...state.kakeibo, questsClaimed: recent },
  };
  return { state: pushLog(next, `Misi harian selesai: +${koban} Koban${gems ? ` +${gems} Gem` : ''}.`, nowMs), granted: true };
}

/* ---------------------------------------------------------------------------
   Save / load
   --------------------------------------------------------------------------- */

export function serialize(state) { return JSON.stringify(state); }

export function deserialize(text, nowMs = Date.now()) {
  if (!text) return initialState(nowMs);
  try {
    const parsed = JSON.parse(text);
    if (parsed.version !== SAVE_VERSION) return initialState(nowMs);
    // Fill any field a newer build added.
    return { ...initialState(nowMs), ...parsed, lastTickAt: parsed.lastTickAt || nowMs };
  } catch {
    return initialState(nowMs);
  }
}
