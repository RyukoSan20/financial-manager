/*
 * The wellness bento.
 *
 * The health coach page was a stack of white panels of the same size,
 * and the score - the one number the reader came for - was one line
 * inside the first of them. The eye had no way of knowing which part
 * of the page was the answer and which part was the detail.
 *
 * This is the answer: a bento grid, where the score takes the wide
 * end of the row and the smaller numbers fit in around it. Each card
 * carries a small drawing, so the page has some texture and the
 * reader can tell the cards apart before reading a word of them.
 *
 * The layout is two rows of twelve columns.
 *
 *   Top:     the score (five) beside the four amounts (seven).
 *   Bottom:  the ratios (five) beside the audit (seven).
 *
 * It used to be three columns, and it did not fit: the score took
 * three of six columns and the ratios took two, so the audit was
 * pushed down and the space beside the ratios - half the screen - was
 * left empty. A reader was shown a gap where their own report should
 * have been.
 *
 * The drawings are plain SVG. There is no picture to wait for and no
 * library to load, and they take the colour of the card they sit on.
 *
 * The mascot reacts to the score. A character that always looks the
 * same says nothing; a worried face over a healthy score would be a
 * lie, and this one is only ever drawn from the score the server
 * worked out.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useTheme } from '../../contexts/ThemeContext';
import FluidProgressBar from '../ui/FluidProgressBar';
import AnimatedProgressBar from '../ui/AnimatedProgressBar';
import CountUpNumber from '../ui/CountUpNumber';
import { moneyLayerOn } from '../../utils/animation';
import { MascotCompanion } from '../common/MascotCompanion';
import { readerFlag } from '../../utils/featureFlags';
import FinancialRatioPills from './FinancialRatioPills';
import './wellness.css';

/**
 * The drawings.
 *
 * Each one is a handful of shapes, and each one takes a colour. They
 * are drawn here rather than fetched, so a card is never half-empty
 * while a picture is on its way.
 */

/** A stack of coins: money coming in. */
const CoinStack = ({ tint = '#10b981' }) => (
  <svg viewBox="0 0 64 48" className="h-10 w-16" aria-hidden="true" focusable="false">
    <ellipse cx="32" cy="36" rx="20" ry="7" fill={tint} opacity="0.22" />
    <rect x="14" y="26" width="36" height="8" rx="4" fill={tint} opacity="0.55" />
    <rect x="18" y="17" width="28" height="8" rx="4" fill={tint} opacity="0.75" />
    <rect x="22" y="8" width="20" height="8" rx="4" fill={tint} />
    <circle cx="32" cy="12" r="2.4" fill="#ffffff" opacity="0.8" />
  </svg>
);

/** An umbrella over a coin: the emergency fund. */
const Umbrella = ({ tint = '#0ea5e9' }) => (
  <svg viewBox="0 0 64 48" className="h-10 w-16" aria-hidden="true" focusable="false">
    <path
      d="M6 26 C 12 10, 24 4, 32 4 C 40 4, 52 10, 58 26 C 52 22, 46 30, 40 26 C 34 22, 28 30, 22 26 C 16 22, 12 30, 6 26 Z"
      fill={tint}
      opacity="0.35"
    />
    <path d="M32 6 L32 38 C 32 43, 26 43, 26 38" stroke={tint} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    <circle cx="32" cy="38" r="2.6" fill={tint} />
  </svg>
);

/** A sprout in a pot: what is being saved. */
const Sprout = ({ tint = '#22c55e' }) => (
  <svg viewBox="0 0 64 48" className="h-10 w-16" aria-hidden="true" focusable="false">
    <path d="M32 40 L32 20" stroke={tint} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M32 22 C 22 22, 16 16, 16 8 C 26 8, 32 14, 32 22 Z" fill={tint} opacity="0.7" />
    <path d="M32 26 C 42 26, 48 20, 48 12 C 38 12, 32 18, 32 26 Z" fill={tint} opacity="0.45" />
    <path d="M20 40 L44 40 L40 32 L24 32 Z" fill={tint} opacity="0.6" />
  </svg>
);

