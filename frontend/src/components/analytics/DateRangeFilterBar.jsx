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
 * When a range is chosen by hand, the bar stays open until it is
 * applied - otherwise the numbers would change under the reader
 * while they were still typing the second date.
 */

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import {
  DATE_PRESETS,
  isCustomRangeComplete,
  rangeLabel,
  resolveRange,
} from '../../utils/dateRange';

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
      setOpen(true);
      // The dates the reader has already chosen are kept, so that
      // opening the custom range and closing it again does not lose
      // what they typed.
      const resolved = resolveRange(choice);
      setDraftStart(choice.start || resolved.start || '');
      setDraftEnd(choice.end || resolved.end || '');
      onChange?.({ ...choice, preset: 'custom' });
      return;
    }

    setOpen(false);
    onChange?.({ ...choice, preset });
    onApply?.();
  };

  const applyCustom = () => {
    onChange?.({ ...choice, preset: 'custom', start: draftStart, end: draftEnd });
    setOpen(false);
    onApply?.();
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
                onClick={() => choosePreset(preset.key)}
                aria-pressed={isActive}
                data-testid={`date-preset-${preset.key}`}
                className={`botanical-pill !py-1.5 !text-xs ${isActive ? 'is-active' : ''}`}
              >
                {preset.key === 'custom' ? `📅 ${t(`date_range.preset_${preset.key}`)}` : t(`date_range.preset_${preset.key}`)}
              </button>
            );
          })}
        </div>

        {/* What the numbers are about. When the custom range is chosen
            but not yet applied, the label would just repeat the custom
            pill's own words on the far right - so it is dropped until a
            real range is in force. */}
        {choice.preset === 'custom' && !isCustomRangeComplete(choice) ? null : (
          <span
            className="ml-auto text-xs text-gray-500 dark:text-gray-400"
            data-testid="date-range-label"
          >
            {label}
          </span>
        )}
      </div>

      {/* The two dates. */}
      {open ? (
        <div
          className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-white/10 flex flex-wrap items-end gap-3"
          data-testid="custom-range-panel"
        >
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
            className="hh-button !rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('date_range.apply')}
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label={t('date_range.close')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          {!isCustomRangeComplete({ preset: 'custom', start: draftStart, end: draftEnd }) ? (
            <p className="w-full text-xs text-amber-600 dark:text-amber-400">
              {t('date_range.needs_both_dates')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { DateRangeFilterBar };
