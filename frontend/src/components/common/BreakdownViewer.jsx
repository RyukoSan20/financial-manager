/**
 * The lines inside a financial record.
 *
 * A transaction, a budget, a recurring rule, a goal and a debt can all
 * carry a list of lines, and this component draws that list. The same
 * shape is used everywhere, so the user learns it once.
 *
 * The lines may have come from the model. When they have, they are
 * marked as an estimate, because the user is the one who knows what
 * was actually bought.
 */
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

const money = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

const CATEGORY_LABELS = {
  transport: 'Transportasi',
  accommodation: 'Penginapan',
  food: 'Makanan',
  drink: 'Minuman',
  documents: 'Dokumen',
  insurance: 'Asuransi',
  shopping: 'Belanja',
  health: 'Kesehatan',
  education: 'Pendidikan',
  housing: 'Perumahan',
  household: 'Kebutuhan rumah',
  personal_care: 'Perawatan diri',
  snack: 'Makanan ringan',
  medicine: 'Obat',
  stationery: 'Alat tulis',
  clothing: 'Pakaian',
  electronics: 'Elektronik',
  other: 'Lainnya',
};

export const BreakdownViewer = ({
  parentType,
  parentId,
  lines: initialLines,
  total: initialTotal,
  title = null,
  editable = true,
  onChanged,
  compact = false,
}) => {
  const { language } = useTranslation();
  const K = batch3[language]?.breakdown;
  const [lines, setLines] = useState(initialLines || []);
  const [expanded, setExpanded] = useState(!compact);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', total_price: '' });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(Boolean(initialLines));

  const total =
    initialTotal ??
    lines.reduce(
      (sum, line) => sum + (line.is_discount ? -1 : 1) * Number(line.total_price || 0),
      0
    );

  // The lines are fetched on their own, so the component can be dropped
  // into a list without the list having to carry them.
  useEffect(() => {
    if (initialLines) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.breakdown.read(parentType, parentId);
        if (cancelled) return;
        setLines(res.lines || []);
      } catch {
        // No breakdown for this record. That is not an error worth
        // showing, the section simply stays empty.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [parentType, parentId, initialLines]);

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await api.breakdown.read(parentType, parentId);
      setLines(res.lines || []);
      setError('');
      onChanged?.(res);
    } catch (err) {
      setError('Gagal memuat rincian');
    } finally {
      setBusy(false);
    }
  };

  const removeLine = async (lineId) => {
    setBusy(true);
    try {
      const res = await api.breakdown.removeLine(parentType, parentId, lineId);
      setLines(res.lines || []);
      onChanged?.(res);
    } catch (err) {
      setError('Gagal menghapus baris');
    } finally {
      setBusy(false);
    }
  };

  const addLine = async (e) => {
    e.preventDefault();
    const amount = Number(String(draft.total_price).replace(/[^\d]/g, ''));
    if (!draft.name.trim() || !amount) {
      setError('Nama dan nominal harus diisi');
      return;
    }
    setBusy(true);
    try {
      const res = await api.breakdown.addLine(parentType, parentId, {
        name: draft.name.trim(),
        quantity: 1,
        unit_price: amount,
        total_price: amount,
        kind: 'expense',
        source: 'user',
        is_estimated: false,
      });
      setLines(res.lines || []);
      setDraft({ name: '', total_price: '' });
      setAdding(false);
      setError('');
      onChanged?.(res);
    } catch (err) {
      setError('Gagal menambah baris');
    } finally {
      setBusy(false);
    }
  };

  const hasEstimate = lines.some((line) => line.is_estimated);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 text-left dark:border-gray-700 dark:bg-gray-800"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          <Package className="h-4 w-4" />
          {title || K.detail}
          {lines.length > 0 && (
            <span className="rounded-full bg-gray-200 px-1.5 text-xs font-normal text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {lines.length}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {money(total)}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </span>
      </button>

      {expanded && (
        <div>
          {hasEstimate && (
            <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {K.ai_estimate_note}
              </span>
            </div>
          )}

          {lines.length === 0 && !adding && (
            <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              {K.empty}
            </p>
          )}

          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.map((line) => (
              <li key={line.id} className="flex items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${
                      line.is_discount
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {line.name}
                    {line.is_discount && ' (diskon)'}
                  </p>
                  {(line.category || line.notes) && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {line.category && CATEGORY_LABELS[line.category]}
                      {line.category && line.notes ? ' · ' : ''}
                      {line.notes}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {money(line.total_price)}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={busy}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950"
                    title={K.remove_line}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {editable && adding && (
            <form
              onSubmit={addLine}
              className="flex flex-col gap-2 border-t border-gray-200 p-3 dark:border-gray-700"
            >
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Nama"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="text"
                inputMode="numeric"
                value={draft.total_price}
                onChange={(e) => setDraft({ ...draft, total_price: e.target.value })}
                placeholder="Nominal"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {K.save}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300"
                >
                  {K.cancel}
                </button>
              </div>
            </form>
          )}

          {editable && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-1.5 border-t border-gray-200 px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:border-gray-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
            >
              <Plus className="h-3.5 w-3.5" />
              {K.add_line}
            </button>
          )}

          {error && (
            <p className="flex items-center gap-1.5 border-t border-red-100 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BreakdownViewer;