/** A wallet: what is in the bank. */
const Wallet = ({ tint = '#8b5cf6' }) => (
  <svg viewBox="0 0 64 48" className="h-10 w-16" aria-hidden="true" focusable="false">
    <rect x="8" y="12" width="44" height="26" rx="7" fill={tint} opacity="0.45" />
    <rect x="8" y="12" width="44" height="9" rx="4.5" fill={tint} opacity="0.75" />
    <circle cx="42" cy="27" r="4" fill="#ffffff" opacity="0.85" />
    <rect x="14" y="6" width="20" height="8" rx="4" fill={tint} opacity="0.35" />
  </svg>
);

/** A small sun: the health of the month. */
const Sun = ({ tint = '#f59e0b' }) => (
  <svg viewBox="0 0 64 48" className="h-10 w-16" aria-hidden="true" focusable="false">
    <circle cx="32" cy="24" r="10" fill={tint} opacity="0.85" />
    <g stroke={tint} strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
      <path d="M32 6 L32 12" />
      <path d="M32 36 L32 42" />
      <path d="M14 24 L20 24" />
      <path d="M44 24 L50 24" />
      <path d="M19 11 L23 15" />
      <path d="M41 33 L45 37" />
      <path d="M45 11 L41 15" />
      <path d="M23 33 L19 37" />
    </g>
  </svg>
);

/**
 * The radial gauge.
 *
 * The score used to be a flat number beside a static sun drawing.
 * This draws it as a ring instead: the ring fills smoothly from zero
 * to the score over 800ms, and the colour and the soft glow behind
 * it both answer the grade - emerald for a strong score, amber for a
 * middling one, coral for one that needs work - so the colour tells
 * the same story as the number before it is even read.
 */
