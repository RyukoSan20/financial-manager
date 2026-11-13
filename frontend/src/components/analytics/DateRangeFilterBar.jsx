/**
 * The date and period filter.
 *
 * The analytics page had a dropdown with three choices: three months,
 * six months, twelve months. A reader who wanted to know about one
 * specific fortnight had no way to ask, and every card on the page
 * answered about a window they had not chosen.
 *
 * So this is a bar of shortcuts and a pair of date boxes:
 *
 * - the shortcuts, which cover what people ask for most often;
 * - the two dates, for when none of them is what was meant.
 *
 * And the choice is shown, so the reader can see what the numbers in
 * front of them are about. A card that answers about October should
 * say October.
 *
 * When a range is chosen by hand, the Custom Date Range Studio opens
 * immediately with both dates already filled in (this month so far),
 * so the reader never faces two empty boxes - they adjust from a
 * working range instead of building one from nothing.
 */

import { useState } from 'react';
import { Calendar, X, RotateCcw } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { popOnSelect } from '../../utils/animation';
import {
  DATE_PRESETS,
  isCustomRangeComplete,
  rangeLabel,
  resolveRange,
  toIsoDate,
} from '../../utils/dateRange';

/**
 * The quick-jump chips inside the Custom Date Range Studio.
 *
 * Each one sets the "from" date to somewhere a reader often means:
 * the start of this month, a fortnight back, a month back, or the
 * start of the year. The "to" date is left alone - these are about
 * where the range starts, not where it ends.
 */
const quickJumps = (today = new Date()) => [
  {
    key: 'month_start',
    labelKey: 'date_range.jump_month_start',
    date: () => toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
  },
  {
    key: '14d',
    labelKey: 'date_range.jump_14d',
    date: () => {
      const d = new Date(today);
      d.setDate(d.getDate() - 13);
      return toIsoDate(d);
    },
  },
  {
    key: '30d',
    labelKey: 'date_range.jump_30d',
    date: () => {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return toIsoDate(d);
    },
  },
  {
    key: 'year_start',
    labelKey: 'date_range.jump_year_start',
    date: () => toIsoDate(new Date(today.getFullYear(), 0, 1)),
  },
];

/**
 * @param {object} props
 * @param {object} props.value            The choice: { preset, start, end }
 * @param {Function} props.onChange        Called with the new choice
 * @param {Function} [props.onApply]       Called when a range is applied
 */
export default function DateRangeFilterBar({ value, onChange, onApply }) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(value?.start || '');
  const [draftEnd, setDraftEnd] = useState(value?.end || '');

  const choice = value || { preset: 'month' };
  const label = rangeLabel(choice);

  const choosePreset = (preset) => {
    if (preset === 'custom') {
      // The dates the reader has already chosen are kept, so that
      // opening the custom range and closing it again does not lose
      // what they typed. The very first time, there is nothing to
      // keep, so the studio opens with this month so far rather than
      // two empty boxes.
      const resolved = resolveRange(choice);
      const start = choice.start || resolved.start || toIsoDate(new Date());
      const end = choice.end || resolved.end || toIsoDate(new Date());
      setDraftStart(start);
      setDraftEnd(end);
      setOpen(true);
      onChange?.({ ...choice, preset: 'custom', start, end });
      return;
    }

    setOpen(false);
    onChange?.({ ...choice, preset });
    onApply?.();
  };

  const applyCustom = () => {
    let start = draftStart;
    let end = draftEnd;
    // A range typed back to front is still the range between the two
    // dates, not an empty one.
    if (start && end && start > end) {
      [start, end] = [end, start];
    }
    onChange?.({ ...choice, preset: 'custom', start, end });
    setOpen(false);
    onApply?.();
  };

  const resetCustom = () => {
    const today = toIsoDate(new Date());
    const monthStart = toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    setDraftStart(monthStart);
    setDraftEnd(today);
  };

  const applyJump = (jump) => {
    setDraftStart(jump.date());
  };

  return (
    <div className="date-range-bar" data-testid="date-range-bar">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          {t('date_range.period_label')}
        </span>

        {/* The shortcuts. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_PRESETS.map((preset) => {
            const isActive = choice.preset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={(e) => {
                  // The snappy spring on the pill that was just
                  // chosen, so the choice is felt as well as seen.
                  popOnSelect(e.currentTarget);
                  choosePreset(preset.key);
                }}
                aria-pressed={isActive}
                data-testid={`date-preset-${preset.key}`}
                className={`botanical-pill motion-x-spring !py-1.5 !text-xs inline-flex items-center gap-1 ${isActive ? 'is-active font-semibold shadow-sm' : ''}`}
                style={isActive ? { background: '#52796F', borderColor: '#52796F', color: '#fff' } : undefined}
              >
                {preset.key === 'custom' ? (
                  <>
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    {t(`date_range.preset_${preset.key}`)}
                  </>
                ) : t(`date_range.preset_${preset.key}`)}
              </button>
            );
          })}
        </div>

        {/* The live active-range badge. It names exactly what every
            card on the page is answering about, in the reader's own
            words rather than the raw preset key. */}
        {choice.preset === 'custom' && !isCustomRangeComplete(choice) ? null : (
          <span
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAE6DF] dark:bg-slate-700/60 text-[#2F4842] dark:text-slate-200"
            data-testid="date-range-label"
          >
            <span className="opacity-70">{t('date_range.active_label')}</span>
            {label}
          </span>
        )}
      </div>

      {/* The Custom Date Range Studio. It expands the instant the
          reader clicks "Rentang Tanggal Kustom", with both dates
          already filled in, so there is always a working range to
          adjust rather than two empty boxes. */}
      {open ? (
        <div
          className="mt-3 p-4 rounded-2xl border border-[#EAE6DF] dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-sm motion-studio-panel"
          data-testid="custom-range-panel"
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('date_range.from')}
              </span>
              <input
                type="date"
                value={draftStart}
                max={draftEnd || undefined}
                onChange={(e) => setDraftStart(e.target.value)}
                data-testid="date-range-start"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('date_range.to')}
              </span>
              <input
                type="date"
                value={draftEnd}
                min={draftStart || undefined}
                onChange={(e) => setDraftEnd(e.target.value)}
                data-testid="date-range-end"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>

            <button
              type="button"
              onClick={applyCustom}
              disabled={!isCustomRangeComplete({ preset: 'custom', start: draftStart, end: draftEnd })}
              data-testid="date-range-apply"
              className="motion-x-spring bg-[#2F4842] text-[#FAF9F6] rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('date_range.apply')}
            </button>

            <button
              type="button"
              onClick={resetCustom}
              data-testid="date-range-reset"
              className="motion-x-spring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE6DF] dark:border-slate-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('date_range.reset')}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={t('date_range.close')}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* The quick-jump chips. Each one sets where the range
              starts, so a reader who means "the last fortnight" does
              not have to count backwards on a calendar by hand. */}
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            {quickJumps().map((jump) => (
              <button
                key={jump.key}
                type="button"
                onClick={() => applyJump(jump)}
                data-testid={`date-range-jump-${jump.key}`}
                className="motion-x-spring px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4F1EA] dark:bg-slate-700/60 text-[#52796F] dark:text-slate-300 hover:bg-[#EAE6DF] dark:hover:bg-slate-600 transition-colors"
              >
                {t(jump.labelKey)}
              </button>
            ))}
          </div>

          {!isCustomRangeComplete({ preset: 'custom', start: draftStart, end: draftEnd }) ? (
            <p className="w-full text-xs text-amber-600 dark:text-amber-400 mt-2">
              {t('date_range.needs_both_dates')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { DateRangeFilterBar };
