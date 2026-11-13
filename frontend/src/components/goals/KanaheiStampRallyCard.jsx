/**
 * The seven-day stamp card.
 *
 * A row of seven round slots, like the stamps in a household account
 * book. A day that was written down gets a stamp; a day that was not
 * gets an empty slot with a dotted outline. Hovering a slot opens the
 * hover board with the little episode of the account book that goes
 * with that day.
 *
 * It is the small habit tracker of the goals page: not a chart, not a
 * number - seven circles that fill up.
 */

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import KakeiboHoverBoard from '../ui/KakeiboHoverBoard';

/**
 * The paw stamp - the mark that says the day was filled.
 *
 * @param {'sage'|'terracotta'} tone
 */
function PawStamp({ tone = 'sage' }) {
  const fill = tone === 'terracotta' ? '#E07A5F' : '#52796F';
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="6.4" ry="5.2" fill={fill} />
      <ellipse cx="6.4" cy="9.4" rx="2.3" ry="2.9" fill={fill} />
      <ellipse cx="11" cy="6.8" rx="2.2" ry="2.8" fill={fill} />
      <ellipse cx="16" cy="6.8" rx="2.2" ry="2.8" fill={fill} />
      <ellipse cx="19.4" cy="10.4" rx="2.1" ry="2.6" fill={fill} />
    </svg>
  );
}

/**
 * The leaf stamp - the mark for a day that was saved rather than
 * spent.
 */
function LeafStamp() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M19 5 C11 5 5 9 5 15 C5 18 7 19 9 19 C15 19 19 13 19 5 Z"
        fill="#52796F"
      />
      <path d="M19 5 C16 12 12 16 7 19" fill="none" stroke="#FFFDF9" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The card.
 *
 * `filled` is how many of the seven days are stamped. `savedDays` is
 * how many of them were days the reader saved rather than spent; the
 * difference is drawn in terracotta.
 * `onAction` is called when the reader asks to write a transaction.
 */
export default function KanaheiStampRallyCard({
  filled = 0,
  savedDays = 0,
  className = '',
  onAction,
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => i + 1), []);

  const stampTone = (day) => {
    if (day > filled) return 'empty';
    // The last stamped day is the terracotta one - the day the
    // reader just filled.
    return day === filled ? 'terracotta' : 'sage';
  };

  const episodeFor = (day) => t(`kanahei.stamp_episode_${day}`);

  return (
    <section
      data-kanahei-stamp-card
      className={clsx(
        'hh-card flex flex-col gap-3 p-5',
        className
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#52796F]">
            {t('kanahei.badge')}
          </p>
          <h2 className="mt-1 text-base font-bold text-[#2D312E]">{t('kanahei.stamp_title')}</h2>
          <p className="mt-0.5 text-xs text-[#5C6460]">{t('kanahei.stamp_subtitle')}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#D8F3DC] px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-[#1B3B32]">
          {filled}/7
        </span>
      </header>

      {/* The seven slots. */}
      <div className="flex flex-wrap items-start gap-2">
        {days.map((day) => {
          const tone = stampTone(day);
          const isFilled = tone !== 'empty';
          const isHovered = hovered === day;
          return (
            <div
              key={day}
              className="relative"
              onMouseEnter={() => setHovered(day)}
              onMouseLeave={() => setHovered((current) => (current === day ? null : current))}
              onFocus={() => setHovered(day)}
              onBlur={() => setHovered((current) => (current === day ? null : current))}
              tabIndex={0}
              role="button"
              aria-label={`${t('kanahei.stamp_day').replace('%s', day)} - ${isFilled ? t('kanahei.stamp_filled') : t('kanahei.stamp_locked')}`}
              data-stamp-day={day}
              data-stamp-state={tone}
            >
              <div
                className={clsx(
                  'flex h-14 w-14 flex-col items-center justify-center rounded-full border-[1.5px] transition-transform duration-200',
                  isFilled
                    ? 'border-[#4A3F35] bg-[#FFFDF9]'
                    : 'border-dashed border-[#C9C2B6] bg-transparent',
                  isHovered && '-translate-y-0.5'
                )}
              >
                {isFilled ? (
                  tone === 'terracotta' ? <PawStamp tone="terracotta" /> : <LeafStamp />
                ) : (
                  <span className="text-[11px] font-bold tabular-nums text-[#B3ABA0]">
                    {t('kanahei.stamp_day').replace('%s', day)}
                  </span>
                )}
              </div>

              <span className="mt-1 block text-center text-[10px] font-semibold tabular-nums text-[#5C6460]">
                {t('kanahei.stamp_day').replace('%s', day)}
              </span>

              <KakeiboHoverBoard
                visible={isHovered}
                title={t('kanahei.stamp_day').replace('%s', day)}
                subtitle={isFilled ? episodeFor(day) : t('kanahei.stamp_encourage')}
                badge={isFilled ? t('kanahei.stamp_filled') : t('kanahei.stamp_locked')}
                position="top"
                actionLabel={!isFilled && onAction ? t('kanahei.stamp_action') : undefined}
                onAction={!isFilled && onAction ? onAction : undefined}
                metrics={
                  isFilled
                    ? [{ label: t('goals.active_count').replace('%s', '').trim(), value: `1/1` }]
                    : []
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { KanaheiStampRallyCard, PawStamp, LeafStamp };
