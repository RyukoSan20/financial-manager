/**
 * The Health Coach, made into something to come back to.
 *
 *   KakeiboStudioMascots  Minori and Kaneru, the real artwork, reacting
 *                         to the score (sweating below 60, cheering at
 *                         70 and up).
 *   DailyQuestCard        four micro-quests a day, stamped when done,
 *                         a streak, wellness XP, and koban paid into
 *                         the Koban & Co. shop save.
 *   WhatIfSimulator       two sliders - savings ratio and emergency
 *                         months - running the server's own scoring
 *                         rules, so the reader sees what moves the
 *                         score before doing it.
 *   AuditFixPills         one-tap fixes under the audit findings.
 *
 * All text is in Indonesian and English; the page follows the
 * reader's language.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import DraggableSparkleMascot from '../mascot/DraggableSparkleMascot';
import PixelArtBusinessIcon from '../ui/PixelArtBusinessIcon';
import { actions as kobanActions } from '../../features/koban-shop/store/useKobanStore';
import {
  DAILY_QUESTS,
  QUEST_STORE_KEY,
  dayKey,
  emptyQuestState,
  inferDebtPoints,
  liveStreak,
  moodForScore,
  simulateScore,
  toggleQuest,
} from './wellnessMath';

export const STATIONERY_CARD =
  'relative rounded-[24px] border-2 border-[#4A3540] bg-[#FFFDF9] shadow-[0_6px_0_#E2D6C3] dark:bg-[#2A2420] dark:border-[#CBB8A6]';

const COPY = {
  id: {
    studio_badge: 'Studio Kakeibo',
    studio_low: 'Skormu masih bisa naik! Yuk mulai dari satu misi kecil hari ini.',
    studio_mid: 'Sudah lumayan sehat. Sedikit lagi menuju Grade A!',
    studio_high: 'Keuanganmu sehat sekali! Kami bangga padamu.',
    quests_title: 'Misi Harian Kakeibo',
    quests_lead: 'Empat kebiasaan kecil. Centang yang sudah kamu lakukan hari ini.',
    streak: (n) => `${n} Hari Berturut-turut`,
    xp: 'XP Kesehatan',
    done_stamp: 'BERES!',
    q_log_tx: 'Catat minimal 1 transaksi hari ini',
    q_no_spend: 'Puasa belanja impulsif (No-Spend Challenge) hari ini',
    q_budget_check: 'Cek batas aman anggaran harian',
    q_save_20k: 'Sisihkan Rp 20.000 ke Dana Darurat / Tabungan',
    r_log_tx: '+50 Koban & +5 Skor Kesehatan',
    r_no_spend: '+100 Koban',
    r_budget_check: '+50 Koban',
    r_save_20k: '+1 Star-Fruit Gem',
    paid: 'Hadiah masuk ke Toko Koban',
    sim_title: 'Simulator Perbaikan Skor',
    sim_lead: 'Geser untuk melihat skor yang bisa kamu capai. Dihitung dengan aturan yang sama dengan server.',
    sim_savings: 'Target Rasio Tabungan',
    sim_emergency: 'Dana Darurat',
    months: 'bulan',
    sim_now: 'Sekarang',
    sim_then: 'Simulasi',
    sim_reset: 'Kembalikan',
    fix_budget: 'Terapkan Budget 50/30/20 Otomatis',
    fix_emergency: '+ Isi Dana Darurat',
    drag: '✋ Geser aku!',
  },
  en: {
    studio_badge: 'Kakeibo Studio',
    studio_low: 'Your score has room to grow! Start with one small quest today.',
    studio_mid: 'Pretty healthy already. A little more to Grade A!',
    studio_high: 'Your finances are in great shape! We are proud of you.',
    quests_title: 'Daily Kakeibo Quests',
    quests_lead: 'Four small habits. Tick the ones you did today.',
    streak: (n) => `${n}-day streak`,
    xp: 'Wellness XP',
    done_stamp: 'DONE!',
    q_log_tx: 'Record at least 1 transaction today',
    q_no_spend: 'No impulse buys today (No-Spend Challenge)',
    q_budget_check: 'Check your safe daily budget',
    q_save_20k: 'Put Rp 20,000 into your emergency fund / savings',
    r_log_tx: '+50 Koban & +5 Health Score',
    r_no_spend: '+100 Koban',
    r_budget_check: '+50 Koban',
    r_save_20k: '+1 Star-Fruit Gem',
    paid: 'Reward sent to the Koban Shop',
    sim_title: 'Score What-If Simulator',
    sim_lead: 'Slide to see the score you could reach. Same rules as the server.',
    sim_savings: 'Target savings ratio',
    sim_emergency: 'Emergency fund',
    months: 'months',
    sim_now: 'Now',
    sim_then: 'Simulated',
    sim_reset: 'Reset',
    fix_budget: 'Apply 50/30/20 budget automatically',
    fix_emergency: '+ Top up emergency fund',
    drag: '✨ Drag me!',
  },
};

export const wellnessCopy = (language) => COPY[language === 'en' ? 'en' : 'id'];

/** A washi-tape header strip. */
export function WashiTape({ tone = '#F7C8D8', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('pointer-events-none absolute -top-2.5 left-6 h-4 w-20 -rotate-2 rounded-sm opacity-90', className)}
      style={{
        background: `repeating-linear-gradient(45deg, ${tone}, ${tone} 6px, rgba(255,255,255,0.55) 6px, rgba(255,255,255,0.55) 9px)`,
      }}
    />
  );
}

