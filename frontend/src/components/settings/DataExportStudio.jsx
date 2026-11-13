/**
 * The export studio.
 *
 * The settings screen used to offer two buttons: "Ekspor JSON" and
 * "Ekspor CSV". Neither said what was in the file. The CSV was seven
 * columns and the reader had never asked for half of them, and there
 * was no way to say "just October" or "just my spending" or "just the
 * rows I made at that shop".
 *
 * So this is a screen where the export is configured before it is
 * downloaded:
 *
 * - the dates, as presets or as two boxes the reader fills in;
 * - the kinds of transaction, as pills;
 * - the account, as pills;
 * - the columns, as a checklist.
 *
 * And the answer is shown as it is chosen - how many transactions
 * match, what they add up to, and what the first few rows look like -
 * so the reader can see whether they chose what they meant to choose
 * before the file is made.
 *
 * The preview and the download are made by the same server code, so
 * the preview is the file, not an idea of it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileJson, FileSpreadsheet, X, Calendar } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { api } from '../../services/api';
import { EXPORT_PRESETS, exportRange } from '../../utils/dateRange';
import { CountUpNumber } from '../ui/CountUpNumber';

/**
 * The kinds of transaction the reader can choose between.
 *
 * A transfer is one choice, not two: the reader wants "the transfers",
 * not the ones that leave and the ones that arrive.
 */
export const TYPE_CHOICES = [
  { key: 'all', labelKey: 'export.type_all' },
  { key: 'expense', labelKey: 'export.type_expense' },
  { key: 'income', labelKey: 'export.type_income' },
  { key: 'transfer', labelKey: 'export.type_transfer' },
];

/**
 * The columns, as the server names them.
 *
 * These are the same nine the server knows about, so the checklist
 * and the file cannot disagree about what a column is.
 */
export const EXPORT_COLUMNS = [
  { key: 'date', labelKey: 'export.col_date' },
  { key: 'type', labelKey: 'export.col_type' },
  { key: 'category', labelKey: 'export.col_category' },
  { key: 'description', labelKey: 'export.col_description' },
  { key: 'amount', labelKey: 'export.col_amount' },
  { key: 'account', labelKey: 'export.col_account' },
  { key: 'items', labelKey: 'export.col_items' },
  { key: 'tax', labelKey: 'export.col_tax' },
  { key: 'location', labelKey: 'export.col_location' },
];

const ALL_COLUMN_KEYS = EXPORT_COLUMNS.map((column) => column.key);

/**
 * The query parameters of a choice, for the server.
 */
export function exportParams({
  preset = 'month',
  custom = {},
  types = [],
  accountId = null,
  columns = ALL_COLUMN_KEYS,
}) {
  const range = exportRange(preset, custom);
  const params = {};

  if (range.start) params.start_date = range.start;
  if (range.end) params.end_date = range.end;

  const wanted = (types || []).filter((type) => type && type !== 'all');
  if (wanted.length && wanted.length < TYPE_CHOICES.length - 1) {
    params.types = wanted.join(',');
  }

  if (accountId) params.account_id = String(accountId);

  const chosen = (columns || []).filter(Boolean);
  if (chosen.length && chosen.length < ALL_COLUMN_KEYS.length) {
    params.columns = chosen.join(',');
  }

  return params;
}

/**
 * @param {object} props
 * @param {Function} [props.onClose]  Called when the studio is put away
 */
