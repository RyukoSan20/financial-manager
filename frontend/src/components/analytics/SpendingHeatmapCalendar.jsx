/**
 * The calendar of spending.
 *
 * "Which day was the worst one?" is a question a monthly total cannot
 * answer. The whole point is that the money came out on one day rather
 * than spread across thirty, so the reader needs to see the days.
 *
 * So the month is drawn as a calendar, and each day is coloured by how
 * much went out on it. A day with nothing on it is clean and pale. A
 * day with a little on it is soft green. A day with a lot is amber.
 * And the one day that cost the most is marked, with a flame, because
 * that is the day the reader is looking for.
 *
 * Clicking a day opens what happened on it - the transactions and the
 * total - so the colour is never the whole story.
 *
 * The colour is by rank, not by an amount. A reader whose worst day
 * was sixty thousand and a reader whose worst day was six million are
 * both shown their worst day, which is the point of the calendar.
 */

import { useMemo, useState } from 'react';
import { Flame, X } from 'lucide-react';

/**
 * A rupiah amount, shortened to fit inside a day cell.
 *
 * "Rp 35rb" for thirty-five thousand, "Rp 1,2jt" for over a million.
 * The full amount is still on the cell's label for a reader who wants
 * it exactly.
 */
function compactRupiah(value) {
  const n = Math.round(Number(value) || 0);
  if (n <= 0) return '';
  if (n >= 1_000_000) {
    const jt = n / 1_000_000;
    return `Rp${jt >= 10 ? Math.round(jt) : jt.toFixed(1).replace('.', ',')}jt`;
  }
  if (n >= 1_000) return `Rp${Math.round(n / 1000)}rb`;
  return `Rp${n}`;
}

import { useTranslation } from '../../i18n';
import { CountUpNumber } from '../ui/CountUpNumber';
import { HEAT_CLASSES, heatLevel } from '../../utils/progressColors';

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// The colours are in `utils/progressColors.js`, with no React in it,
// so they can be checked by a script.
export { heatLevel, HEAT_CLASSES };

/**
 * The days of a month, with the spending on each of them.
 *
 * The days that have no spending are not in the answer from the
 * server, so they are made here - a calendar with holes in it would
 * be a lie about the month.
 */
export function buildMonthDays(year, month, spendingByDate = {}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // The first of the month, and what day of the week it is. The week
  // starts on Monday, so the empty cells before it are the days of
  // the week that came before.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const days = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    days.push({ key: `pad-${i}`, blank: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = spendingByDate[key];
    days.push({
      key,
      blank: false,
      day,
      date: key,
      total: entry?.total ?? 0,
      count: entry?.count ?? 0,
      hasSpending: Boolean(entry && (entry.total > 0 || entry.count > 0)),
    });
  }

  return days;
}

/**
 * The spending of each day, by its date.
 */
export function spendingByDate(days = []) {
  const map = {};
  for (const entry of days) {
    if (entry?.date) map[entry.date] = entry;
  }
  return map;
}

/**
 * @param {object} props
 * @param {Array} props.days          The days with spending on them
 * @param {string} props.month        The month, as YYYY-MM
 * @param {Function} [props.onSelect] Called with the date that was clicked
 */
export default function SpendingHeatmapCalendar({ days = [], month, onSelect }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);

  const [year, monthIndex] = useMemo(() => {
    if (!month) {
      const today = new Date();
      return [today.getFullYear(), today.getMonth()];
    }
    const [y, m] = String(month).split('-');
    return [Number(y), Number(m) - 1];
  }, [month]);

  const byDate = useMemo(() => spendingByDate(days), [days]);

  const max = useMemo(
    () => Math.max(0, ...Object.values(byDate).map((d) => d.total || 0)),
    [byDate],
  );

  const worst = useMemo(() => {
    let worstDay = null;
    for (const entry of Object.values(byDate)) {
      if (!worstDay || (entry.total || 0) > (worstDay.total || 0)) {
        worstDay = entry;
      }
    }
    return worstDay;
  }, [byDate]);

  const calendarDays = useMemo(
    () => buildMonthDays(year, monthIndex, byDate),
    [year, monthIndex, byDate],
  );

  const monthName = useMemo(
    () => new Date(year, monthIndex, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    [year, monthIndex],
  );

  const selectedEntry = selected ? byDate[selected] : null;

  const rupiah = useMemo(
    () => new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
    }),
    [],
  );

  const pick = (day) => {
    if (day.blank) return;
    setSelected(day.date);
    onSelect?.(day.date);
  };

  return (
    <div className="spending-heatmap" data-testid="spending-heatmap">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('heatmap.title')}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">{monthName}</span>
      </div>

      {/* The names of the days. */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center text-[10px] font-medium uppercase tracking-wide text-gray-400"
          >
            {name}
          </div>
        ))}
      </div>

      {/* The days. */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          if (day.blank) {
            return <div key={day.key} className="aspect-square" aria-hidden="true" />;
          }

          const level = heatLevel(day.total, max, day.hasSpending);
          const isWorst = worst && day.date === worst.date && day.total > 0;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => pick(day)}
              data-testid={`heatmap-day-${day.day}`}
              data-level={level}
              aria-label={`${day.date}: ${rupiah.format(day.total)}`}
              className={`relative h-14 sm:h-16 rounded-xl p-1.5 flex flex-col justify-between transition-[transform,box-shadow] duration-150 hover:scale-[1.03] hover:shadow-md ${HEAT_CLASSES[level]} ${
                selected === day.date ? 'ring-2 ring-[#112A20]' : ''
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-xs font-semibold leading-none">{day.day}</span>
                {isWorst ? (
                  <Flame className="w-3 h-3" aria-hidden="true" data-testid="worst-day-flame" />
                ) : null}
              </span>
              {day.hasSpending && day.total > 0 ? (
                <span className="text-[10px] font-semibold leading-none tabular-nums self-start" data-testid={`heatmap-amount-${day.day}`}>
                  {compactRupiah(day.total)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* The worst day, said out loud. */}
      {worst && worst.total > 0 ? (
        <p
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium"
          data-testid="worst-day-badge"
        >
          <Flame className="w-3.5 h-3.5" aria-hidden="true" />
          {t('heatmap.worst_day', '', { date: worst.date })}
        </p>
      ) : null}

      {/* What happened on the day that was picked. */}
      {selected ? (
        <div
          className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-white/10"
          data-testid="heatmap-day-detail"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {selected}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                <CountUpNumber
                  value={selectedEntry?.total || 0}
                  format={(n) => rupiah.format(n)}
                />
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={t('heatmap.close')}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('heatmap.transaction_count', '', { count: selectedEntry?.count || 0 })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { SpendingHeatmapCalendar };
