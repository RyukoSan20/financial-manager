/**
 * The question, and the answer to it.
 *
 * The application used `window.confirm` for the questions that matter:
 * deleting a budget, deleting a goal, deleting an account, signing
 * out of Gmail. That dialog is drawn by the browser, not by the
 * application, so it looks as though it belongs to a different
 * program. It cannot be styled, it cannot be translated, on a phone
 * it can sit behind the page, and it freezes the whole application
 * while it is there.
 *
 * This is the same question, asked by the application.
 *
 * The state lives here, apart from the drawing, so that the rule can
 * be read and tested on its own.
 *
 * The bug this file exists to prevent: the answer was given to the
 * waiting promise, but the piece of state that decides whether the
 * question is on the screen was never cleared. The reader deleted a
 * transaction, the transaction was gone, and the question was still
 * on the screen asking whether to delete it. Every delete in the
 * application ended that way.
 *
 * So the two are tied together here. Answering the question clears
 * the state and settles the promise, and there is no way to do one
 * without the other.
 */

/** The event the application listens for to put the question on screen. */
export const REQUEST_EVENT = 'app-confirm-request';

/** The event the application listens for to take the question away. */
export const ANSWERED_EVENT = 'app-confirm-answered';

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
      pendingRequest = null;
      openRequest = null;
      // The old question is taken off the screen as well, or it
      // would stay there behind the new one.
      emitAnswered(false);
    }
    pendingResolve = resolve;
    pendingRequest = options;
    openRequest = options;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: options }));
    }
  });
};

/**
 * Answer the question that is on screen.
 *
 * Both halves happen together: the promise is settled and the state
 * that holds the question is cleared. The screen is taken down by the
 * ANSWERED event, which the provider listens for.
 */
export const settle = (answer) => {
  const resolve = pendingResolve;
  pendingResolve = null;
  pendingRequest = null;
  openRequest = null;
  resolve?.(answer);
  emitAnswered(answer);
};

/**
 * Tell the application that the question has been answered.
 */
function emitAnswered(answer) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ANSWERED_EVENT, { detail: answer }));
}

/** The question that is on screen, if there is one. */
export const currentRequest = () => openRequest;

/** Whether a question is waiting for an answer. */
export const isOpen = () => openRequest !== null;
