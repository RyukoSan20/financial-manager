/**
 * Taking a receipt out of the reader's own records.
 *
 * Sometimes the receipt is already in the transactions: it was
 * scanned last week, it is sitting in the list, and typing it out a
 * second time for a bill is a waste of an evening.
 *
 * This is the list of those receipts. The reader picks one, and the
 * bill is filled in with the lines of it, the tax of it and the
 * discount of it, so that the bill adds up to what was paid.
 *
 * Nothing is written down here. The list is read, and the reader
 * chooses; the bill is made when they say so.
 */

import { useCallback, useEffect, useState } from 'react';
import { listImportableTransactions, importTransaction } from '../../services/splitApi';
import { batch9 } from '../../i18n/keys_batch9';

export default function RecentTransactionImporter({
  onImported,
  language = 'id',
}) {
  const K = batch9[language]?.split || batch9.id.split;

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  /**
   * The recent receipts, read.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await listImportableTransactions(20);
      setRows(Array.isArray(found) ? found : []);
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    load();
    return undefined;
  }, [open, load]);

  /**
   * Bring one of them into the bill.
   */
  const take = useCallback(
    async (transactionId) => {
      setBusy(transactionId);
      setError(null);
      try {
        const payload = await importTransaction(transactionId);
        if (onImported) onImported(payload);
        setOpen(false);
      } catch (err) {
        setError(err);
      } finally {
        setBusy(null);
      }
    },
    [onImported],
  );

  return (
    <section className="split-importer">
      <button
        type="button"
        className="split-importer__toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {K.import_recent}
      </button>

      {open && (
        <div className="split-importer__panel">
          <p className="split-importer__hint">{K.import_recent_hint}</p>

          {loading && <p>{K.import_recent_loading}</p>}

          {!loading && error && (
            <p className="split-importer__error" role="alert">
              {error.message || K.import_recent_failed}
            </p>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="split-importer__empty">{K.import_recent_empty}</p>
          )}

          {rows.length > 0 && (
            <ul className="split-importer__list">
              {rows.map((row) => (
                <li key={row.transaction_id} className="split-importer__row">
                  <div className="split-importer__row-text">
                    <span className="split-importer__row-name">
                      {row.merchant_name || row.description || `#${row.transaction_id}`}
                    </span>
                    <span className="split-importer__row-meta">
                      {row.date ? `${K.import_recent_date}: ${row.date}` : ''}
                      {` · ${K.import_recent_lines.replace('%s', (row.items || []).length)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="split-importer__use"
                    onClick={() => take(row.transaction_id)}
                    disabled={busy === row.transaction_id}
                  >
                    {K.import_recent_use}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export { RecentTransactionImporter };
