/**
 * KanaheiStampRallyCard.
 *
 * A seven-day consistency "stamp rally", the kind a Japanese stationery
 * shop hands out: one square per day of the week, and a stamp lands on
 * a day the reader did something toward their goals. A filled stamp is
 * a small sage seal with the mascot; an empty one is a dotted outline
 * waiting to be earned.
 *
 * Hovering (or focusing) a day shows a `KakeiboHoverBoard` with that
 * day's episode note - what was saved, or that the day is still open.
 *
 * It reads its data from the `days` prop and writes nothing. When no
 * days are given it falls back to the current week, all empty, so the
 * card still draws rather than crashing.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import KakeiboHoverBoard from '../ui/KakeiboHoverBoard';
import KanaheiStationeryMascot from '../mascot/KanaheiStationeryMascot';
import { useTranslation } from '../../i18n';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function defaultWeek() {
  // Monday-first week, every day still open.
  return DAY_KEYS.map((key) => ({ key, stamped: false, note: null }));
}

export default function KanaheiStampRallyCard({
  days,
  className = '',
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(null);

  const week = Array.isArray(days) && days.length ? days.slice(0, 7) : defaultWeek();
  const stampedCount = week.filter((d) => d.stamped).length;

  return (
    <section
      className={clsx('hh-card p-5', className)}
      data-testid="kanahei-stamp-rally"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="font-bold text-[#2D312E] dark:text-[#ECFDF5] truncate">
            {t('kanahei.stamp_rally_title')}
          </p>
          <p className="text-sm hh-muted truncate">
            {t('kanahei.stamp_rally_caption', '', { done: stampedCount, total: week.length })}
          </p>
        </div>
        <KanaheiStationeryMascot
          state={stampedCount >= 5 ? 'happy' : 'idle'}
          size={48}
          label={t('kanahei.stamp_rally_title')}
        />
      </div>

      <div className="grid grid-cols-7 gap-2">
        {week.map((day) => {
          const label = t(`kanahei.day_${day.key}`);
          const isActive = active === day.key;
          return (
            <div key={day.key} className="relative flex flex-col items-center gap-1">
              <button
                type="button"
                onMouseEnter={() => setActive(day.key)}
                onMouseLeave={() => setActive((v) => (v === day.key ? null : v))}
                onFocus={() => setActive(day.key)}
                onBlur={() => setActive((v) => (v === day.key ? null : v))}
                onClick={() => setActive((v) => (v === day.key ? null : day.key))}
                aria-label={label}
                className={clsx(
                  'w-full aspect-square rounded-2xl flex items-center justify-center transition-[transform,box-shadow] duration-150 hover:scale-105',
                  day.stamped
                    ? 'bg-[#E6EFEA] border-2 border-[#52796F] text-[#2F6F4F]'
                    : 'bg-transparent border-2 border-dashed border-[#D9D3C7] text-[#C3BCAE]'
                )}
              >
                {day.stamped ? (
                  <span aria-hidden="true" className="text-lg font-black">✓</span>
                ) : (
                  <span aria-hidden="true" className="text-sm">○</span>
                )}
              </button>
              <span className="text-[10px] font-medium hh-muted">{label}</span>

              {isActive ? (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20">
                  <KakeiboHoverBoard
                    title={label}
                    subtitle={
                      day.stamped
                        ? t('kanahei.episode_done')
                        : t('kanahei.episode_open')
                    }
                    side="bottom"
                  >
                    {day.note ? (
                      <p className="text-xs" style={{ opacity: 0.85 }}>{day.note}</p>
                    ) : null}
                  </KakeiboHoverBoard>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { KanaheiStampRallyCard };
