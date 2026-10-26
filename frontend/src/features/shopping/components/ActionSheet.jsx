import { useEffect, useRef, useState } from 'react';
import { idr, wibDate } from '../constants';
import { useTranslation } from '../../../i18n';
import { batch2, fill } from '../../../i18n/keys_batch2';
import { categoryName } from '../../../utils/categoryName';

const digits = (v) => String(v ?? '').replace(/\D/g, '');

const TITLE_KEYS = {
  purchase: 'title_purchase',
  shipped: 'title_shipped',
  received: 'title_received',
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

function buildBody(mode, form, K) {
  if (mode === 'purchase') {
    const amount = Number(digits(form.amount));
    if (!amount) return { error: K.error_amount };
    if (!form.accountId) return { error: K.error_account };
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
  const { language } = useTranslation();
  const K = batch2[language]?.action_sheet || batch2.id.action_sheet;
  const title = fill(K[TITLE_KEYS[mode]], item?.name || '');

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
    const built = buildBody(mode, form, K);
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
        <h2 id="sb-sheet-title">{title}</h2>

        {mode === 'purchase' && (
          <>
            <label className="sb-field">
              <span>{K.amount_label}</span>
              <input
                ref={firstField}
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: digits(e.target.value) }))}
                placeholder="45000"
              />
              <small>{form.amount ? idr(Number(form.amount)) : K.amount_hint}</small>
            </label>

            <label className="sb-field">
              <span>{K.paid_from}</span>
              <select value={form.accountId} onChange={set('accountId')}>
                <option value="">{K.select_account}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {noAccounts && (
                <small className="sb-warn">
                  {refsError || K.no_accounts}
                </small>
              )}
            </label>

            <label className="sb-field">
              <span>{K.category}</span>
              <select value={form.categoryId} onChange={set('categoryId')}>
                <option value="">{K.no_category}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryName(c, language)}
                  </option>
                ))}
              </select>
            </label>

            <label className="sb-field">
              <span>{K.pay_date}</span>
              <input type="date" value={form.date} max={wibDate()} onChange={set('date')} />
            </label>

            <label className="sb-check">
              <input type="checkbox" checked={form.markReceived} onChange={set('markReceived')} />
              <span>{K.mark_received}</span>
            </label>
          </>
        )}

        {mode === 'shipped' && (
          <>
            <label className="sb-field">
              <span>{K.tracking_number}</span>
              <input ref={firstField} value={form.trackingNumber} maxLength={64} onChange={set('trackingNumber')} />
            </label>
            <label className="sb-field">
              <span>{K.courier}</span>
              <input value={form.courier} maxLength={32} onChange={set('courier')} placeholder={K.ph_courier} />
            </label>
          </>
        )}

        {mode === 'received' && (
          <>
            <div className="sb-field">
              <span id="sb-rating-label">{K.rating}</span>
              <div className="sb-rating" role="radiogroup" aria-labelledby="sb-rating-label">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    ref={n === 1 ? firstField : null}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={fill(K.rating_aria, n)}
                    className={n <= form.rating ? 'is-on' : ''}
                    onClick={() => setForm((f) => ({ ...f, rating: f.rating === n ? 0 : n }))}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <label className="sb-field">
              <span>{K.notes_label}</span>
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
            {K.cancel}
          </button>
          <button type="submit" className="sb-btn sb-btn-primary" disabled={busy || noAccounts}>
            {busy ? K.saving : mode === 'purchase' ? K.record_purchase : K.save}
          </button>
        </div>
      </form>
    </div>
  );
}
