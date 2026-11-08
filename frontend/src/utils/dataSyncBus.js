/**
 * The bus that says "something changed".
 *
 * The application has six pages that show the reader's money, and
 * they were six separate conversations with the server. A reader who
 * recorded a transaction on the dashboard went to the transactions
 * list and saw the old one. They went to their profile and saw the
 * old balance. They went to the budget and saw the old spending.
 *
 * Each page fetched on mount, and nothing told a page that was
 * already open that the world had moved.
 *
 * So there is one bus now. Anything that writes says what it wrote
 * - "transaction", "budget", "goal" - and anything that shows the
 * consequence of that write listens for it.
 *
 * It is deliberately small. There is no store, no cache and no
 * request to cancel. A page that hears the news refetches, and the
 * server is the only truth there is.
 *
 * The name of the thing that changed is a string, because the pages
 * that care are the ones that know what they show. A page that shows
 * the balance and the transactions listens for "transaction"; a page
 * that shows the budgets listens for "budget".
 */

import { useEffect, useRef } from 'react';

/**
 * The name of the event. One event, carrying the name of what
 * changed.
 */
const EVENT_NAME = 'finmanager:data-mutated';

/**
 * Say what changed.
 *
 * Call this after the write has been confirmed by the server, never
 * before. A page that refetches on the strength of a write that then
 * failed shows a number that is not true, and then corrects itself,
 * and the reader saw both.
 *
 * `detail` is the name of the thing: "transaction", "budget",
 * "goal", "account".
 */
export function emitDataMutated(detail = 'transaction', extra = {}) {
  if (typeof window === 'undefined') return;

  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { kind: detail, ...extra },
      })
    );
  } catch (err) {
    // A browser that has no CustomEvent is not a browser this
    // application runs in, but a failed announcement must never
    // break the write that has already happened.
    if (import.meta.env?.DEV) {
      console.warn('The data change could not be announced:', err);
    }
  }
}

/**
 * Listen for what changed.
 *
 * The callback is called with the kind of thing that changed, so a
 * page can listen for the one it cares about and ignore the rest.
 *
 * The callback is held in a ref, so a page that passes a new
 * function on every render is not re-subscribed on every render.
 */
export function useOnDataMutated(callback, kinds = null) {
  const callbackRef = useRef(callback);
  const kindsRef = useRef(kinds);

  callbackRef.current = callback;
  kindsRef.current = kinds;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onMutated = (event) => {
      const kind = event?.detail?.kind;
      const wanted = kindsRef.current;

      // No kinds means "tell me about everything".
      if (wanted && wanted.length && !wanted.includes(kind)) return;

      try {
        callbackRef.current(kind, event?.detail);
      } catch (err) {
        console.error('A page could not handle the data change:', err);
      }
    };

    window.addEventListener(EVENT_NAME, onMutated);
    return () => window.removeEventListener(EVENT_NAME, onMutated);
  }, []);
}

/**
 * The name of the event, for a test that wants to listen for it
 * without the helper.
 */
export const DATA_MUTATED_EVENT = EVENT_NAME;

export default { emitDataMutated, useOnDataMutated, DATA_MUTATED_EVENT };