const RadialGauge = ({ score = 0, size = 72 }) => {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const [dash, setDash] = useState(circumference);

  const colour = clamped >= 80
    ? '#10B981'
    : clamped >= 60
      ? '#10B981'
      : clamped >= 40
        ? '#F59E0B'
        : '#E07A5F';

  useEffect(() => {
    // The ring starts fully empty and animates to the score's share
    // of the circle over 800ms, via the CSS transition on the
    // stroke-dashoffset below rather than a frame loop.
    const frame = requestAnimationFrame(() => {
      setDash(circumference - (clamped / 100) * circumference);
    });
    return () => cancelAnimationFrame(frame);
  }, [clamped, circumference]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* The ambient glow, tinted to match the grade. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 22px 4px ${colour}55`,
          opacity: 0.8,
        }}
        aria-hidden="true"
      />
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="relative">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-gray-200/70 dark:text-white/10"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
    </div>
  );
};

/**
 * The wash of a card: a pastel gradient behind the glass.
 *
 * Written out in full for each card, because a gradient built at run
 * time is not seen by the scanner and never reaches the stylesheet.
 */
const WASHES = {
  mint: 'linear-gradient(135deg, rgba(167,243,208,0.55) 0%, rgba(255,255,255,0) 62%)',
  sky: 'linear-gradient(135deg, rgba(186,230,253,0.55) 0%, rgba(255,255,255,0) 62%)',
  lilac: 'linear-gradient(135deg, rgba(221,214,254,0.55) 0%, rgba(255,255,255,0) 62%)',
  peach: 'linear-gradient(135deg, rgba(254,215,170,0.55) 0%, rgba(255,255,255,0) 62%)',
  blush: 'linear-gradient(135deg, rgba(254,205,211,0.5) 0%, rgba(255,255,255,0) 62%)',
};

/**
 * The score.
 *
 * The server sends a number from 0 to 100 and a grade. The number is
 * what the reader came for, so it is the largest thing on the page.
 */
const ScoreColour = (score) => {
  if (score >= 80) return 'rgb(16 185 129)';
  if (score >= 60) return 'rgb(14 165 233)';
  if (score >= 40) return 'rgb(245 158 11)';
  return 'rgb(244 63 94)';
};

/**
 * The same verdict, but as a colour that can be READ.
 *
 * `ScoreColour` is the fill colour: it is chosen to look right as a
 * ring and as a bar, where it is a block of colour rather than text.
 * Used as the colour of small text on its own 12% wash it fails
 * badly - the amber grade badge measured 2.11:1 on the live site,
 * which is well under the 4.5:1 floor for body text.
 *
 * So the badge takes its text colour from here instead: the same hue,
 * moved far enough into the colour to be read on a pale wash in the
 * light mode, and lifted to a light step for the dark mode. One value
 * per job, which is the rule the accent itself already follows.
 */
const ScoreTextColour = (score, isDark) => {
  if (score >= 80) return isDark ? '#6EE7B7' : '#065F46';
  if (score >= 60) return isDark ? '#7DD3FC' : '#075985';
  if (score >= 40) return isDark ? '#FCD34D' : '#92400E';
  return isDark ? '#FDA4AF' : '#9F1239';
};

/**
 * The small face.
 *
 * The companion is behind a switch of its own, so a reader who has not
 * turned it on still gets a face - and the face says the same thing
 * the companion would have said: a smile when the score is good, a
 * frown when it is not. It is drawn from plain SVG, so there is no
 * picture to wait for.
 */
const MiniFace = ({ mood, size = 52, tint = '#f472b6' }) => {
  const happy = mood !== 'worried';

  return (
    <svg
      viewBox="0 0 60 60"
      width={size}
      height={size}
      fill="none"
      className="wellness-drift shrink-0"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 30 6 C 42 6 50 15 50 27 C 50 40 42 50 30 50 C 18 50 10 40 10 27 C 10 15 18 6 30 6 Z"
        fill={tint}
        opacity="0.85"
      />
      <path
        d="M 30 10 C 40 10 46 17 46 27 C 46 37 40 45 30 45 C 20 45 14 37 14 27 C 14 17 20 10 30 10 Z"
        fill="#ffffff"
        opacity="0.94"
      />
      {/* The brows. */}
      <path
        d={happy ? 'M 18 21 L 25 18 M 42 21 L 35 18' : 'M 18 17 L 25 20 M 42 17 L 35 20'}
        stroke="#374151"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* The eyes. */}
      <ellipse cx="22.5" cy="28" rx="3.2" ry={happy ? 3.6 : 4.4} fill="#1f2937" />
      <ellipse cx="37.5" cy="28" rx="3.2" ry={happy ? 3.6 : 4.4} fill="#1f2937" />
      <circle cx="23.4" cy="26.8" r="1.1" fill="#ffffff" opacity="0.9" />
      <circle cx="38.4" cy="26.8" r="1.1" fill="#ffffff" opacity="0.9" />
      {/* The mouth. */}
      {happy ? (
        <path
          d="M 24 38 Q 30 42.5 36 38"
          stroke="#374151"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M 24 41 Q 30 37 36 41"
          stroke="#374151"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
};

/**
 * A small number with its label.
 *
 * The amount must be readable in full. It was cut off with an
 * ellipsis, so `Rp 5.765.000` was shown as `Rp...` and the reader
 * could not see what they had. Money that cannot be read is not money
 * the reader can act on, so the amount is never truncated.
 *
 * Two separate faults are fixed here.
 *
 * The first is the amount. `break-words` breaks wherever the line
 * runs out of room, so "Rp 5.975.000" was drawn as "Rp 5.975" with
 * ".000" on the line below - two numbers where there was one. The
 * amount is now kept whole: it never wraps, and it is made a little
 * smaller when it has to be.
 *
 * The second is the label. "PENGHASILAN BULANAN" was drawn as
 * "PENGHASILA" and "N" on the line below, because the label was
 * allowed to break in the middle of a word. A word is a word, so the
 * label is not allowed to break: it wraps between the words, or it
 * shrinks.
 */
const MiniStat = ({ label, value, tint, illustration }) => (
  <div className="flex items-center gap-3 min-w-0">
    {/* The drawing, in a small holder.

        It used to be the drawing on its own, and it took up as much
        room as the number it was meant to introduce. Now it sits in
        a small tinted square, so the four of them read as a row of
        siblings instead of four different objects. */}
    <div
      className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: `rgba(${tint.replace('#', '')}, 0.12)` }}
    >
      <div className="wellness-drift scale-[0.62]">{illustration}</div>
    </div>
    <div className="min-w-0 flex-1">
      {/* The label.

          The words are not broken in the middle. The label is the
          name of the amount, and a name broken in half is two
          things. It wraps between the words instead. */}
      <p className="shape-label">{label}</p>
      {/* The amount.

          One number, drawn on one line. The size steps down on
          smaller screens rather than the number being cut. */}
      <p className="mt-0.5 text-lg xl:text-xl font-bold tabular-nums whitespace-nowrap text-gray-900 dark:text-gray-100 leading-tight">
        {value}
      </p>
    </div>
  </div>
);

/**
 * The bento.
 *
 * Every number it shows is a number the page already had. Nothing is
 * worked out here that the server has not worked out, and the ratios
 * come in as the objects the server sent.
 */
export default function CuteWellnessBento({
  score = 0,
  grade = '-',
  monthlyIncome = 0,
  monthlyExpense = 0,
  totalCash = 0,
  totalDebt = 0,
  savingsRatio,
  emergencyFund,
  dsrRatio,
  ratioDescription,
  audit,
  onRefresh,
  polished = false,
}) {
  const { t } = useTranslation();
  // The grade badge needs to know which half of the theme it is on,
  // because its text colour differs between the two (see
  // ScoreTextColour). The shared context is the one source of truth
  // for that - a private matchMedia here would drift from the toggle.
  const { isDarkMode } = useTheme();

  const numericScore = Number(score || 0);
  const mood = numericScore >= 60 ? 'happy' : 'worried';
  const money = moneyLayerOn();

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const describe = typeof ratioDescription === 'function' ? ratioDescription : () => '';

  return (
    <div className="space-y-5">
      {/* ---- The top row: the score beside the four amounts ------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* The score. Five columns of the twelve. */}
        <div className="lg:col-span-5">
          <div className="wellness-card h-full p-5 settle-in">
            <div className="wellness-card__wash" style={{ background: WASHES.mint }} />
            <div className="wellness-halo" />

            {/* The score.

                It is one thing, not four. It used to be a number,
                a letter grade, a bar and a face, all at the same
                weight, so the eye had four things to read and no way
                of knowing which was the answer.

                Now the number is the answer, the grade is a small
                mark beside it, and the bar and the face support it. */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="shape-label font-sans">{t('health_coach.score')}</p>
                <div className="flex items-baseline gap-2.5 mt-1">
                  {/* The score rolls up to where it is. A score that
                      appears all at once is a number; one that
                      counts up is a reading being taken. */}
                  <p className="text-5xl font-extrabold font-sans text-gray-900 dark:text-gray-50 tabular-nums leading-none tracking-tight">
                    <CountUpNumber value={numericScore} from={0} format={(n) => Math.round(n)} />
                  </p>
                  <span className="text-sm text-gray-400 dark:text-gray-500 font-medium font-sans tabular-nums">
                    /100
                  </span>
                </div>
              </div>

              <div className="wellness-drift wellness-drift--slow shrink-0">
                <RadialGauge score={numericScore} />
              </div>
            </div>

            {/* The grade, as a small pastel pill.

                It used to be a line of text - "Grade: D" - and the
                grade is the one-word answer the reader came for, so
                it is given a badge of its own. */}
            {/* The grade.

                It is the one-word answer the reader came for, so it
                gets a badge of its own - and the badge takes the
                colour of the score, because a grade of D in green
                is a lie. */}
            <div className="mt-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ring-1"
                style={{
                  // The wash and the ring are the fill colour; the
                  // words are the readable one. Using the fill colour
                  // as text on its own 12% wash is what measured
                  // 2.11:1 on the live site.
                  backgroundColor: `rgba(${ScoreColour(numericScore).replace('rgb(', '').replace(')', '')}, ${isDarkMode ? 0.22 : 0.12})`,
                  color: ScoreTextColour(numericScore, isDarkMode),
                  boxShadow: `inset 0 0 0 1px rgba(${ScoreColour(numericScore).replace('rgb(', '').replace(')', '')}, 0.28)`,
                }}
              >
                {t('health_coach.grade')}{' '}
                <span className="font-bold">{grade}</span>
              </span>
            </div>

            {/* The score as a liquid.

                The liquid layer is what the reader asked for. When
                it is off, the bar fills from nothing to where it
                should be instead, so the line is seen to move. */}
            <div className="mt-4">
              {moneyLayerOn() ? (
                <FluidProgressBar
                  value={numericScore}
                  max={100}
                  size="lg"
                  colour={ScoreColour(numericScore)}
                />
              ) : (
                <AnimatedProgressBar percent={numericScore} over={false} />
              )}
            </div>

            {/* The face, and what it says.

                The companion draws nothing until the reader has asked
                for it, so the card carries its own small face as well.
                One of the two is always there, and the face always
                matches the score: a smile when the score is good, a
                frown when it is not. */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {readerFlag('MASCOT_COMPANION') ? (
                <MascotCompanion mood={mood} size={52} title={t('health_coach.score')} />
              ) : (
                <MiniFace mood={mood} size={52} />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-300 min-w-0">
                {mood === 'happy'
                  ? t('health_coach.mascot_good')
                  : t('health_coach.mascot_worried')}
              </span>
            </div>
          </div>
        </div>

        {/* The four amounts. Seven columns of the twelve, in two
            comfortable rows of two. */}
        <div className="lg:col-span-7">
          <div className="wellness-card h-full p-5">
            <div className="wellness-card__wash" style={{ background: WASHES.sky }} />
            {/* The four amounts.

                They are one snapshot, so they are one grid of four
                quiet panels with the same shape. They used to be
                four drawings floating on the wash of the card, and
                the eye could not tell they were a set. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bento-cascade rounded-xl bg-white/55 dark:bg-white/5 px-3.5 py-3 ring-1 ring-slate-200/50 dark:ring-white/10 transition-shadow hover:shadow-md hover:-translate-y-0.5 duration-200" style={{ '--stagger-index': 0 }}>
                <MiniStat
                  label={t('health_coach.monthly_income')}
                  value={formatCurrency(monthlyIncome)}
                  tint="#10b981"
                  illustration={<CoinStack tint="#10b981" />}
                />
              </div>
              <div className="bento-cascade rounded-xl bg-white/55 dark:bg-white/5 px-3.5 py-3 ring-1 ring-slate-200/50 dark:ring-white/10 transition-shadow hover:shadow-md hover:-translate-y-0.5 duration-200" style={{ '--stagger-index': 1 }}>
                <MiniStat
                  label={t('health_coach.monthly_expense')}
                  value={formatCurrency(monthlyExpense)}
                  tint="#f97316"
                  illustration={<Sprout tint="#f97316" />}
                />
              </div>
              <div className="bento-cascade rounded-xl bg-white/55 dark:bg-white/5 px-3.5 py-3 ring-1 ring-slate-200/50 dark:ring-white/10 transition-shadow hover:shadow-md hover:-translate-y-0.5 duration-200" style={{ '--stagger-index': 2 }}>
                <MiniStat
                  label={t('health_coach.total_cash')}
                  value={formatCurrency(totalCash)}
                  tint="#8b5cf6"
                  illustration={<Wallet tint="#8b5cf6" />}
                />
              </div>
              <div className="bento-cascade rounded-xl bg-white/55 dark:bg-white/5 px-3.5 py-3 ring-1 ring-slate-200/50 dark:ring-white/10 transition-shadow hover:shadow-md hover:-translate-y-0.5 duration-200" style={{ '--stagger-index': 3 }}>
                <MiniStat
                  label={t('health_coach.total_debt')}
                  value={formatCurrency(totalDebt)}
                  tint="#f43f5e"
                  illustration={<Umbrella tint="#f43f5e" />}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- The bottom row: the ratios beside the audit --------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* The ratios, and the refresh. Five columns of the twelve. */}
        <div className="lg:col-span-5">
          <div className="wellness-card h-full p-5">
            <div className="wellness-card__wash" style={{ background: WASHES.peach }} />
            <div className="flex items-center gap-3">
              <div className="wellness-drift shrink-0">
                <Umbrella tint="#0ea5e9" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#52796F] dark:text-emerald-300 font-sans">
                  {t('health_coach.financial_ratios')}
                </p>
              </div>
            </div>

            <FinancialRatioPills
              className="mt-4"
              savingsRatio={savingsRatio}
              emergencyFund={emergencyFund}
              dsrRatio={dsrRatio}
            />

            {/* The notes under the ratios.

                These are sentences, so they are allowed to break
                wherever they run out of room - they are not numbers,
                and a sentence cut in half is not a sentence. */}
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 break-words">
              {describe(savingsRatio) || t('health_coach.savings_desc_default')}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('health_coach.emergency_target')}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('health_coach.dsr_note')}
            </p>

            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className={`mt-4 w-full py-2.5 rounded-2xl font-medium text-white ${
                  money ? 'money-fab' : ''
                } bg-primary-600 hover:bg-primary-700 transition-colors`}
              >
                {t('health_coach.refresh_data')}
              </button>
            ) : null}
          </div>
        </div>

        {/* The audit. Seven columns of the twelve. */}
        <div className="lg:col-span-7">
          <div className="wellness-card p-5 h-full">
            <div className="wellness-card__wash" style={{ background: WASHES.blush }} />
            <h2 className="text-lg font-bold font-sans text-[#1F2421] dark:text-[#FAF9F6]">
              {t('health_coach.ai_audit')}
            </h2>

            {/* The narrative used to be drawn as it was written: a
                wall of text with `=====` rules through it and a hard
                black border. It read like a terminal dump, not like
                the reader's own report.

                The same sentences are now drawn as four plain cards:
                what was found, what is already good, what to do now,
                and the tips. The text is unchanged; only the way it is
                drawn has changed. */}
            {(audit.findings?.length > 0 ||
              audit.highlights?.length > 0 ||
              audit.immediate_actions?.length > 0 ||
              audit.recommendations?.length > 0 ||
              (audit.monthly_plan && Object.keys(audit.monthly_plan).length > 0)) && (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {audit.findings?.length > 0 && (
                  <section className="rounded-xl bg-amber-50/70 dark:bg-amber-900/15 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      {t('health_coach.finding_title')}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {audit.findings.slice(0, 3).map((finding, idx) => (
                        <li key={idx} className="text-xs text-gray-700 dark:text-gray-200">
                          <span className="font-medium">{finding.title}</span>
                          <span className="block text-gray-600 dark:text-gray-300">
                            {finding.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* What is already good.

                    When there is nothing to say, the panel says why
                    instead of sitting there empty. An empty panel
                    reads as a bug, or worse, as the answer: "you have
                    no strengths". It is neither - it is "there is
                    not enough recorded yet to tell", which is a very
                    different thing to read. */}
                {audit.highlights?.length > 0 ? (
                  <section className="rounded-xl bg-emerald-50/70 dark:bg-emerald-900/15 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                      {t('health_coach.strength_title')}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {audit.highlights.map((highlight, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-gray-700 dark:text-gray-200"
                        >
                          {String(highlight).replace(/^[✅❌🌟]\s*/u, '')}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <section className="rounded-xl bg-emerald-50/40 dark:bg-emerald-900/10 p-3 border border-dashed border-emerald-200/70 dark:border-emerald-500/20">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">
                      {t('health_coach.strength_title')}
                    </h3>
                    <p className="mt-1.5 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                      {t('health_coach.strengths_empty')}
                    </p>
                  </section>
                )}

                {audit.immediate_actions?.length > 0 && (
                  <section className="rounded-xl bg-sky-50/70 dark:bg-sky-900/15 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                      {t('health_coach.action_title')}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {audit.immediate_actions.slice(0, 4).map((action, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-gray-700 dark:text-gray-200"
                        >
                          {String(action).replace(/^[\u{1F6A8}\u26A0]\s*/u, '')}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {audit.recommendations?.length > 0 && (
                  <section className="rounded-xl bg-amber-50/70 dark:bg-amber-900/15 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      {t('health_coach.improvement_tips')}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {audit.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-xs text-gray-700 dark:text-gray-200">
                          {String(rec).replace(/^[\u{1F4A1}]\s*/u, '')}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {audit.monthly_plan && Object.keys(audit.monthly_plan).length > 0 && (
                  <section className="rounded-xl bg-violet-50/70 dark:bg-violet-900/15 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                      {t('health_coach.plan_title')}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {Object.entries(audit.monthly_plan).map(([key, value]) => (
                        <li key={key} className="text-xs text-gray-700 dark:text-gray-200">
                          <span className="font-medium capitalize">{key}</span>
                          <span className="block text-gray-600 dark:text-gray-300">
                            {value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { CuteWellnessBento, CoinStack, Sprout, Umbrella, Wallet, Sun, MiniFace };
