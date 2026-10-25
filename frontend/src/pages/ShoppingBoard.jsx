import { useCallback, useEffect, useState } from 'react';
import '../features/shopping/shopping-board.css';
import { shoppingApi } from '../features/shopping/api';
import { toList, wibMonth } from '../features/shopping/constants';
import { useShoppingBoard } from '../features/shopping/useShoppingBoard';
import ActionSheet from '../features/shopping/components/ActionSheet';
import ExpenseReport from '../features/shopping/components/ExpenseReport';
import KanbanBoard from '../features/shopping/components/KanbanBoard';
import { useTranslation } from '../i18n';

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Halaman papan belanja. Daftarkan di App.jsx, mis.:
 *   <Route path="/shopping/board" element={<ProtectedRoute><ShoppingBoard /></ProtectedRoute>} />
 */
export default function ShoppingBoard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('board');
  const [month, setMonth] = useState('');
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 300);

  const { columns, status, error, reload, moveItem, purchaseItem } = useShoppingBoard({ month, q });

  // Akun & kategori dimuat mandiri — tidak bergantung pada bootstrap NLP.
  const [refs, setRefs] = useState({ accounts: [], categories: [], error: null });
  useEffect(() => {
    let off = false;
    Promise.all([shoppingApi.accounts(), shoppingApi.categories()])
      .then(([a, c]) => {
        if (off) return;
        setRefs({
          accounts: toList(a),
          categories: toList(c).filter((x) => x.type === 'expense'),
          error: null,
        });
      })
      .catch((e) => {
        if (!off) setRefs((r) => ({ ...r, error: e?.message || t('shopping_board.refs_error') }));
      });
    return () => {
      off = true;
    };
  }, [t]);

  const [sheet, setSheet] = useState(null); // { mode: 'purchase' | 'shipped' | 'received', item }
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const closeSheet = useCallback(() => setSheet(null), []);

  const submitSheet = async (body) => {
    const { mode, item } = sheet;
    if (mode === 'purchase') {
      try {
        const res = await purchaseItem(item.id, body);
        setToast(res.already_purchased ? t('shopping_board.already_purchased') : t('shopping_board.purchase_recorded'));
        setSheet(null);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e?.message || t('shopping_board.purchase_failed') };
      }
    }
    const res = await moveItem(item, mode, body);
    if (res.ok) setSheet(null);
    return res;
  };

  const isEmpty = status === 'ready' && columns.every((c) => c.items.length === 0);

  return (
    <main className="sb-page">
      <header className="sb-header">
        <h1>{t('nav.shopping')}</h1>
        <div className="sb-tabs" role="tablist" aria-label={t('shopping_board.view_label')}>
          {[
            ['board', t('shopping_board.board_tab')],
            ['report', t('shopping_board.report_tab')],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'is-active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'report' && <ExpenseReport />}

      {tab === 'board' && (
        <>
          <div className="sb-filters">
            <label className="sb-field">
              <span>{t('shopping_board.search_item')}</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
            </label>
            <label className="sb-field">
              <span>{t('shopping_board.purchase_month')}</span>
              <div className="sb-inline">
                <input type="month" value={month} max={wibMonth()} onChange={(e) => setMonth(e.target.value)} />
                {month && (
                  <button className="sb-btn" onClick={() => setMonth('')}>
                    {t('shopping_board.all_months')}
                  </button>
                )}
              </div>
            </label>
          </div>

          {status === 'loading' && <p className="sb-empty" role="status">{t('shopping_board.loading')}</p>}

          {status === 'error' && (
            <div className="sb-error" role="alert">
              <p>{error}</p>
              <button className="sb-btn" onClick={reload}>
                {t('shopping_board.retry')}
              </button>
            </div>
          )}

          {isEmpty && (
            <p className="sb-empty">{t('shopping_board.empty')}</p>
          )}

          {status === 'ready' && (
            <KanbanBoard
              columns={columns}
              onMove={moveItem}
              onPurchase={(item) => setSheet({ mode: 'purchase', item })}
              onDetails={(item, mode) => setSheet({ mode, item })}
            />
          )}
        </>
      )}

      {sheet && (
        <ActionSheet
          key={`${sheet.mode}-${sheet.item.id}`}
          mode={sheet.mode}
          item={sheet.item}
          accounts={refs.accounts}
          categories={refs.categories}
          refsError={refs.error}
          onSubmit={submitSheet}
          onClose={closeSheet}
        />
      )}

      {toast && (
        <div className="sb-toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