export default function DataExportStudio({ onClose }) {
  const { t } = useTranslation();

  const [preset, setPreset] = useState('month');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [types, setTypes] = useState(['all']);
  const [accountId, setAccountId] = useState(null);
  const [columns, setColumns] = useState([...ALL_COLUMN_KEYS]);

  const [accounts, setAccounts] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // The accounts the reader has, so they can pick one.
  useEffect(() => {
    let alive = true;
    api.get('/accounts/')
      .then((res) => { if (alive) setAccounts(res || []); })
      .catch(() => { if (alive) setAccounts([]); });
    return () => { alive = false; };
  }, []);

  const params = useMemo(
    () => exportParams({ preset, custom, types, accountId, columns }),
    [preset, custom, types, accountId, columns],
  );

  // The preview, refreshed when the choice changes.
  //
  // The preview is what the reader checks their choice against, so it
  // has to be the current choice and not the last one. There is a
  // moment of nothing between the two, and that is honest - better
  // than showing the old count against the new choice.
  const refresh = useCallback(() => {
    let alive = true;
    setLoading(true);
    api.request(`/data/export/studio${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`)
      .then((res) => {
        if (!alive) return;
        setPreview(res);
        setError(null);
      })
      .catch(() => {
        if (!alive) return;
        setPreview(null);
        setError('preview_failed');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleType = (key) => {
    setTypes((current) => {
      if (key === 'all') return ['all'];
      const without = current.filter((type) => type !== 'all');
      if (without.includes(key)) {
        const next = without.filter((type) => type !== key);
        return next.length ? next : ['all'];
      }
      return [...without, key];
    });
  };

  const toggleColumn = (key) => {
    setColumns((current) => {
      if (current.includes(key)) {
        const next = current.filter((column) => column !== key);
        // At least one column is always on. A file with no columns is
        // a file with nothing in it.
        return next.length ? next : current;
      }
      return ALL_COLUMN_KEYS.filter((column) => current.includes(column) || column === key);
    });
  };

  const downloadCsv = async () => {
    // The file is fetched with the token and handed to the browser as
    // a blob, because a plain link cannot carry the token and would
    // answer 401.
    const blob = await api.download(api.exportStudioCsvUrl(params));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finmanager_transaksi.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadJson = async () => {
    const res = await api.exportStudioJson(params);
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finmanager_transaksi.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rupiah = useMemo(
    () => new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
    }),
    [],
  );

  const previewRows = preview?.preview || [];

  return (
    <div className="data-export-studio space-y-4" data-testid="data-export-studio">
      {/* The dates. */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('export.range_title')}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {EXPORT_PRESETS.map((option) => {
            const isActive = preset === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setPreset(option.key)}
                aria-pressed={isActive}
                data-testid={`export-preset-${option.key}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-[background-color,color] duration-150 ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {option.key === 'custom' ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    {t(`export.preset_${option.key}`)}
                  </span>
                ) : t(`export.preset_${option.key}`)}
              </button>
            );
          })}
        </div>

        {preset === 'custom' ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('export.from')}
              </span>
              <input
                type="date"
                value={custom.start}
                onChange={(e) => setCustom((current) => ({ ...current, start: e.target.value }))}
                data-testid="export-start"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {t('export.to')}
              </span>
              <input
                type="date"
                value={custom.end}
                onChange={(e) => setCustom((current) => ({ ...current, end: e.target.value }))}
                data-testid="export-end"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
          </div>
        ) : null}
      </section>

      {/* The kinds and the account. */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('export.type_title')}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {TYPE_CHOICES.map((choice) => {
              const isActive = types.includes(choice.key);
              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => toggleType(choice.key)}
                  aria-pressed={isActive}
                  data-testid={`export-type-${choice.key}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-[background-color,color] duration-150 ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {t(choice.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('export.account_title')}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setAccountId(null)}
              aria-pressed={accountId === null}
              data-testid="export-account-all"
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-[background-color,color] duration-150 ${
                accountId === null
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t('export.account_all')}
            </button>
            {accounts.map((account) => {
              const isActive = accountId === account.id;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountId(account.id)}
                  aria-pressed={isActive}
                  data-testid={`export-account-${account.id}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-[background-color,color] duration-150 ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {account.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* The columns. */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('export.columns_title')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXPORT_COLUMNS.map((column) => {
            const isOn = columns.includes(column.key);
            return (
              <label
                key={column.key}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggleColumn(column.key)}
                  data-testid={`export-column-${column.key}`}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-200">
                  {t(column.labelKey)}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* The answer. */}
      <section className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-white/10">
        <p className="text-sm text-gray-700 dark:text-gray-200" data-testid="export-summary">
          {loading && !preview ? (
            t('export.counting')
          ) : error ? (
            t('export.preview_failed')
          ) : (
            <>
              {t('export.found', '', { count: preview?.count ?? 0 })}{' '}
              {t('export.total_expense_label')}{' '}
              <strong className="tabular-nums">
                <CountUpNumber
                  value={preview?.total || 0}
                  format={(n) => rupiah.format(n)}
                />
              </strong>
              {' · '}
              {t('export.total_income_label')}{' '}
              <strong className="tabular-nums">
                <CountUpNumber
                  value={preview?.total_income || 0}
                  format={(n) => rupiah.format(n)}
                />
              </strong>
            </>
          )}
        </p>

        {/* The preview. */}
        {previewRows.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs" data-testid="export-preview">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  {(preview?.column_labels || []).map((label) => (
                    <th key={label} className="py-1 pr-3 whitespace-nowrap font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={index} className="border-t border-gray-200 dark:border-white/10">
                    {(preview?.columns || []).map((key) => (
                      <td key={key} className="py-1 pr-3 whitespace-nowrap text-gray-700 dark:text-gray-200">
                        {String(row[key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* The downloads. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!preview || preview.count === 0}
          data-testid="export-download-csv"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          {t('export.download_csv')}
        </button>

        <button
          type="button"
          onClick={downloadJson}
          disabled={!preview || preview.count === 0}
          data-testid="export-download-json"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 dark:bg-gray-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-900 transition-colors"
        >
          <FileJson className="w-4 h-4" aria-hidden="true" />
          {t('export.download_json')}
        </button>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            {t('export.close')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { DataExportStudio };
