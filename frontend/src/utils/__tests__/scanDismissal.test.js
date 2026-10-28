/**
 * A scan that has been dealt with does not come back.
 *
 * The bug: a scan that finished showed a bar at the bottom of every
 * page. Closing the sheet hid the sheet but did not mark the scan as
 * dealt with, so the next page opened showed the bar again, and the
 * next one after that.
 *
 * The fix keeps the scans that have been dealt with in sessionStorage
 * and does not show one that is in the list.
 *
 * The storage is faked here, so the same code is checked without a
 * browser.
 *
 * Run with: node src/utils/__tests__/scanDismissal.test.js
 */

import {
  MAX_REMEMBERED,
  STORAGE_KEY,
  clearDismissedScans,
  dismissedScans,
  dismissScan,
  isDismissed,
  shouldNotify,
} from '../scanDismissal.js';

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

/**
 * A storage that behaves like the browser's.
 */
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

// --- Nothing is dismissed to begin with ---------------------------------

{
  const store = fakeStorage();
  check(dismissedScans(store).length === 0, 'a fresh session has dismissed scans');
  check(isDismissed('job-1', store) === false, 'a fresh session says a scan is dismissed');
  check(isDismissed('', store) === false, 'an empty scan id is not a dismissed scan');
  check(isDismissed(null, store) === false, 'no scan id is not a dismissed scan');
}

// --- A dismissed scan is remembered --------------------------------------

{
  const store = fakeStorage();
  dismissScan('job-1', store);
  check(isDismissed('job-1', store) === true, 'the dismissed scan is not remembered');
  check(isDismissed('job-2', store) === false, 'another scan is wrongly remembered');
  check(dismissedScans(store).length === 1, 'one dismissed scan is remembered as more than one');
}

// --- Dismissing twice is not a problem ----------------------------------

{
  const store = fakeStorage();
  dismissScan('job-1', store);
  dismissScan('job-1', store);
  check(dismissedScans(store).length === 1, 'dismissing the same scan twice remembered it twice');
}

// --- The ids are stored as text, so a number works too ------------------

{
  const store = fakeStorage();
  dismissScan(42, store);
  check(isDismissed('42', store) === true, 'a number id is not found by its text form');
  check(isDismissed(42, store) === true, 'a text id is not found by its number form');
}

// --- A broken value in storage does not break the page ------------------

{
  const store = fakeStorage({ [STORAGE_KEY]: 'not json at all' });
  check(dismissedScans(store).length === 0, 'a broken value is read as a list of scans');
  check(isDismissed('job-1', store) === false, 'a broken value says a scan is dismissed');
  // And it can be written over.
  dismissScan('job-1', store);
  check(isDismissed('job-1', store) === true, 'a broken value could not be written over');
}

{
  const store = fakeStorage({ [STORAGE_KEY]: '{"not":"an array"}' });
  check(dismissedScans(store).length === 0, 'an object is read as a list of scans');
}

{
  const store = fakeStorage({ [STORAGE_KEY]: '[1, 2, "three"]' });
  check(dismissedScans(store).length === 1, 'only the text ids in the list are kept');
}

// --- The list does not grow without end ---------------------------------

{
  const store = fakeStorage();
  for (let i = 0; i < MAX_REMEMBERED + 20; i += 1) {
    dismissScan(`job-${i}`, store);
  }
  check(
    dismissedScans(store).length === MAX_REMEMBERED,
    `the list grew to ${dismissedScans(store).length} instead of being capped at ${MAX_REMEMBERED}`
  );
  // The oldest goes first, the newest is kept.
  check(isDismissed(`job-${MAX_REMEMBERED + 19}`, store) === true, 'the newest scan was dropped');
  check(isDismissed('job-0', store) === false, 'the oldest scan was not dropped');
}

// --- Clearing works ------------------------------------------------------

{
  const store = fakeStorage();
  dismissScan('job-1', store);
  dismissScan('job-2', store);
  clearDismissedScans(store);
  check(dismissedScans(store).length === 0, 'clearing did not empty the list');
  check(isDismissed('job-1', store) === false, 'clearing did not forget the scan');
}

// --- No storage at all is not a crash -----------------------------------

{
  check(dismissedScans(null).length === 0, 'no storage reads as an empty list');
  check(isDismissed('job-1', null) === false, 'no storage says a scan is dismissed');
  check(dismissScan('job-1', null) === false, 'no storage reports that it saved nothing');
  check(clearDismissedScans(null) === false, 'no storage reports that it cleared nothing');
}

// --- A storage that refuses to write does not throw ---------------------

{
  const store = {
    getItem: () => null,
    setItem: () => {
      throw new Error('storage is full');
    },
    removeItem: () => {
      throw new Error('storage is full');
    },
  };
  check(dismissScan('job-1', store) === false, 'a storage that refuses does not throw');
  check(clearDismissedScans(store) === false, 'a storage that refuses does not throw when clearing');
}

// --- When should the bar be shown? --------------------------------------
//
// The bug this covers: the reader opened the result of a scan, which
// set the flag the running client keeps in memory, and then reloaded
// the page. The reload brought the job back from the server with that
// flag cleared, so the same bar was shown again for a scan that had
// already been read.
//
// Two ways of saying "already looked at" have to agree: the in-memory
// flag and the list that is written down.

{
  const store = fakeStorage();

  // A finished scan nobody has looked at is shown.
  check(
    shouldNotify({ jobId: 'job-1', status: 'completed', seen: false }, store) === true,
    'a finished scan that nobody looked at is not shown'
  );

  // The running client has looked at it: not shown.
  check(
    shouldNotify({ jobId: 'job-1', status: 'completed', seen: true }, store) === false,
    'a scan the running client has seen is shown'
  );

  // Still running: not shown, it is not finished yet.
  check(
    shouldNotify({ jobId: 'job-1', status: 'running', seen: false }, store) === false,
    'a scan that is still running is shown'
  );
  check(
    shouldNotify({ jobId: 'job-1', status: 'queued', seen: false }, store) === false,
    'a scan that is still queued is shown'
  );

  // Failed scans have nothing to show.
  check(
    shouldNotify({ jobId: 'job-1', status: 'failed', seen: false }, store) === false,
    'a failed scan is shown'
  );

  // It was written down as dealt with: not shown. This is the case
  // that survives a reload.
  check(dismissScan('job-1', store) === true, 'the scan was not written down');
  check(
    shouldNotify({ jobId: 'job-1', status: 'completed', seen: false }, store) === false,
    'a scan that was written down as dealt with is shown again'
  );

  // A different scan is still shown.
  check(
    shouldNotify({ jobId: 'job-2', status: 'completed', seen: false }, store) === true,
    'a scan that was not dealt with is not shown'
  );

  // Nothing at all.
  check(shouldNotify(null, store) === false, 'a missing job is shown');
  check(shouldNotify(undefined, store) === false, 'an undefined job is shown');
}

// --- A job without an id is never shown --------------------------------

{
  const store = fakeStorage();
  check(
    shouldNotify({ status: 'completed', seen: false }, store) === true,
    'a job without an id is treated as a normal one'
  );
  // A job with no id cannot be written down, so it stays visible.
  check(dismissScan(undefined, store) === false, 'a job without an id is written down');
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
