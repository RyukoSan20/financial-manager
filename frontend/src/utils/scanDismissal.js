/**
 * The scan notification should not come back.
 *
 * A scan that finished showed a bar at the bottom of every page. The
 * bar went away when the sheet was closed, but the scan itself was
 * never marked as looked at, so the next page opened showed it again,
 * and the next one after that. A reader who had already read the
 * result kept being told about it.
 *
 * So the scans that have been dealt with are written down, and a scan
 * that is in that list is not shown again.
 *
 * The list is kept in `sessionStorage`, not `localStorage`, because it
 * is about this visit to the application. A reader who comes back
 * tomorrow is not expecting yesterday's receipt to greet them.
 *
 * These are plain functions with no React in them, so they can be
 * checked by a script.
 */

export const STORAGE_KEY = 'fm_dismissed_scans';

/** The most scans remembered at once. A reader is not going to dismiss
 *  more than this in one visit, and the list is not allowed to grow
 *  without end. */
export const MAX_REMEMBERED = 50;

/**
 * The storage to use. The browser gives one; a test gives another, so
 * the same code is checked without a browser.
 */
function storageOf(custom) {
  if (custom) return custom;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    // Storage can be blocked. The page still works, it just forgets.
    return null;
  }
}

/**
 * The scans that have been dealt with.
 */
export function dismissedScans(storage = storageOf()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Has this scan already been dealt with?
 */
export function isDismissed(jobId, storage = storageOf()) {
  if (!jobId) return false;
  return dismissedScans(storage).includes(String(jobId));
}

/**
 * Remember that this scan has been dealt with.
 *
 * The list is capped, and the oldest goes first: the scan that was
 * dealt with longest ago is the one least likely to still be on the
 * reader's mind.
 */
export function dismissScan(jobId, storage = storageOf()) {
  if (!storage || !jobId) return false;
  try {
    const id = String(jobId);
    const current = dismissedScans(storage);
    if (current.includes(id)) return true;
    const next = [...current, id];
    while (next.length > MAX_REMEMBERED) next.shift();
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * Forget them all.
 *
 * A way back, for a reader who wants to see the old notifications
 * again.
 */
export function clearDismissedScans(storage = storageOf()) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export default {
  dismissedScans,
  isDismissed,
  dismissScan,
  clearDismissedScans,
  STORAGE_KEY,
  MAX_REMEMBERED,
};
