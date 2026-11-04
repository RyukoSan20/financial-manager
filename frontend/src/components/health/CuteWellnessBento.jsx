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
 * The drawings are plain SVG. There is no picture to wait for and no
 * library to load, and they take the colour of the card they sit on.
 *
 * The mascot reacts to the score. A character that always looks the
 * same says nothing; a worried face over a healthy score would be a
 * lie, and this one is only ever drawn from the score the server
 * worked out.
 */

import { useTranslation } from '../../i18n';
import BentoGrid, { BentoItem } from '../dashboard/BentoGrid';
import FluidProgressBar from '../ui/FluidProgressBar';
import { MascotCompanion } from '../common/MascotCompanion';
import { IconText } from '../ui/IconText';
import { readerFlag } from '../../utils/featureFlags';
import { moneyLayerOn } from '../../utils/animation';
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
 */
const MiniStat = ({ label, value, tint, illustration }) => (
  <div className="flex items-center gap-3">
    <div className="wellness-drift shrink-0">{illustration}</div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums truncate">
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
    <BentoGrid>
      {/* The score. The wide end of the row. */}
      <BentoItem span="half" order={1}>
        <div className="wellness-card h-full p-5 settle-in">
          <div className="wellness-card__wash" style={{ background: WASHES.mint }} />
          <div className="wellness-halo" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('health_coach.score')}
              </p>
              <p className="text-5xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
                {numericScore}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {t('health_coach.grade')}{' '}
                <span className="font-bold text-gray-900 dark:text-gray-100">{grade}</span>
              </p>
            </div>

            <div className="wellness-drift wellness-drift--slow shrink-0">
              <Sun tint={ScoreColour(numericScore)} />
            </div>
          </div>

          {/* The score as a liquid. */}
          <div className="mt-5">
            <FluidProgressBar
              value={numericScore}
              max={100}
              size="lg"
              colour={ScoreColour(numericScore)}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {/* The face.

                The companion draws nothing until the reader has asked
                for it, so the card carries its own small face as well.
                One of the two is always there, and the face always
                matches the score: a smile when the score is good, a
                frown when it is not. */}
            {readerFlag('MASCOT_COMPANION') ? (
              <MascotCompanion mood={mood} size={52} title={t('health_coach.score')} />
            ) : (
              <MiniFace mood={mood} size={52} />
            )}
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {mood === 'happy'
                ? t('health_coach.mascot_good')
                : t('health_coach.mascot_worried')}
            </span>
          </div>
        </div>
      </BentoItem>

      {/* The money that comes in, and the money that goes out. */}
      <BentoItem span="normal" order={2}>
        <div className="wellness-card h-full p-4">
          <div className="wellness-card__wash" style={{ background: WASHES.sky }} />
          <div className="space-y-4">
            <MiniStat
              label={t('health_coach.monthly_income')}
              value={formatCurrency(monthlyIncome)}
              illustration={<CoinStack tint="#10b981" />}
            />
            <MiniStat
              label={t('health_coach.monthly_expense')}
              value={formatCurrency(monthlyExpense)}
              illustration={<Sprout tint="#f97316" />}
            />
          </div>
        </div>
      </BentoItem>

      {/* What is in the bank, and what is owed. */}
      <BentoItem span="normal" order={3}>
        <div className="wellness-card h-full p-4">
          <div className="wellness-card__wash" style={{ background: WASHES.lilac }} />
          <div className="space-y-4">
            <MiniStat
              label={t('health_coach.total_cash')}
              value={formatCurrency(totalCash)}
              illustration={<Wallet tint="#8b5cf6" />}
            />
            <MiniStat
              label={t('health_coach.total_debt')}
              value={formatCurrency(totalDebt)}
              illustration={<Umbrella tint="#f43f5e" />}
            />
          </div>
        </div>
      </BentoItem>

      {/* The ratios, as pills. */}
      <BentoItem span="third" order={4}>
        <div className="wellness-card h-full p-4">
          <div className="wellness-card__wash" style={{ background: WASHES.peach }} />
          <div className="flex items-center gap-3">
            <div className="wellness-drift shrink-0">
              <Umbrella tint="#0ea5e9" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('health_coach.financial_ratios')}
              </p>
            </div>
          </div>

          <FinancialRatioPills
            className="mt-3"
            savingsRatio={savingsRatio}
            emergencyFund={emergencyFund}
            dsrRatio={dsrRatio}
          />

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {describe(savingsRatio) || t('health_coach.savings_desc_default')}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('health_coach.emergency_target')}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('health_coach.dsr_note')}
          </p>
        </div>
      </BentoItem>

      {/* The audit. */}
      {audit ? (
        <BentoItem span="full" order={5}>
          <div className="wellness-card p-5">
            <div className="wellness-card__wash" style={{ background: WASHES.blush }} />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {t('health_coach.ai_audit')}
            </h2>

            {audit.highlights?.length > 0 && (
              <div className="mt-3 space-y-1">
                {audit.highlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="text-sm text-emerald-600 dark:text-emerald-300 flex items-start gap-2"
                  >
                    <IconText name="success" emoji="✅" on={polished} />
                    <span>{String(highlight).replace(/^[✅❌🌟]\s*/u, '')}</span>
                  </div>
                ))}
              </div>
            )}

            {audit.findings?.length > 0 && (
              <div className="mt-3 space-y-2">
                {audit.findings.slice(0, 3).map((finding, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-amber-50/80 dark:bg-amber-900/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <IconText name="warning" emoji="⚠️" on={polished} className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {finding.title}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      {finding.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {audit.recommendations?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-white/10">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {t('health_coach.improvement_tips')}
                </h3>
                {audit.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="text-sm flex items-start gap-2 mb-1 text-gray-700 dark:text-gray-200"
                  >
                    <IconText name="note" emoji="💡" on={polished} />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}

            {audit.narrative && (
              <div className="mt-4 rounded-xl bg-white/60 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {audit.narrative}
                </p>
              </div>
            )}
          </div>
        </BentoItem>
      ) : null}

      {/* The refresh. */}
      {onRefresh ? (
        <BentoItem span="full" order={6}>
          <button
            type="button"
            onClick={onRefresh}
            className={`w-full py-3 rounded-2xl font-medium text-white ${
              money ? 'money-fab' : ''
            } bg-primary-600 hover:bg-primary-700 transition-colors`}
          >
            {t('health_coach.refresh_data')}
          </button>
        </BentoItem>
      ) : null}
    </BentoGrid>
  );
}

export { CuteWellnessBento, CoinStack, Sprout, Umbrella, Wallet, Sun, MiniFace };
