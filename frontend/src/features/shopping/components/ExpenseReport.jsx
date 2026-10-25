import { useEffect, useState } from 'react';
import { idr, monthStart, wibDate } from '../constants';
import { shoppingApi } from '../api';
import { useTranslation } from '../../../i18n';
import { batch2, fill } from '../../../i18n/keys_batch2';

function Breakdown({ title, rows, emptyText }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <section className="sb-breakdown">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="sb-empty">{emptyText}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.label}>
              <div className="sb-breakdown-row">
                <span>{r.label}</span>
                <span>
                  {idr(r.total)} ({r.count}x)
                </span>
              </div>
              <div className="sb-bar" aria-hidden="true">
                <div style={{ width: `${(r.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ExpenseReport() {
  const { language } = useTranslation();
  const K = batch2[language]?.expense_report || batch2.id.expense_report;

  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(wibDate());
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const invalid = !start || !end || end < start;

  useEffect(() => {
    if (invalid) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    shoppingApi
      .report({ start, end })
      .then((data) => !cancelled && setState({ status: 'ready', data, error: null }))
      .catch((e) =>
        !cancelled &&
        setState((s) => ({ ...s, status: 'error', data: null, error: e?.message || K.load_error })),
      );
    return () => {
      cancelled = true;
    };
  }, [start, end, invalid, K]);

  const { status, data, error } = state;

  return (
    <div className="sb-report">
      <div className="sb-report-range">
        <label className="sb-field">
          <span>{K.from_date}</span>
          <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="sb-field">
          <span>{K.to_date}</span>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      {invalid && <p className="sb-warn">{K.invalid_range}</p>}
      {!invalid && status === 'error' && (
        <p className="sb-error" role="alert">
          {error}
        </p>
      )}

      {!invalid && status !== 'error' && data && (
        <div aria-busy={status === 'loading'}>
          <p className="sb-total">{idr(data.total)}</p>
          <p className="sb-total-sub">
            {fill(K.summary, data.count, idr(data.average))}
          </p>
          <Breakdown title={K.by_category} rows={data.by_category} emptyText={K.empty} />
          <Breakdown title={K.by_store} rows={data.by_marketplace} emptyText={K.empty} />
        </div>
      )}
      {!invalid && status === 'loading' && !data && <p className="sb-empty">{K.loading}</p>}
    </div>
  );
}
