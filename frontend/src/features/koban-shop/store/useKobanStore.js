/**
 * The store.
 *
 * A tiny external store over the pure engine: one state object, a
 * subscriber list, and localStorage behind it. React reads it with
 * useSyncExternalStore, so there is no dependency to add and no
 * provider to mount.
 *
 * The clock is read in exactly three places - on load, on every
 * visibility change / focus, and on a slow heartbeat while the tab is
 * in front. A background tab slows that heartbeat to a crawl, and it
 * does not matter: the next wake-up reconciles the whole gap in one
 * call from the stored timestamp.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { api } from '../../../services/api';
import * as E from './kobanEngine.js';

const listeners = new Set();
let state = null;

const load = () => {
  if (state) return state;
  let raw = null;
  try { raw = window.localStorage.getItem(E.SAVE_KEY); } catch { /* private mode */ }
  state = E.reconcileOfflineAndElapsedState(E.deserialize(raw), Date.now());
  return state;
};

const persist = () => {
  try { window.localStorage.setItem(E.SAVE_KEY, E.serialize(state)); } catch { /* quota / private */ }
};

const set = (next) => {
  if (next === state) return;
  state = next;
  persist();
  listeners.forEach((fn) => fn());
};

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => load();

/** Settle the clock. Called on wake-up and on the heartbeat. */
export const tick = () => set(E.reconcileOfflineAndElapsedState(getSnapshot(), Date.now()));

/* The actions. Each one reconciles first so a stale shelf is never
   acted on, then applies the rule. */
const act = (fn) => (...args) => {
  const now = Date.now();
  const settled = E.reconcileOfflineAndElapsedState(getSnapshot(), now);
  const out = fn(settled, ...args, now);
  // Engine functions return either a state or { state, ... }.
  const next = out && out.state ? out.state : out;
  set(next);
  return out && out.state ? out : null;
};

export const actions = {
  restockShelf: act((s, shelfId, itemId, qty, now) => E.restockShelf(s, shelfId, itemId, qty, now)),
  craftRecipe: act((s, recipeId, now) => E.craftRecipe(s, recipeId, now)),
  discoverRecipe: act((s, rawIds, now) => E.discoverRecipe(s, rawIds, now)),
  activateSkill: act((s, charId, now) => E.activateSkill(s, charId, now)),
  solveRequest: act((s, requestId, itemId, now) => E.solveRequest(s, requestId, itemId, now)),
  startExpedition: act((s, dungeonId, gear, now) => E.startExpedition(s, dungeonId, gear, now)),
  resolveExpedition: act((s, expId, now) => E.resolveExpedition(s, expId, now)),
  payDebtStage: act((s, now) => E.payDebtStage(s, now)),
  depositVault: act((s, amount, now) => E.depositVault(s, amount, now)),
  withdrawVault: act((s, amount) => E.withdrawVault(s, amount)),
  claimKakeibo: act((s, snapshot, now) => E.claimKakeiboRewards(s, snapshot, now)),
  sellToCustomer: act((s, shelfId, now) => E.sellToCustomer(s, shelfId, now)),
  buyBadge: act((s, badgeId, now) => E.buyBadge(s, badgeId, now)),
  purchaseRecipe: act((s, facility, now) => E.purchaseRecipe(s, facility, now)),
  levelUpSoldier: act((s, classId, now) => E.levelUpSoldier(s, classId, now)),
  beginBattle: act((s, dungeonId, now) => E.beginBattle(s, dungeonId, now)),
  finishBattle: act((s, dungeonId, won, now) => E.finishBattle(s, dungeonId, won, now)),
  clearShelf: act((s, shelfId) => E.clearShelf(s, shelfId)),
  grantDailyQuest: act((s, questId, reward, now) => E.grantDailyQuest(s, questId, reward, now)),
  dismissOfflineReport: act((s) => ({ ...s, pendingOfflineReport: null })),
  triggerFever: act((s, now) => (s.kingVisitGauge >= 100 ? { ...s, kingVisitGauge: 0, feverModeUntil: now + E.FEVER_DURATION_SEC * 1000 } : s)),
  resetSave: () => set(E.initialState(Date.now())),
};

export function useKobanStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    tick();
    const wake = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    const beat = window.setInterval(tick, 5000);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.clearInterval(beat);
    };
  }, []);

  return { state: snapshot, actions };
}

/* ---------------------------------------------------------------------------
   The Kakeibo snapshot: what the real app knows today
   --------------------------------------------------------------------------- */

const emptySnapshot = { transactionsToday: 0, budgetsTotal: 0, budgetsUnder: 0, goalsProgress: 0, loaded: false, error: null };

export function useKakeiboSnapshot() {
  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [txs, budgets, goals] = await Promise.all([
      api.transactions.list({ start_date: today, end_date: today, limit: 50 }).catch(() => []),
      api.budgets.list().catch(() => []),
      api.goals.list().catch(() => []),
    ]);
    const txList = Array.isArray(txs) ? txs : txs?.items || txs?.data || [];
    const budgetList = Array.isArray(budgets) ? budgets : budgets?.items || [];
    const progress = await Promise.all(
      budgetList.slice(0, 12).map((b) => api.budgets.progress(b.id).catch(() => null))
    );
    const under = progress.filter((p) => p && p.status !== 'over').length;
    const goalList = Array.isArray(goals) ? goals : goals?.items || [];
    const goalsProgress = goalList.length
      ? Math.round(goalList.reduce((a, g) => a + (Number(g.progress_percent) || 0), 0) / goalList.length)
      : 0;
    return { transactionsToday: txList.length, budgetsTotal: progress.filter(Boolean).length, budgetsUnder: under, goalsProgress, loaded: true, error: null };
  }, []);
  return useMemo(() => ({ empty: emptySnapshot, load }), [load]);
}

export default useKobanStore;
