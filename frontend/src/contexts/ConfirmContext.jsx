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
 *
 * The rule that holds the question up - that answering it takes it off
 * the screen as well as settling the promise - lives in
 * `confirmState.js`, apart from the drawing, so that it can be read and
 * tested on its own.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  ask,
  settle,
  REQUEST_EVENT,
  ANSWERED_EVENT,
} from './confirmState';

const ConfirmContext = createContext(null);

/**
 * The provider.
 *
 * It holds one question at a time.
 */
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);

  // The provider listens for the question, because `ask` is a plain
  // function and cannot reach into the component tree.
  //
  // It also listens for the answer. Without that, the promise was
  // settled and the question stayed on the screen, so a reader who
  // deleted anything was left looking at a question that had already
  // been answered.
  useEffect(() => {
    const handler = (event) => setRequest(event.detail);
    const answered = () => setRequest(null);
    window.addEventListener(REQUEST_EVENT, handler);
    window.addEventListener(ANSWERED_EVENT, answered);
    return () => {
      window.removeEventListener(REQUEST_EVENT, handler);
      window.removeEventListener(ANSWERED_EVENT, answered);
    };
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

export { ask, settle, REQUEST_EVENT, ANSWERED_EVENT };
export default ConfirmProvider;
