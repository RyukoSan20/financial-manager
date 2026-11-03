import { useMemo, useState } from 'react';
import { STAGES, STAGE_LABEL, idr, safeUrl } from '../constants';
import { categoryName } from '../../../utils/categoryName';
import { useTranslation } from '../../../i18n';
import { batch3 } from '../../../i18n/keys_batch3';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { buildFlag } from '../../../utils/featureFlags';
import { BOARD_COLUMNS, gatherColumns, stageFor, dropAction } from '../boardColumns';

const META = Object.fromEntries(STAGES.map((s) => [s.key, s]));

// The four columns are a new shape for the board, so they are behind
// a switch of their own. When the switch is off, the board is the
// seven stages it always was.
const FOUR_COLUMNS = buildFlag('SHOPPING_FOUR_COLUMNS');

// The labels of the four columns, read from the words of the
// application rather than written again here.
const COLUMN_WORDS = {
  wishlist: ['Incaran', 'Baru ditambahkan, belum direncanakan'],
  saving: ['Ditabung', 'Sedang ditabung, menunggu diskon'],
  ready: ['Siap Checkout', 'Sudah diputuskan, tinggal dibeli'],
  bought: ['Sudah Dibeli', 'Sudah dibayar dan dicatat sebagai pengeluaran'],
};

function Stars({ value }) {
  if (!value) return null;
  return (
    <span className="sb-stars" aria-label={`Rating ${value} dari 5`}>
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

function Card({ item, onDragStart, onDragEnd, onPick }) {
  const { language } = useTranslation();
  const K = batch3[language]?.kanban;
  const link = safeUrl(item.product_url);
  return (
    <article className="sb-card" draggable onDragStart={(e) => onDragStart(e, item)} onDragEnd={onDragEnd}>
      <div className="sb-card-top">
        <h4 className="sb-card-name">{item.name}</h4>
        <strong className="sb-card-amount">{idr(item.amount)}</strong>
      </div>

      <div className="sb-card-meta">
        <span>
          {item.quantity} × {idr(item.price)}
        </span>
        {item.marketplace && <span>{item.marketplace}</span>}
        {item.category_name && <span className="sb-chip">{categoryName(item.category_name, language)}</span>}
        {item.tracking_number && (
          <span>
            Resi {item.courier ? `${item.courier} ` : ''}
            {item.tracking_number}
          </span>
        )}
        <Stars value={item.rating} />
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer">
            {K.open_product}
          </a>
        )}
      </div>

      {item.allowed_next.length > 0 && (
        <select
          className="sb-move"
          aria-label={`Pindahkan ${item.name}`}
          value=""
          onChange={(e) => onPick(item, e.target.value)}
        >
          <option value="" disabled>
            {K.move_to}
          </option>
          {item.allowed_next.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      )}
    </article>
  );
}

/**
 * Papan kanban. Komponen ini hanya menentukan *apa yang perlu ditanyakan* sebelum pindah:
 *  - ke "Dipesan"           -> onPurchase (ada uang keluar, butuh akun & jumlah)
 *  - ke "Dikirim/Diterima"  -> onDetails  (resi / rating)
 *  - lainnya                -> onMove langsung
 * Aturan boleh/tidaknya pindah datang dari server (item.allowed_next).
 */
export default function KanbanBoard({ columns, onMove, onPurchase, onDetails }) {
  const { language } = useTranslation();
  const K = batch3[language]?.kanban;
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);

  // The item that is waiting to be cancelled, and whether the reader
  // has said yes. The question is asked by the application, not by
  // the browser, so it can say what is about to happen in the
  // reader's own language.
  const [pendingCancel, setPendingCancel] = useState(null);

  const dragging = useMemo(
    () => columns.flatMap((c) => c.items).find((i) => i.id === dragId) || null,
    [columns, dragId],
  );

  const request = (item, target) => {
    if (!target || target === item.stage || !item.allowed_next.includes(target)) return;
    if (target === 'ordered') return onPurchase(item);
    if (target === 'shipped' || target === 'received') return onDetails(item, target);
    if (target === 'cancelled' && item.transaction_id) {
      // The question is asked by the dialog below, and the move
      // happens when the reader says yes.
      setPendingCancel({ item, target });
      return;
    }
    return onMove(item, target);
  };

  // The reader said yes: the item is cancelled and the recorded
  // spending is undone.
  const confirmCancel = () => {
    if (pendingCancel) onMove(pendingCancel.item, pendingCancel.target);
    setPendingCancel(null);
  };

  // The board that is drawn: the four columns, or the seven stages.
  const drawn = FOUR_COLUMNS
    ? gatherColumns(columns).map((col) => ({
        ...col,
        label: COLUMN_WORDS[col.key]?.[0] || col.key,
        hint: COLUMN_WORDS[col.key]?.[1] || '',
      }))
    : columns;

  return (
    <div className="sb-board">
      {drawn.map((col) => {
        // In the four-column board a card is offered the columns it
        // may go to. In the seven-stage board it is offered the
        // stages the server says it may go to.
        const accepts = dragging
          ? FOUR_COLUMNS
            ? dropAction(dragging, col.key) !== null
            : dragging.allowed_next.includes(col.key)
          : false;
        const blocked = dragging && !accepts && dragging.stage !== col.key;
        const cls = ['sb-col', overKey === col.key && 'is-over', blocked && 'is-blocked'].filter(Boolean).join(' ');

        return (
          <section
            key={col.key}
            className={cls}
            aria-label={col.label || META[col.key]?.label || col.key}
            onDragOver={(e) => {
              if (accepts) {
                e.preventDefault();
                setOverKey(col.key);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOverKey(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOverKey(null);
              if (dragging) {
                // In the four-column board the card is put in the
                // first stage of the column it was dropped into.
                const target = FOUR_COLUMNS ? stageFor(col.key) : col.key;
                if (target) request(dragging, target);
              }
              setDragId(null);
            }}
          >
            <header className="sb-col-head" title={col.hint || META[col.key]?.hint || ''}>
              <h3>{col.label || META[col.key]?.label || col.key}</h3>
              <span className="sb-count">{col.count}</span>
            </header>
            {col.total > 0 && <p className="sb-col-total">{idr(col.total)}</p>}

            <div className="sb-col-body">
              {col.items.length === 0 ? (
                <p className="sb-empty">{K.empty}</p>
              ) : (
                col.items.map((item) => (
                  <Card
                    key={item.id}
                    item={item}
                    onPick={request}
                    onDragStart={(e, it) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(it.id)); // Firefox butuh ini
                      setDragId(it.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverKey(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
        titleKey="kanban.cancel_removes_expense_title"
        messageKey="kanban.cancel_removes_expense_message"
        confirmLabelKey="kanban.cancel_removes_expense_action"
        cancelLabelKey="common.cancel"
        tone="danger"
      />
    </div>
  );
}