/** A burst of confetti from an element, for things that are not the mascot. */
export function useConfettiBurst() {
  const [pieces, setPieces] = useState([]);
  const burst = useCallback((x, y, count = 20) => {
    const colours = ['#F7B2AD', '#F4E285', '#A8E6CF', '#8EC9E0', '#D8C8F0', '#E07A5F', '#FFFFFF'];
    const kinds = ['', 'is-star', 'is-glint'];
    const batch = Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      x,
      y,
      colour: colours[i % colours.length],
      kind: kinds[i % kinds.length],
      dx: (Math.random() - 0.5) * 220,
      drift: (Math.random() - 0.5) * 80,
      spin: (Math.random() - 0.5) * 720,
      delay: Math.random() * 180,
      duration: 1100 + Math.random() * 900,
    }));
    setPieces((current) => [...current, ...batch].slice(-48));
    window.setTimeout(() => setPieces((current) => current.filter((p) => !batch.includes(p))), 2300);
  }, []);

  const layer = (
    <span className="pointer-events-none fixed inset-0 z-[70]" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={clsx('koban-confetti', p.kind)}
          style={{
            left: p.x,
            top: p.y,
            color: p.colour,
            backgroundColor: p.kind ? 'currentColor' : p.colour,
            animationDuration: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
            '--dx': `${p.dx}px`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          }}
        />
      ))}
    </span>
  );
  return { burst, layer };
}

/* --- the two companions ------------------------------------------------ */

export function KakeiboStudioMascots({ score, language }) {
  const C = wellnessCopy(language);
  const mood = moodForScore(score);
  const line = score >= 70 ? C.studio_high : score >= 60 ? C.studio_mid : C.studio_low;
  const { burst, layer } = useConfettiBurst();

  // A score worth celebrating gets a shower when the page opens.
  useEffect(() => {
    if (score < 70) return undefined;
    const id = window.setTimeout(() => burst(window.innerWidth / 2, 120, 22), 500);
    return () => window.clearTimeout(id);
  }, [score, burst]);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="wellness-studio-mascots" data-mood={mood}>
      {layer}
      <div className="flex items-end justify-center gap-1">
        <DraggableSparkleMascot persona="minori" mood={mood} size={104} hint={C.drag} label="Minori" />
        <DraggableSparkleMascot
          persona="kaneru"
          mood={mood === 'sweating' ? 'thinking' : mood}
          size={92}
          hint={C.drag}
          label="Kaneru"
        />
      </div>
      <p
        className="relative max-w-[17rem] rounded-2xl border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-2 text-center text-[12px] font-semibold leading-snug text-[#2C221E] shadow-[0_3px_0_#4A3540]"
        data-testid="wellness-studio-line"
      >
        {line}
      </p>
    </div>
  );
}

/* --- Feature A: the daily quests -------------------------------------- */

const readQuests = () => {
  try {
    const raw = window.localStorage.getItem(QUEST_STORE_KEY);
    return raw ? JSON.parse(raw) : emptyQuestState();
  } catch {
    return emptyQuestState();
  }
};

