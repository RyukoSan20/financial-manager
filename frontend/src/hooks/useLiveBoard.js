/**
 * Watching a board.
 *
 * The host's screen and the guest's screen both need to change the
 * moment somebody at the table taps a plate.
 *
 * There are two ways to find out, and this uses both.
 *
 * The server can push the change over a connection it holds open.
 * That is fast, and it is the reason the connection exists. But a
 * phone on a restaurant network drops connections, and a dropped
 * connection is indistinguishable from a screen that has stopped
 * updating. So underneath the stream there is the older way of
 * asking again after a short while.
 *
 * The two are not in competition. The stream makes the screen feel
 * immediate. The asking makes the screen correct even when the
 * stream cannot be kept open. When the stream is working, the
 * asking slows down; when the stream is not, the asking takes over.
 *
 * The stream is opened with a plain fetch and the body is read as it
 * arrives, rather than with the browser's EventSource, because the
 * EventSource cannot send an authorization header and a token put
 * into the address of a stream ends up in the server's access log.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, getToken } from '../services/api';
import { eventMeansChange, liveFeedHeaders, liveFeedUrl, parseStreamChunk } from '../components/split/liveStream';

/**
 * Watching one board.
 *
 * `fetcher` is a function that returns the whole board. It is
 * called when the stream says something changed, and again after a
 * while as the safety net underneath.
 *
 * `kind` is 'host' or 'guest'. `id` is the group id for the host
 * and the invitation code for the guest.
 */
export function useLiveBoard(fetcher, { kind = 'host', id = null, token = null, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const stoppedRef = useRef(false);
  const timerRef = useRef(null);
  const controllerRef = useRef(null);

  const ask = useCallback(async () => {
    if (!fetcherRef.current) return;
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
    }
  }, []);

  useEffect(() => {
    stoppedRef.current = false;

    if (!enabled || !id) {
      return undefined;
    }

    let alive = true;
    let buffer = '';

    // The safety net underneath. While the stream is working, the
    // screen is asked for less often, because the stream will say
    // when something changed.
    const POLL_LIVE = 15000;
    const POLL_FALLBACK = 2500;

    const isLiveRef = { current: false };

    const schedule = (delay) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await ask();
        if (!alive) return;
        schedule(isLiveRef.current ? POLL_LIVE : POLL_FALLBACK);
      }, delay);
    };

    const open = async () => {
      if (!alive) return;

      const url = liveFeedUrl(`${API_BASE_URL}/split`, kind, id);
      if (!url) {
        schedule(POLL_FALLBACK);
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await fetch(url, {
          headers: liveFeedHeaders(kind, token || (kind === 'host' ? getToken() : null)),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`The live feed answered ${response.status}.`);
        }

        if (!alive) return;
        isLiveRef.current = true;
        setIsLive(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // eslint-disable-next-line no-constant-condition
        while (alive) {
          // eslint-disable-next-line no-await-in-loop
          const { value, done } = await reader.read();
          if (done) break;
          if (!alive) break;

          const text = decoder.decode(value, { stream: true });
          const parsed = parseStreamChunk(buffer, text);
          buffer = parsed.rest;

          const changed = parsed.events.some(eventMeansChange);
          if (changed) {
            // Something was claimed or released. Ask for the whole
            // board so that the screen and the server agree.
            // eslint-disable-next-line no-await-in-loop
            await ask();
          }
        }
      } catch (err) {
        if (stoppedRef.current) return;
        if (err && err.name === 'AbortError') return;
        // The stream could not be kept open. The asking underneath
        // takes over, and the stream is tried again in a moment.
        isLiveRef.current = false;
        setIsLive(false);
      }

      if (!alive) return;

      // The stream ended. Try again, unless the reader has gone.
      setTimeout(() => {
        if (alive) open();
      }, 3000);
    };

    ask();
    open();
    schedule(POLL_FALLBACK);

    return () => {
      alive = false;
      stoppedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (controllerRef.current) {
        try {
          controllerRef.current.abort();
        } catch (err) {
          // The connection was already gone.
        }
        controllerRef.current = null;
      }
    };
    // The loop is set up once. The fetcher itself is read from a ref,
    // so a new function does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, id, kind, token]);

  return {
    data,
    error,
    isStale,
    isLive,
    refresh: ask,
  };
}

export default useLiveBoard;
