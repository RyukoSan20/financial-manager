/**
 * The Health Coach score, worked out on the client for the what-if
 * simulator - with the SAME rules the server uses
 * (backend/app/modules/ai_advisor/health_coach/financial_ratios.py).
 *
 * The server sends the status of every ratio except debt-to-asset.
 * That one is recovered from the server's own score, so the simulator
 * always starts at exactly the score the reader was shown, and only
 * the two sliders move it.
 */

export const STATUS_POINTS = Object.freeze({ excellent: 100, good: 75, warning: 50, danger: 25 });
const TOTAL_WEIGHT = 1 + 1.5 + 1.2 + 1 + 1;

export function savingsStatus(percent) {
  if (percent >= 30) return 'excellent';
  if (percent >= 20) return 'good';
  if (percent >= 10) return 'warning';
  return 'danger';
}

/** Liquidity and the emergency fund are the same months of cash. */
export function monthsStatus(months) {
  if (months >= 6) return 'excellent';
  if (months >= 3) return 'good';
  if (months >= 1) return 'warning';
  return 'danger';
}

export function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'E';
}

const pts = (status) => STATUS_POINTS[status] ?? STATUS_POINTS.danger;

/**
 * The points the debt-to-asset ratio must have scored for the server
 * to arrive at `serverScore`. Clamped to the four possible values.
 */
export function inferDebtPoints({ serverScore, savings, months, dsr }) {
  const known = pts(monthsStatus(months)) + pts(savingsStatus(savings)) * 1.5 + pts(dsr) * 1.2 + pts(monthsStatus(months));
  // The server truncates, so the true weighted sum lies in
  // [score, score + 1) * TOTAL_WEIGHT. Take the middle of that range.
  const raw = (Number(serverScore || 0) + 0.5) * TOTAL_WEIGHT - known;
  const options = [25, 50, 75, 100];
  return options.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best), 25);
}

export function simulateScore({ savings, months, dsr, debtPoints }) {
  const sum =
    pts(monthsStatus(months)) +
    pts(savingsStatus(savings)) * 1.5 +
    pts(dsr) * 1.2 +
    pts(monthsStatus(months)) +
    debtPoints;
  const score = Math.min(100, Math.max(0, Math.floor(sum / TOTAL_WEIGHT)));
  return { score, grade: gradeFor(score) };
}

/** The mood a companion shows for a score. */
export function moodForScore(score) {
  if (score >= 70) return 'celebrate';
  if (score >= 60) return 'happy';
  return 'sweating';
}

/* --- the daily quests ------------------------------------------------- */

export const DAILY_QUESTS = Object.freeze([
  { id: 'log_tx', icon: 'receipt', reward: { koban: 50, health: 5 } },
  { id: 'no_spend', icon: 'coin', reward: { koban: 100 } },
  { id: 'budget_check', icon: 'calculator', reward: { koban: 50 } },
  { id: 'save_20k', icon: 'money_bag_rp', reward: { gems: 1 } },
]);

export const QUEST_STORE_KEY = 'fm.kakeibo.dailyQuests.v1';

export const dayKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const previousDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
};

export function emptyQuestState() {
  return { days: {}, streak: 0, lastStreakDay: null, xp: 0 };
}

/**
 * Tick or untick a quest. The streak counts days with at least one
 * finished quest, in a row; it grows on the first tick of a day.
 * XP is only ever added once per quest per day.
 */
export function toggleQuest(state, questId, today = dayKey()) {
  const s = state && state.days ? state : emptyQuestState();
  const done = new Set(s.days[today] || []);
  const awarded = new Set((s.awarded && s.awarded[today]) || []);
  let { streak, lastStreakDay, xp } = s;
  let firstTimeToday = false;

  if (done.has(questId)) {
    done.delete(questId);
  } else {
    done.add(questId);
    if (!awarded.has(questId)) {
      awarded.add(questId);
      xp += 25;
      firstTimeToday = true;
    }
    if (lastStreakDay !== today) {
      streak = lastStreakDay === previousDay(today) ? streak + 1 : 1;
      lastStreakDay = today;
    }
  }

  // Keep two weeks of history.
  const cutoff = (() => {
    const [y, m, d] = today.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d - 14));
  })();
  const days = Object.fromEntries(
    Object.entries({ ...s.days, [today]: [...done] }).filter(([k]) => k >= cutoff)
  );
  const awardedAll = Object.fromEntries(
    Object.entries({ ...(s.awarded || {}), [today]: [...awarded] }).filter(([k]) => k >= cutoff)
  );

  return { state: { days, awarded: awardedAll, streak, lastStreakDay, xp }, firstTimeToday };
}

/** The streak as it stands today: a missed day breaks it. */
export function liveStreak(state, today = dayKey()) {
  if (!state || !state.lastStreakDay) return 0;
  if (state.lastStreakDay === today || state.lastStreakDay === previousDay(today)) return state.streak;
  return 0;
}
