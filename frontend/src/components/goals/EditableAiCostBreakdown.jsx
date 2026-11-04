/**
 * The cost breakdown the AI worked out, and the reader's corrections
 * to it.
 *
 * The model reads a goal and guesses what the money is made of. It is
 * usually close, and it is sometimes wrong. So the guess is not the
 * end of it: every line can be edited, a line can be added, a line
 * can be removed, and the total at the bottom follows along.
 *
 * The component can be handed the lines directly, or a goal id and
 * left to read them itself. When it is left to read them it also
 * writes back what the reader changed, so the guess in the database
 * becomes the reader's own answer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../utils/format';
import api from '../../services/api';

const emptyLines = [];

/**
 * The rows can come from the model as `{name, amount}` or from the
 * editor as `{description, price}`. Both are read here, and both are
 * written as `{description, price}`.
 */
export function toRows(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((line) => line && typeof line === 'object')
    .map((line) => {
      const description = line.description ?? line.name ?? '';
      const raw = line.price ?? line.amount ?? line.total_price ?? 0;
      const price = Number(String(raw).replace(/[^0-9.-]/g, '')) || 0;
      return { description: String(description), price };
    });
}

/**
 * The sum of the rows. A row with a price that cannot be read counts
 * as nothing rather than breaking the total.
 */
export function totalOf(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => {
    const price = Number(row?.price);
    if (!Number.isFinite(price)) return sum;
    return sum + price;
  }, 0);
}

/**
 * The lines as the server wants them.
 */
export function toPayload(rows, before = emptyLines) {
  return rows.map((row, index) => {
    const old = before[index];
    const unchanged =
      old &&
      String(old.name ?? '') === String(row.description ?? '') &&
      Number(old.total_price ?? 0) === Number(row.price ?? 0);

    return {
      name: String(row.description ?? '').trim(),
      quantity: 1,
      unit_price: Number(row.price ?? 0) || 0,
      total_price: Number(row.price ?? 0) || 0,
      kind: 'expense',
      source: unchanged && old.source ? old.source : 'user',
      is_estimated: unchanged ? Boolean(old.is_estimated) : false,
    };
  });
}

export default function EditableAiCostBreakdown({
  goalId = null,
  lines = null,
  onChange,
  currency = 'IDR',
  title = null,
  className = '',
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(() => toRows(lines));
  const [open, setOpen] = useState(() => toRows(lines).length > 0);
  const [estimated, setEstimated] = useState(false);
  const [loaded, setLoaded] = useState(lines !== null);
  const original = useRef(emptyLines);

  // The lines are read on their own, so the section can be dropped
  // into a list without the list having to carry them.
  useEffect(() => {
    if (lines !== null) {
      setRows(toRows(lines));
      original.current = Array.isArray(lines) ? lines : emptyLines;
      setEstimated(original.current.some((line) => line?.is_estimated));
      setLoaded(true);
      return undefined;
    }

    if (!goalId) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.breakdown.read('goal', goalId);
        if (cancelled) return;
        const read = Array.isArray(res?.lines) ? res.lines : [];
        original.current = read;
        setRows(toRows(read));
        setEstimated(read.some((line) => line?.is_estimated));
      } catch {
        // A goal without a breakdown is not broken. The section stays
        // empty and the reader can fill it in.
        if (!cancelled) {
          original.current = emptyLines;
          setRows(emptyLines);
          setEstimated(false);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [goalId, lines]);

  const total = useMemo(() => totalOf(rows), [rows]);

  // The rows are published: the reader sees them at once, and the
  // guess in the database is replaced by the reader's own answer.
  const publish = async (next) => {
    setRows(next);
    onChange?.(next);

    if (lines !== null || !goalId) return;

    try {
      const res = await api.breakdown.write(
        'goal',
        goalId,
        toPayload(next, original.current),
        true
      );
      const saved = Array.isArray(res?.lines) ? res.lines : toPayload(next, original.current);
      original.current = saved;
      setEstimated(saved.some((line) => line?.is_estimated));
    } catch (err) {
      console.error('Failed to save the cost breakdown:', err);
    }
  };

  const updateRow = (index, patch) => {
    publish(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    publish([...rows, { description: '', price: 0 }]);
  };

  const removeRow = (index) => {
    publish(rows.filter((_, i) => i !== index));
  };

  const heading = title || t('goals.ai_cost_title');

  // The lines are read before the section is drawn, so the page does
  // not flash an empty box while the answer is on its way.
  if (!loaded) return null;

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-left pressable dark:border-gray-700 dark:bg-gray-800"
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{heading}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {formatCurrency(total, currency)}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </span>
      </button>

      {open && (
        <div className="px-3 py-3">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t('goals.ai_cost_hint')}</p>

          {estimated && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t('goals.ai_cost_estimate_note')}</span>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="py-2 text-xs text-gray-500 dark:text-gray-400">{t('goals.ai_cost_empty')}</p>
          ) : (
            <ul className="mb-2 space-y-2">
              {rows.map((row, index) => (
                <li key={index} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label
                      className="block text-xs text-gray-500 dark:text-gray-400"
                      htmlFor={`ai-cost-description-${index}`}
                    >
                      {t('goals.ai_cost_description')}
                    </label>
                    <input
                      id={`ai-cost-description-${index}`}
                      type="text"
                      value={row.description}
                      placeholder={t('goals.ai_cost_description_placeholder')}
                      onChange={(event) => updateRow(index, { description: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <div className="w-28 shrink-0">
                    <label
                      className="block text-xs text-gray-500 dark:text-gray-400"
                      htmlFor={`ai-cost-price-${index}`}
                    >
                      {t('goals.ai_cost_price')}
                    </label>
                    <input
                      id={`ai-cost-price-${index}`}
                      type="text"
                      inputMode="numeric"
                      value={row.price === 0 ? '' : String(row.price)}
                      placeholder={t('goals.ai_cost_price_placeholder')}
                      onChange={(event) => {
                        const price = Number(String(event.target.value).replace(/[^0-9.-]/g, '')) || 0;
                        updateRow(index, { price });
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    title={t('goals.ai_cost_remove_row')}
                    className="mb-0.5 shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 pressable dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 pressable dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('goals.ai_cost_add_row')}
            </button>

            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('goals.ai_cost_total')}: {formatCurrency(total, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { EditableAiCostBreakdown };
