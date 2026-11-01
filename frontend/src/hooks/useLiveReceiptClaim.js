/**
 * The receipt, as it changes.
 *
 * Somebody at the table taps a plate and everybody's screen has to
 * show it. The way this is done here is by asking the server again
 * after a short while, rather than by holding a connection open.
 *
 * The reason is that a group of friends at a restaurant is on a
 * phone network that is busy, in a place where the signal is bad.
 * A connection that stays open is a connection that drops, and a
 * dropped connection looks exactly like a screen that has stopped
 * updating. Asking again and again is slower by a second or two
 * and much harder to break.
 *
 * The screen is never left showing something that has been thrown
 * away: when the request fails, what is on the screen stays on the
 * screen, and the failure is remembered so that the reader can be
 * told the screen may be behind.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long to wait between two asks, in milliseconds. */
const DEFAULT_INTERVAL = 2500;

/** How long to wait before trying again after a failure. */
const RETRY_INTERVAL = 5000;

/**
 * Asking for the receipt over and over.
 *
 * `fetcher` is a function that returns the receipt. It is called
 * again and again until the screen is closed.
 */
export function useLiveReceipt(fetcher, options = {}) {
  const {
    interval = DEFAULT_INTERVAL,
    enabled = true,
    onError = null,
  } = options;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // The fetcher is kept in a ref so that a caller who makes a new
  // function on every render does not restart the loop every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const stoppedRef = useRef(false);
  const timerRef = useRef(null);

  const ask = useCallback(async () => {
    if (!fetcherRef.current) return;
    setIsLoading(true);
    try {
      const next = await fetcherRef.current();
      if (stoppedRef.current) return;
      setData(next);
      setError(null);
      setIsStale(false);
    } catch (err) {
      if (stoppedRef.current) return;
      setError(err);
      setIsStale(true);
      if (onError) onError(err);
    } finally {
      if (!stoppedRef.current) setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    stoppedRef.current = false;

    if (!enabled) {
      return undefined;
    }

    let alive = true;

    const tick = async () => {
      await ask();
      if (!alive) return;
      const wait = error ? RETRY_INTERVAL : interval;
      timerRef.current = setTimeout(tick, wait);
    };

    tick();

    return () => {
      alive = false;
      stoppedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // The loop is set up once. The fetcher itself is read from a ref,
    // so a new function does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval]);

  return {
    data,
    error,
    isStale,
    isLoading,
    refresh: ask,
  };
}

/**
 * The link that lets somebody join without an account.
 *
 * It is the group's invite code turned into a full address, with the
 * code in the path so that the guest's screen can ask the server
 * about it without a key.
 */
export function inviteLink(origin, code) {
  if (!origin || !code) return '';
  const base = String(origin).replace(/\/$/, '');
  return `${base}/split/claim/${code}`;
}

/**
 * The claim token, kept where a guest's browser can find it.
 *
 * A guest comes back to the same link on the same phone and is given
 * the same place at the table, rather than a second seat.
 */
const CLAIM_KEY = 'splitClaimToken';

export function readClaimToken(code) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CLAIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed[code] ? parsed[code] : null;
  } catch (err) {
    return null;
  }
}

export function writeClaimToken(code, token) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(CLAIM_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[code] = token;
    window.localStorage.setItem(CLAIM_KEY, JSON.stringify(parsed));
    return true;
  } catch (err) {
    return false;
  }
}

export function forgetClaimToken(code) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(CLAIM_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    delete parsed[code];
    window.localStorage.setItem(CLAIM_KEY, JSON.stringify(parsed));
    return true;
  } catch (err) {
    return false;
  }
}

export default useLiveReceipt;
