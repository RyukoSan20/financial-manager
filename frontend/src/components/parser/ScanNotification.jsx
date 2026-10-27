/**
 * The scan notification.
 *
 * A background scan does not interrupt anything. When it finishes, a
 * small bar appears at the bottom of the screen. The user can tap it, or
 * drag it upwards, to open the result.
 *
 * The drag is a real drag: the sheet follows the finger, and letting go
 * either opens it or snaps it back, depending on how far it was pulled.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronUp,
  Receipt,
  QrCode,
  Bell,
} from 'lucide-react';
import { scanManager } from '../../services/scanManager';
import { useTranslation } from '../../i18n';
import { batch3 } from '../../i18n/keys_batch3';

/** How far the sheet has to be pulled up before it opens. */
const OPEN_THRESHOLD = 64;

const kindIcon = (kind) =>
  kind === 'qr' ? QrCode : kind === 'receipt' ? Receipt : Bell;

export const ScanNotification = () => {
  const { language } = useTranslation();
  const K = batch3[language]?.scan_notification || {};
  const [jobs, setJobs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  // The collapsed bar is dragged upwards to open, the open sheet is
  // dragged downwards to close. Both directions therefore need their own
  // distance and their own release behaviour.
  const [barDragY, setBarDragY] = useState(0);
  const [barDragging, setBarDragging] = useState(false);

  const dragStart = useRef(0);
  const barDragStart = useRef(0);
  const dragDistanceRef = useRef(0);
  // The pointer move handler has to know whether a drag is in progress
  // right now. React state is only applied after the render, so the very
  // first move would be ignored. A ref is read synchronously, which is
  // what a drag needs.
  const barDraggingRef = useRef(false);
  const draggingRef = useRef(false);
  const barDistanceRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = scanManager.subscribe(setJobs);
    scanManager.restore();
    return unsubscribe;
  }, []);

  // The job the sheet is showing.
  const active = expanded ? jobs.find((j) => j.jobId === expanded) : null;

  // The finished job that has not been looked at yet.
  const pending = jobs.find(
    (job) => job.status === 'completed' && !job.seen
  );
  const running = jobs.find((job) => job.status === 'running' || job.status === 'queued');

  // The bar that is shown when nothing is expanded.
  const bar = pending || running;
  if (!bar && !active) return null;

  const openJob = (job) => {
    setExpanded(job.jobId);
    setDragY(0);
    setDragging(false);
    scanManager.markSeen(job.jobId);
  };

  const closeSheet = () => {
    setExpanded(null);
    setDragY(0);
    setDragging(false);
  };

  const handlePointerDown = (event) => {
    dragStart.current = event.clientY;
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;
    // The open sheet is dragged downwards to dismiss it. The sheet
    // follows the finger, and it never goes up past its resting place.
    const delta = event.clientY - dragStart.current;
    const distance = Math.max(0, delta);
    dragDistanceRef.current = distance;
    setDragY(distance);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const distance = dragDistanceRef.current;
    setDragY(0);
    if (distance >= OPEN_THRESHOLD) {
      // Pulled far enough down: the sheet goes away.
      closeSheet();
    }
  };

  // --- The collapsed bar: pull it up to open ----------------------------

  const handleBarPointerDown = (event) => {
    barDragStart.current = event.clientY;
    barDraggingRef.current = true;
    setBarDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleBarPointerMove = (event) => {
    if (!barDraggingRef.current) return;
    const delta = barDragStart.current - event.clientY;
    // Only upward movement counts.
    const distance = Math.max(0, delta);
    barDistanceRef.current = distance;
    setBarDragY(distance);
  };

  const handleBarPointerUp = () => {
    if (!barDraggingRef.current) return;
    barDraggingRef.current = false;
    setBarDragging(false);
    // The distance is read from the ref as well, because the state value
    // is one render behind the last pointer move.
    const distance = barDistanceRef.current;
    setBarDragY(0);
    if (distance >= OPEN_THRESHOLD) {
      openJob(bar);
    }
  };

  const title = (job) => {
    if (job.status === 'running' || job.status === 'queued') {
      return 'Memproses scan...';
    }
    if (job.status === 'failed') return 'Scan gagal';
    if (job.status === 'cancelled') return 'Scan dibatalkan';
    return 'Scan selesai';
  };

  const subtitle = (job) => {
    if (job.status === 'running' || job.status === 'queued') {
      return job.message || 'Tunggu sebentar...';
    }
    if (job.status === 'failed') {
      return job.error || 'Tidak bisa membaca gambar';
    }
    const result = job.result || {};
    const merchant = result.merchant_name;
    const total = result.total_amount;
    if (merchant && total) {
      return `${merchant} · Rp${Number(total).toLocaleString('id-ID')}`;
    }
    if (merchant) return merchant;
    return job.message || 'Ketuk untuk melihat hasil';
  };

  // --- The collapsed bar -------------------------------------------------
  if (!active) {
    const Icon = kindIcon(bar.kind);
    const isRunning = bar.status === 'running' || bar.status === 'queued';
    const isFailed = bar.status === 'failed';

    return (
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none"
        style={{
          transform: `translateY(${-barDragY}px)`,
          transition: barDragging ? 'none' : 'transform 200ms ease-out',
        }}
      >
        <button
          type="button"
          onClick={() => openJob(bar)}
          onPointerDown={handleBarPointerDown}
          onPointerMove={handleBarPointerMove}
          onPointerUp={handleBarPointerUp}
          onPointerCancel={handleBarPointerUp}
          className="pointer-events-auto touch-none w-full max-w-md mx-auto flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              isFailed
                ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                : isRunning
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300'
            }`}
          >
            {isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isFailed ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title(bar)}
            </span>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {subtitle(bar)}
            </span>
          </span>

          {isRunning && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {bar.progress || 0}%
            </span>
          )}
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" />
        </button>
      </div>
    );
  }

  // --- The expanded sheet ------------------------------------------------
  const result = active.result || {};
  const breakdown = result.breakdown || {};
  const items = breakdown.items || result.items || [];
  const Icon = kindIcon(active.kind);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={K.close}
        onClick={closeSheet}
        className="absolute inset-0 bg-black/40"
      />

      <div
        className="relative w-full max-w-md rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl pb-6"
        style={{
          transform: `translateY(${dragY || 0}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {/* The handle is the drag target. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
        >
          <div className="h-1.5 w-11 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        <div className="px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {title(active)}
              </h3>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {subtitle(active)}
              </p>
            </div>
            <button
              type="button"
              onClick={closeSheet}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              aria-label={K.close_scan}
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {/* The itemised breakdown. */}
          {items.length > 0 && (
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td className="px-3 py-2">
                        <span className="block font-medium text-gray-800 dark:text-gray-200">
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {item.quantity} x Rp
                            {Number(item.price_per_unit || 0).toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          item.is_discount
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {item.is_discount ? '-' : ''}Rp
                        {Number(item.total_price || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 dark:border-gray-700">
                  {breakdown.discount_total > 0 && (
                    <tr>
                      <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {K.discount}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-medium text-red-600 dark:text-red-400">
                        -Rp{Number(breakdown.discount_total).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                      {K.total}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      Rp{Number(breakdown.total || result.total_amount || 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* What the scanner learned. */}
          {result.learning && result.learning.new_products?.length > 0 && (
            <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
              <span className="font-semibold">{K.learned_products} </span>
              {result.learning.new_products.join(', ')}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeSheet}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {K.close}
            </button>
            <button
              type="button"
              onClick={() => {
                closeSheet();
                // Go to the transaction the scan made, when it made one.
                // The transaction waits for the review, so it is found
                // there rather than in the history.
                if (result.transaction_id) {
                  navigate(`/transactions?highlight=${result.transaction_id}`);
                } else {
                  navigate('/transactions');
                }
              }}
              className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {K.view_transaction}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanNotification;
