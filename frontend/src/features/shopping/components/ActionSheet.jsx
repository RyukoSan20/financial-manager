import { useEffect, useRef, useState } from 'react';
import { idr, wibDate } from '../constants';

const digits = (v) => String(v ?? '').replace(/\D/g, '');

const TITLES = {
  purchase: (item) => `Catat pembelian: ${item.name}`,
  shipped: () => 'Item sedang dikirim',
  received: () => 'Item sudah diterima',
};

function initialForm(mode, item) {
  if (mode === 'purchase') {
    return {
      amount: digits(item.amount),
      accountId: '',
      categoryId: item.category_id ?? '',
      date: wibDate(),
      markReceived: false,
    };
  }
  if (mode === 'shipped') return { trackingNumber: item.tracking_number ?? '', courier: item.courier ?? '' };
  return { rating: item.rating ?? 0, notes: item.notes ?? '' };
}

function buildBody(mode, form) {
  if (mode === 'purchase') {
    const amount = Number(digits(form.amount));
    if (!amount) return { error: 'Isi jumlah yang dibayar.' };
    if (!form.accountId) return { error: 'Pilih akun yang dipakai untuk membayar.' };
    return {
      body: {
        amount,
        account_id: Number(form.accountId),
        category_id: form.categoryId ? Number(form.categoryId) : null,
        date: form.date || null,
        mark_received: form.markReceived,
      },
    };
  }
  if (mode === 'shipped') {
    return { body: { tracking_number: form.trackingNumber.trim() || null, courier: form.courier.trim() || null } };
  }
  return { body: { rating: form.rating || null, notes: form.notes.trim() || null } };
}

/**
 * Lembar isian untuk tiga aksi: catat pembelian, tandai dikirim, tandai diterima.
 * onSubmit(body) harus mengembalikan { ok: true } atau { ok: false, error }.
 * Tombol dikunci selama proses (cegah tap ganda); server juga idempoten untuk pembelian.
 */
export default function ActionSheet({ mode, item, accounts, categories, refsError, onSubmit, onClose }) {
  const [form, setForm] = useState(() => initialForm(mode, item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus(); // hanya saat lembar dibuka, supaya fokus tidak melompat saat mengetik
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const built = buildBody(mode, form);
    if (built.error) return setError(built.error);
    setBusy(true);
    setError(null);
    const res = await onSubmit(built.body);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
    } // jika sukses, induk menutup lembar ini
  };

  const noAccounts = mode === 'purchase' && accounts.length === 0;

  return (
    <div className="sb-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="sb-sheet" role="dialog" aria-modal="true" aria-labelledby="sb-sheet-title" onSubmit={submit}>
        <h2 id="sb-sheet-title">{TITLES[mode](item)}</h2>

        {mode === 'purchase' && (
          <>
            <label className="sb-field">
              <span>Jumlah yang dibayar (Rp)</span>
              <input
                ref={firstField}
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: digits(e.target.value) }))}
                placeholder="45000"
              />
              <small>{form.amount ? idr(Number(form.amount)) : 'Total termasuk ongkir dan biaya lain.'}</small>
            </label>

            <label className="sb-field">
              <span>Dibayar dari akun</span>
              <select value={form.accountId} onChange={set('accountId')}>
                <option value="">Pilih akun</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {noAccounts && (
                <small className="sb-warn">
                  {refsError || 'Belum ada akun. Tambahkan akun di menu Akun, lalu kembali ke sini.'}
                </small>
              )}
            </label>

            <label className="sb-field">
              <span>Kategori</span>
              <select value={form.categoryId} onChange={set('categoryId')}>
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="sb-field">
              <span>Tanggal bayar</span>
              <input type="date" value={form.date} max={wibDate()} onChange={set('date')} />
            </label>

            <label className="sb-check">
              <input type="checkbox" checked={form.markReceived} onChange={set('markReceived')} />
              <span>Barang langsung diterima (beli di toko)</span>
            </label>
          </>
        )}

        {mode === 'shipped' && (
          <>
            <label className="sb-field">
              <span>Nomor resi</span>
              <input ref={firstField} value={form.trackingNumber} maxLength={64} onChange={set('trackingNumber')} />
            </label>
            <label className="sb-field">
              <span>Kurir</span>
              <input value={form.courier} maxLength={32} onChange={set('courier')} placeholder="JNE, SiCepat, Gojek…" />
            </label>
          </>
        )}

        {mode === 'received' && (
          <>
            <div className="sb-field">
              <span id="sb-rating-label">Rating</span>
              <div className="sb-rating" role="radiogroup" aria-labelledby="sb-rating-label">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    ref={n === 1 ? firstField : null}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} dari 5`}
                    className={n <= form.rating ? 'is-on' : ''}
                    onClick={() => setForm((f) => ({ ...f, rating: f.rating === n ? 0 : n }))}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <label className="sb-field">
              <span>Catatan (mis. disimpan di mana)</span>
              <textarea rows={3} maxLength={500} value={form.notes} onChange={set('notes')} />
            </label>
          </>
        )}

        {error && (
          <p className="sb-error" role="alert">
            {error}
          </p>
        )}

        <div className="sb-actions">
          <button type="button" className="sb-btn" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="sb-btn sb-btn-primary" disabled={busy || noAccounts}>
            {busy ? 'Menyimpan…' : mode === 'purchase' ? 'Catat pembelian' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}
