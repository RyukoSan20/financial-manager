import { useEffect, useState } from 'react';
import { idr, monthStart, wibDate } from '../constants';
import { shoppingApi } from '../api';

function Breakdown({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <section className="sb-breakdown">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="sb-empty">Belum ada pembelian pada rentang ini.</p>
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
        setState({ status: 'error', data: null, error: e?.message || 'Laporan gagal dimuat. Coba ubah rentang tanggal atau muat ulang.' }),
      );
    return () => {
      cancelled = true;
    };
  }, [start, end, invalid]);

  const { status, data, error } = state;

  return (
    <div className="sb-report">
      <div className="sb-report-range">
        <label className="sb-field">
          <span>Dari tanggal</span>
          <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="sb-field">
          <span>Sampai tanggal</span>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      {invalid && <p className="sb-warn">Tanggal akhir harus sama dengan atau setelah tanggal awal.</p>}
      {!invalid && status === 'error' && (
        <p className="sb-error" role="alert">
          {error}
        </p>
      )}

      {!invalid && status !== 'error' && data && (
        <div aria-busy={status === 'loading'}>
          <p className="sb-total">{idr(data.total)}</p>
          <p className="sb-total-sub">
            {data.count} pembelian, rata-rata {idr(data.average)}
          </p>
          <Breakdown title="Per kategori" rows={data.by_category} />
          <Breakdown title="Per toko" rows={data.by_marketplace} />
        </div>
      )}
      {!invalid && status === 'loading' && !data && <p className="sb-empty">Memuat laporan…</p>}
    </div>
  );
}