export function DailyQuestCard({ language, onHealthBonus }) {
  const C = wellnessCopy(language);
  const [state, setState] = useState(readQuests);
  const [toast, setToast] = useState('');
  const today = dayKey();
  const done = new Set(state.days?.[today] || []);
  const streak = liveStreak(state, today);
  const { burst, layer } = useConfettiBurst();

  useEffect(() => {
    try {
      window.localStorage.setItem(QUEST_STORE_KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [state]);

  useEffect(() => {
    if (onHealthBonus) onHealthBonus(done.has('log_tx') ? 5 : 0);
  }, [done.has('log_tx'), onHealthBonus]); // eslint-disable-line react-hooks/exhaustive-deps

  const tick = (quest, event) => {
    const { state: next, firstTimeToday } = toggleQuest(state, quest.id, today);
    setState(next);
    const nowDone = (next.days[today] || []).includes(quest.id);
    if (nowDone) {
      const box = event.currentTarget.getBoundingClientRect();
      burst(box.left + box.width / 2, box.top + box.height / 2, 20);
    }
    if (firstTimeToday) {
      try {
        kobanActions.grantDailyQuest(quest.id, { koban: quest.reward.koban || 0, gems: quest.reward.gems || 0 });
        setToast(`${C[`r_${quest.id}`]} · ${C.paid}`);
        window.setTimeout(() => setToast(''), 2400);
      } catch {
        /* the shop save is optional */
      }
    }
  };

  const doneCount = done.size;

  return (
    <section className={clsx(STATIONERY_CARD, 'p-5')} data-testid="daily-quest-card">
      {layer}
      <WashiTape tone="#F7C8D8" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#2C221E] dark:text-[#FAF5EE]">
            <PixelArtBusinessIcon name="clipboard" size={30} />
            {C.quests_title}
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6B5E57] dark:text-[#CBB8A6]">{C.quests_lead}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border-2 border-[#4A3540] bg-[#FDE8E4] px-3 py-1 text-[12px] font-extrabold text-[#2C221E] shadow-[0_3px_0_#4A3540]"
            data-testid="daily-quest-streak"
          >
            🔥 {C.streak(streak)}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border-2 border-[#4A3540] bg-[#E3F2EA] px-3 py-1 text-[12px] font-extrabold text-[#2C221E] shadow-[0_3px_0_#4A3540]"
            data-testid="daily-quest-xp"
          >
            ✦ {state.xp || 0} {C.xp}
          </span>
        </div>
      </header>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full border-2 border-[#4A3540] bg-[#FFF6D6]">
        <div
          className="h-full bg-[#A8E6CF] transition-[width] duration-500"
          style={{ width: `${(doneCount / DAILY_QUESTS.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {DAILY_QUESTS.map((quest) => {
          const isDone = done.has(quest.id);
          return (
            <li key={quest.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                onClick={(event) => tick(quest, event)}
                data-testid={`daily-quest-${quest.id}`}
                className={clsx(
                  'relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border-2 border-[#4A3540] p-3 text-left transition-transform active:translate-y-0.5',
                  isDone ? 'bg-[#F3F8F4] shadow-[0_2px_0_#4A3540]' : 'bg-white shadow-[0_4px_0_#4A3540] hover:-translate-y-0.5 dark:bg-[#332B26]'
                )}
              >
                <span
                  className={clsx(
                    'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-[#4A3540] text-[13px] font-black',
                    isDone ? 'bg-[#2F4842] text-[#FFFDF9]' : 'bg-[#FFFDF9]'
                  )}
                  aria-hidden="true"
                >
                  {isDone ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={clsx(
                      'block text-[13px] font-bold leading-snug text-[#2C221E] dark:text-[#FAF5EE]',
                      isDone && 'line-through decoration-[#E07A5F] decoration-2 opacity-70'
                    )}
                  >
                    {C[`q_${quest.id}`]}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#B5654A]">
                    <PixelArtBusinessIcon name={quest.icon} size={16} badge={false} />
                    {C[`r_${quest.id}`]}
                  </span>
                </span>
                {isDone ? (
                  <span
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-[-14deg] rounded-md border-2 border-[#E07A5F] px-1.5 py-0.5 text-[11px] font-black tracking-wider text-[#E07A5F] opacity-85"
                    data-testid={`daily-quest-stamp-${quest.id}`}
                  >
                    {C.done_stamp}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {toast ? (
        <p
          role="status"
          className="parade-say mt-3 rounded-xl border-2 border-[#4A3540] bg-[#FFF6D6] px-3 py-1.5 text-center text-[12px] font-bold text-[#2C221E]"
          data-testid="daily-quest-toast"
        >
          {toast}
        </p>
      ) : null}
    </section>
  );
}

/* --- Feature B: the what-if simulator ---------------------------------- */

export function WhatIfSimulator({ language, serverScore, savingsRatio, emergencyFund, dsrRatio }) {
  const C = wellnessCopy(language);
  const startSavings = Math.max(0, Math.min(40, Math.round(Number(savingsRatio?.value) || 0)));
  const startMonths = Math.max(0, Math.min(12, Math.round(Number(emergencyFund?.value) || 0)));
  const dsr = dsrRatio?.status || 'excellent';

  const [savings, setSavings] = useState(startSavings);
  const [months, setMonths] = useState(startMonths);

  useEffect(() => {
    setSavings(startSavings);
    setMonths(startMonths);
  }, [startSavings, startMonths]);

  const debtPoints = useMemo(
    () =>
      inferDebtPoints({
        serverScore,
        savings: Number(savingsRatio?.value) || 0,
        months: Number(emergencyFund?.value) || 0,
        dsr,
      }),
    [serverScore, savingsRatio, emergencyFund, dsr]
  );

  const moved = savings !== startSavings || months !== startMonths;
  const sim = moved ? simulateScore({ savings, months, dsr, debtPoints }) : { score: serverScore, grade: null };
  const mood = moodForScore(sim.score);
  const delta = sim.score - serverScore;

  const slider = (id, label, value, max, unit, onChange, tint) => (
    <label className="block" htmlFor={id}>
      <span className="flex items-baseline justify-between text-[12.5px] font-bold text-[#2C221E] dark:text-[#FAF5EE]">
        {label}
        <span className="rounded-full border-2 border-[#4A3540] px-2 py-0.5 text-[12px] font-extrabold tabular-nums" style={{ background: tint }}>
          {value}
          {unit}
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="kakeibo-range mt-2 w-full"
        data-testid={id}
      />
      <span className="flex justify-between text-[10px] font-semibold text-[#8A7F72]">
        <span>0{unit}</span>
        <span>
          {max}
          {unit}
        </span>
      </span>
    </label>
  );

  return (
    <section className={clsx(STATIONERY_CARD, 'p-5')} data-testid="whatif-simulator">
      <WashiTape tone="#A8E6CF" />
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#2C221E] dark:text-[#FAF5EE]">
        <PixelArtBusinessIcon name="calculator" size={30} />
        {C.sim_title}
      </h2>
      <p className="mt-0.5 text-[12px] text-[#6B5E57] dark:text-[#CBB8A6]">{C.sim_lead}</p>

      <div className="mt-4 grid grid-cols-1 items-center gap-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          {slider('whatif-savings', C.sim_savings, savings, 40, '%', setSavings, '#FFF6D6')}
          {slider('whatif-emergency', C.sim_emergency, months, 12, ` ${C.months}`, setMonths, '#E3F2EA')}
          {moved ? (
            <button
              type="button"
              onClick={() => {
                setSavings(startSavings);
                setMonths(startMonths);
              }}
              className="text-[12px] font-bold text-[#B5654A] underline decoration-dotted underline-offset-2"
            >
              {C.sim_reset}
            </button>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2">
          <DraggableSparkleMascot persona="minori" mood={mood} size={96} hint={C.drag} label="Minori" />
          <div
            className="rounded-2xl border-2 border-[#4A3540] bg-[#FFFDF9] px-4 py-2 text-center shadow-[0_4px_0_#4A3540] dark:bg-[#332B26]"
            data-testid="whatif-result"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A7F72]">
              {C.sim_now} {serverScore} → {C.sim_then}
            </p>
            <p className="text-3xl font-black tabular-nums text-[#2C221E] dark:text-[#FAF5EE]">
              <span data-testid="whatif-score">{sim.score}</span>
              <span className="text-sm font-bold text-[#8A7F72]">/100</span>
            </p>
            <p className="text-[12px] font-extrabold">
              <span data-testid="whatif-grade">Grade {simulateGrade(sim)}</span>
              {delta ? (
                <span className={clsx('ml-1.5', delta > 0 ? 'text-[#2F7A55]' : 'text-[#B5654A]')}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const simulateGrade = (sim) => {
  if (sim.grade) return sim.grade;
  const s = sim.score;
  return s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 50 ? 'D' : 'E';
};

/* --- Feature C: the one-tap fixes ------------------------------------- */

export function AuditFixPills({ language, category }) {
  const C = wellnessCopy(language);
  const navigate = useNavigate();
  const showBudget = !category || ['savings', 'spending', 'debt', 'income'].includes(category);
  const showEmergency = !category || ['emergency_fund', 'savings', 'liquidity'].includes(category);
  const pill =
    'inline-flex items-center gap-1 rounded-full border-2 border-[#4A3540] px-3 py-1 text-[11.5px] font-extrabold text-[#2C221E] shadow-[0_3px_0_#4A3540] transition-transform hover:-translate-y-0.5 active:translate-y-0.5';
  return (
    <span className="mt-2 flex flex-wrap gap-2" data-testid="audit-fix-pills">
      {showBudget ? (
        <button
          type="button"
          className={clsx(pill, 'bg-[#FFF6D6]')}
          onClick={() => navigate('/budgets?preset=50-30-20', { state: { preset: '50-30-20' } })}
          data-testid="audit-fix-budget"
        >
          {C.fix_budget} →
        </button>
      ) : null}
      {showEmergency ? (
        <button
          type="button"
          className={clsx(pill, 'bg-[#E3F2EA]')}
          onClick={() => navigate('/goals?new=emergency', { state: { newGoal: 'emergency' } })}
          data-testid="audit-fix-emergency"
        >
          {C.fix_emergency} →
        </button>
      ) : null}
    </span>
  );
}
