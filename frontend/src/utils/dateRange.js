/**
 * The dates a report is about.
 *
 * A reader who wants to know where their money went in October should
 * be able to say "October" and have every card on the page answer
 * about October. Not the last six months, not this month - October.
 *
 * So there is one place that turns what the reader chose into the two
 * dates that everything else is then asked with.
 *
 * The presets are the shortcuts, and the custom range is the answer
 * to "neither of those is what I meant". A reader who picks a range
 * by hand gets exactly those two dates, and every card on the page
 * is about them.
 *
 * There is no React in here, so it can be checked by a script.
 */

/**
 * The presets, in the order they are offered.
 *
 * The key is what the server and the reader's saved choice use. The
 * label is what the screen shows, and the screen asks for it.
 */
export const DATE_PRESETS = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
  { key: '3m', label: '3 Bulan' },
  { key: '6m', label: '6 Bulan' },
  { key: '1y', label: '1 Tahun' },
  { key: 'custom', label: 'Rentang Tanggal Kustom' },
];

/**
 * The date as it is written in a query string.
 */
export function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The first day of the month, and the last.
 */
export function monthBounds(today) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start, end };
}

/**
 * The dates a preset means.
 *
 * A preset that is not known falls back to the month, because a
 * screen that shows a preset the code does not know about would be
 * asking a question nothing answers.
 */
export function rangeForPreset(preset, today = new Date()) {
  switch (preset) {
    case 'today':
      return { start: new Date(today), end: new Date(today) };

    case '7d': {
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }

    case 'month': {
      const { start, end } = monthBounds(today);
      return { start, end };
    }

    case '3m': {
      const end = new Date(today);
      const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      return { start, end };
    }

    case '6m': {
      const end = new Date(today);
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return { start, end };
    }

    case '1y': {
      const end = new Date(today);
      const start = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      return { start, end };
    }

    default: {
      const { start, end } = monthBounds(today);
      return { start, end };
    }
  }
}

/**
 * The two dates of a choice, as strings.
 *
 * A custom range is whatever the reader typed. A preset is what the
 * preset means. A range that runs backwards is put the right way
 * round, because a reader who typed the two dates in the wrong order
 * meant the range between them, not an empty one.
 */
export function resolveRange(choice, today = new Date()) {
  if (!choice) {
    const { start, end } = rangeForPreset('month', today);
    return { start: toIsoDate(start), end: toIsoDate(end), preset: 'month' };
  }

  if (choice.preset === 'custom') {
    let start = choice.start || null;
    let end = choice.end || null;

    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }

    return { start, end, preset: 'custom' };
  }

  const { start, end } = rangeForPreset(choice.preset, today);
  return { start: toIsoDate(start), end: toIsoDate(end), preset: choice.preset };
}

/**
 * The query parameters of a choice, for the server.
 *
 * A custom range that is not complete - the reader has typed one of
 * the two dates - is not sent at all, because half a range is not a
 * range. The screen says so instead.
 */
export function rangeParams(choice, today = new Date()) {
  const { start, end, preset } = resolveRange(choice, today);

  if (preset === 'custom' && (!start || !end)) {
    return {};
  }

  const params = {};
  if (start) params.start_date = start;
  if (end) params.end_date = end;
  return params;
}

/**
 * Is a custom range ready to be applied?
 */
export function isCustomRangeComplete(choice) {
  if (!choice || choice.preset !== 'custom') return false;
  return Boolean(choice.start && choice.end);
}

/**
 * The name of the range, for the screen.
 */
export function rangeLabel(choice, today = new Date()) {
  if (!choice) return 'Bulan Ini';

  if (choice.preset === 'custom') {
    if (!choice.start || !choice.end) return 'Rentang Tanggal Kustom';
    return `${choice.start} s/d ${choice.end}`;
  }

  const preset = DATE_PRESETS.find((p) => p.key === choice.preset);
  return preset ? preset.label : 'Bulan Ini';
}

/**
 * The export presets - the same idea, for the export screen.
 *
 * "Semua Waktu" is the one that has no dates at all.
 */
export const EXPORT_PRESETS = [
  { key: 'month', label: 'Bulan Ini' },
  { key: 'lastMonth', label: 'Bulan Lalu' },
  { key: '3m', label: '3 Bulan Terakhir' },
  { key: 'year', label: 'Tahun Ini' },
  { key: 'all', label: 'Semua Waktu' },
  { key: 'custom', label: 'Rentang Tanggal Kustom' },
];

/**
 * The dates of an export preset.
 *
 * "Semua Waktu" has no dates, which is not the same as an empty
 * range - it is the whole of the reader's history.
 */
export function exportRange(preset, custom = {}, today = new Date()) {
  if (preset === 'all') return { start: null, end: null };

  if (preset === 'custom') {
    let start = custom.start || null;
    let end = custom.end || null;
    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }
    return { start, end };
  }

  if (preset === 'month') {
    const { start, end } = monthBounds(today);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  if (preset === 'lastMonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  if (preset === '3m') {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { start: toIsoDate(start), end: toIsoDate(today) };
  }

  if (preset === 'year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: toIsoDate(start), end: toIsoDate(today) };
  }

  return { start: null, end: null };
}

export default {
  DATE_PRESETS,
  EXPORT_PRESETS,
  toIsoDate,
  monthBounds,
  rangeForPreset,
  resolveRange,
  rangeParams,
  isCustomRangeComplete,
  rangeLabel,
  exportRange,
};
