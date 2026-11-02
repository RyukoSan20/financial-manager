/**
 * The question.
 *
 * The application used `window.confirm` for the questions that matter:
 * deleting a budget, deleting a goal, deleting an account, signing
 * out of Gmail. That dialog is drawn by the browser, not by the
 * application, so it looks as though it belongs to a different
 * program. It cannot be styled, it cannot be translated, on a phone
 * it can sit behind the page, and it freezes the whole application
 * while it is there.
 *
 * This is the same question, asked by the application:
 *
 * - it says what is about to happen, in the reader's own language;
 * - the button that does it is named after the action, so there is no
 *   "OK" to interpret;
 * - the way out is the way in, so the reader is not trapped;
 * - Escape closes it, and the backdrop closes it.
 *
 * It is used the way the browser's own was used, which is the point:
 *
 *   if (!(await ask({ message: t('budgets.delete_confirm') }))) return;
 *
 * The answer is a promise, so the code after the question waits for
 * the reader rather than running past it.
 *
 * `ask` is deliberately a plain function rather than a hook. The pages
 * that ask a question are ordinary functions that may live in a
 * callback, and a hook cannot be called from one.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * The one question that is on screen, and the promise waiting for its
 * answer.
 *
 * These live outside the component so that `ask` can be a plain
 * function. The component fills them in when it mounts.
 */
let pendingResolve = null;
let pendingRequest = null;
let openRequest = null;

/**
 * Ask the reader a question.
 *
 * @param {object} options
 * @param {string} options.message       What is about to happen.
 * @param {string} [options.title]
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {'warning'|'danger'} [options.tone]
 * @returns {Promise<boolean>} Whether the reader said yes.
 */
export const ask = (options = {}) => {
  return new Promise((resolve) => {
    // A question still open is answered with "no", so its promise is
    // never left hanging. The reader cannot see two questions at
    // once, so they cannot have meant to answer the first one after
    // asking the second.
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }
    pendingResolve = resolve;
    pendingRequest = options;
    openRequest = options;
    // The provider listens for this, so it can put the question on
    // the screen.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-confirm-request', { detail: options }));
    }
  });
};

/**
 * Answer the question that is on screen.
 */
const settle = (answer) => {
  const resolve = pendingResolve;
  pendingResolve = null;
  pendingRequest = null;
  openRequest = null;
  resolve?.(answer);
};

/**
 * The provider.
 *
 * It holds one question at a time.
 */
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);

  // The provider listens for the question, because `ask` is a plain
  // function and cannot reach into the component tree.
  useEffect(() => {
    const handler = (event) => setRequest(event.detail);
    window.addEventListener('app-confirm-request', handler);
    return () => window.removeEventListener('app-confirm-request', handler);
  }, []);

  const onConfirm = useCallback(() => settle(true), []);
  const onCancel = useCallback(() => settle(false), []);

  const value = useMemo(() => ({ ask }), []);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(request)}
        onConfirm={onConfirm}
        onCancel={onCancel}
        title={request?.title}
        titleKey={request?.titleKey}
        message={request?.message}
        messageKey={request?.messageKey}
        confirmLabel={request?.confirmLabel}
        confirmLabelKey={request?.confirmLabelKey}
        cancelLabel={request?.cancelLabel}
        cancelLabelKey={request?.cancelLabelKey}
        tone={request?.tone || 'warning'}
      />
    </ConfirmContext.Provider>
  );
};

/**
 * The question, from inside the provider.
 */
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  // Outside the provider the plain function still works, because it
  // is the plain function that does the work.
  return context?.ask || ask;
};

export { openRequest, pendingRequest };
export default ConfirmProvider;
