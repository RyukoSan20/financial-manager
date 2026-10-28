/**
 * A dialog that asks before something is done.
 *
 * The application used `window.confirm` for the questions that matter:
 * deleting a budget, deleting a goal, deleting an account. That
 * dialog is drawn by the browser, not by the application, so it looks
 * like it belongs to a different program. It cannot be styled, it
 * cannot be translated, and on a phone it can sit behind the page.
 *
 * This is the same question, asked by the application:
 *
 * - it says what is about to happen, in the reader's own language;
 * - the button that does it is named after the action, so there is no
 *   "OK" to interpret;
 * - the way out is the way in, so the reader is not trapped;
 * - Escape closes it, and the backdrop closes it.
 *
 * The words come from the caller, because "delete this budget" and
 * "sign this out" are different sentences. The keys are looked up
 * through the same `t` the rest of the application uses, so a missing
 * translation shows the fallback rather than a raw key.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  titleKey,
  message,
  messageKey,
  confirmLabel,
  confirmLabelKey,
  cancelLabel,
  cancelLabelKey,
  tone = 'warning',
}) {
  const { t } = useTranslation();
  const panelRef = useRef(null);

  // Escape closes the dialog, and so does the backdrop. The reader is
  // never trapped in a question they cannot get out of.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  // The panel takes the focus when the dialog opens, so a reader who
  // is using the keyboard lands inside it rather than behind it.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const titleText = title || t(titleKey || 'common.confirm_title', 'Are you sure?');
  const messageText = message || t(messageKey || 'common.confirm_message', '');
  const confirmText = confirmLabel || t(confirmLabelKey || 'common.confirm', 'Confirm');
  const cancelText = cancelLabel || t(cancelLabelKey || 'common.cancel', 'Cancel');

  const isDanger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onCancel}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          role="alertdialog"
          aria-modal="true"
          aria-label={titleText}
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md outline-none"
        >
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDanger
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {titleText}
                </h3>
                {messageText && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {messageText}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-transform duration-150 hover:bg-gray-50 active:scale-95 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-150 active:scale-95 ${
                  isDanger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
