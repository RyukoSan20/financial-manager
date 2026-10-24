/**
 * A setting that follows the user from one device to another.
 *
 * The dashboard layout, the widgets a user has switched off, the period
 * they look at - these are the kind of thing a person sets up once on
 * their laptop and then expects to find on their phone.
 *
 * So each of these is stored in three places:
 *
 *   - in the browser, so the page works offline and paints correctly
 *     on the first frame;
 *   - on the server, so it follows the user between devices;
 *   - in the `preferences` blob of the user's settings, which is where
 *     the server keeps it.
 *
 * The local copy is written immediately. The server copy is written a
 * moment later, and only if it differs, so moving a widget does not
 * cause a request for every keystroke.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * How long to wait before sending a change to the server.
 *
 * Long enough that a burst of changes becomes one request, short enough
 * that the other device has it within a few seconds.
 */
const SAVE_DELAY_MS = 700;

/**
 * Read a value out of the local copy.
 */
const readLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

/**
 * Write a value to the local copy.
 */
const writeLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable - the page still works, it just forgets */
  }
};

/**
 * Merge the user's stored preferences with a default.
 *
 * The stored value may be missing keys, because a widget that was added
 * to the app after the user last visited does not exist in their copy
 * yet. The default fills those in.
 */
const merge = (stored, defaults) => {
  if (!stored || typeof stored !== 'object') return { ...defaults };
  const merged = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (stored[key] !== undefined) merged[key] = stored[key];
  }
  return merged;
};

/**
 * Use a value that is kept on the server and in the browser.
 *
 * @param key        The key inside the preferences blob on the server.
 * @param localKey   The key in localStorage.
 * @param defaults   The value used when neither place has one yet.
 * @param normalize  Turns whatever came from the server into the shape
 *                   the app expects. It guards against a stale copy
 *                   from an older version of the app.
 */
export const useSyncedPreference = (key, localKey, defaults, normalize) => {
  const { user } = useAuth();

  // The defaults and the normaliser are held in a ref. A caller that
  // writes the default inline would otherwise hand over a new object on
  // every render, and the effect that pulls from the server would then
  // run again and again.
  const defaultsRef = useRef(defaults);
  const normalizeRef = useRef(normalize);
  defaultsRef.current = defaults;
  normalizeRef.current = normalize;

  const [value, setValue] = useState(() => {
    const local = readLocal(localKey, null);
    const shape = normalizeRef.current;
    const base = defaultsRef.current;
    return shape ? shape(local, base) : merge(local, base);
  });

  // The value that is on the server. It is only known after the first
  // pull, and it is what a change is measured against.
  const serverValue = useRef(null);
  const timer = useRef(null);
  const dirty = useRef(false);

  // The current value, held so the callbacks below never read a copy
  // that has gone stale.
  const valueRef = useRef(value);
  valueRef.current = value;

  // --- Send to the server ---

  const pushLocal = useCallback(async () => {
    if (!user) return;
    try {
      const settings = await api.request('/settings/app');
      if (!settings) return;

      const stored = settings.preferences || {};
      const current = stored[key];

      const next = valueRef.current;
      if (JSON.stringify(current) === JSON.stringify(next)) {
        dirty.current = false;
        serverValue.current = next;
        return;
      }

      await api.request('/settings/app', {
        method: 'PUT',
        body: JSON.stringify({
          preferences: { ...stored, [key]: next },
        }),
      });

      dirty.current = false;
      serverValue.current = next;
    } catch {
      // The change stays local. It is sent again on the next change or
      // on the next pull.
      dirty.current = true;
    }
  }, [user, key]);

  // --- Pull from the server ---

  const pull = useCallback(async () => {
    if (!user) return;
    try {
      const settings = await api.request('/settings/app');
      if (!settings) return;

      const stored = settings.preferences || {};
      const incoming = stored[key];

      if (incoming === undefined) {
        // The server has nothing for this key yet. The local copy is
        // the one the user has been working with, so it is sent up.
        serverValue.current = null;
        if (readLocal(localKey, null) !== null) {
          dirty.current = true;
          pushLocal();
        }
        return;
      }

      serverValue.current = incoming;

      // The server copy only wins when it is newer than what is in the
      // browser. The browser copy is newer when the user just changed
      // it and the save has not gone through yet.
      if (dirty.current) return;

      const shape = normalizeRef.current;
      const base = defaultsRef.current;
      const next = shape ? shape(incoming, base) : merge(incoming, base);
      setValue(next);
      writeLocal(localKey, next);
    } catch {
      // Offline, or the server is not reachable. The local copy stands.
    }
  }, [user, key, localKey]);

  // Pull once when the user is there, and then on a timer so a change
  // made on another device shows up here.
  useEffect(() => {
    if (!user) return undefined;

    pull();
    const timer = setInterval(pull, 60000);
    const onFocus = () => pull();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, pull]);

  // --- The setter ---

  const update = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(value) : next;
      const shape = normalizeRef.current;
      const base = defaultsRef.current;
      const shaped = shape ? shape(resolved, base) : merge(resolved, base);

      setValue(shaped);
      writeLocal(localKey, shaped);
      dirty.current = true;

      // Wait a moment before sending, so a burst of changes is one
      // request.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pushLocal();
      }, SAVE_DELAY_MS);
    },
    [value, localKey, pushLocal]
  );

  // A pending save is not lost when the page goes away.
  useEffect(() => {
    const flush = () => {
      if (dirty.current && timer.current) {
        clearTimeout(timer.current);
        pushLocal();
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [pushLocal]);

  return [value, update];
};

export default useSyncedPreference;
