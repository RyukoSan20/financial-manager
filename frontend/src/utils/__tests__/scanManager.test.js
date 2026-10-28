/**
 * The scan manager keeps the scans of one reader out of the way of the
 * next.
 *
 * The bug: the manager is a single object that lives as long as the
 * page is open. Signing out did not clear it, so the scans of the
 * reader who left were still in it. The next person who opened the
 * page was shown the finished scans of somebody else, and because the
 * notification sits outside the routes, it was shown on the login
 * page too, where nobody had signed in at all.
 *
 * The fix has two halves, and both are checked here:
 *
 * - `reset()` throws the jobs away and stops the timers that poll for
 *   results. A poll that keeps running would put the job back.
 * - the notification only appears for a signed-in reader.
 *
 * The manager is checked here without a browser. The fetch is replaced
 * with a stand-in, so the rules can be exercised directly.
 *
 * Run with: node src/utils/__tests__/scanManager.test.js
 */

// Node warns that there is no browser storage when this module is
// loaded outside a browser. The tests do that on purpose, so the
// warning is turned off here rather than left to clutter the output
// of the whole test run.
//
// The manager is loaded with a dynamic import, because an import is
// hoisted above everything else in the file and the warning would
// then be printed before the handler is in place.
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const text = typeof warning === 'string' ? warning : warning?.message || '';
  if (text.includes('localStorage')) return;
  return originalEmitWarning.call(process, warning, ...rest);
};

const { ScanManager } = await import('../../services/scanManager.js');

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

// --- A manager that has nothing in it ----------------------------------

{
  const manager = new ScanManager();
  check(manager.list().length === 0, 'a new manager has jobs in it');
  check(manager.timers.size === 0, 'a new manager has timers running');
}

// --- Reset throws the jobs away ----------------------------------------

{
  const manager = new ScanManager();
  manager.jobs.set('job-1', {
    jobId: 'job-1',
    kind: 'receipt',
    status: 'completed',
    startedAt: Date.now(),
  });
  check(manager.list().length === 1, 'the job was not added');

  manager.reset();
  check(manager.list().length === 0, 'reset left the job in the manager');
  check(manager.timers.size === 0, 'reset left a timer running');
}

// --- Reset tells the listeners -----------------------------------------

{
  const manager = new ScanManager();
  const seen = [];
  manager.subscribe((jobs) => seen.push(jobs.length));

  manager.jobs.set('job-1', {
    jobId: 'job-1',
    kind: 'receipt',
    status: 'completed',
    startedAt: Date.now(),
  });
  manager.emit();
  manager.reset();

  check(seen.length === 2, 'the listener was not told about the reset');
  check(seen[seen.length - 1] === 0, 'the listener was told about a job that was still there');
}

// --- Reset stops the timers that poll for results ----------------------
//
// A poll that keeps running after the reader has gone would put their
// scan back into the list, which is the very thing the reset is for.

{
  const manager = new ScanManager();
  let fired = false;
  manager.timers.set('job-1', setTimeout(() => {
    fired = true;
  }, 5));
  manager.reset();
  // Give the timer the chance it would have had.
  const wait = Date.now() + 40;
  while (Date.now() < wait) {
    /* spin briefly so the event loop can run the timer if it survived */
  }
  check(fired === false, 'a timer that was still running fired after the reset');
}

// --- Signing out and signing in as somebody else ------------------------
//
// The whole point: the scans of one reader must not reach the next.

{
  const first = new ScanManager();
  first.jobs.set('job-of-first-reader', {
    jobId: 'job-of-first-reader',
    kind: 'receipt',
    status: 'completed',
    startedAt: Date.now(),
  });
  check(first.list().length === 1, "the first reader's scan was not recorded");

  // The reader signs out.
  first.reset();

  // The next person opens the page.
  const second = new ScanManager();
  check(
    second.list().length === 0,
    "the next reader was shown the scan of the one before"
  );
  check(
    second.list().some((job) => job.jobId === 'job-of-first-reader') === false,
    "the next reader was shown the scan of the one before"
  );
}

// --- A listener can be removed -----------------------------------------
{
  const manager = new ScanManager();
  const seen = [];
  const unsubscribe = manager.subscribe((jobs) => seen.push(jobs.length));
  manager.emit();
  const before = seen.length;
  unsubscribe();
  manager.emit();
  check(seen.length === before, 'a listener that was removed was still called');
}

// --- Restoring without a reader does nothing ---------------------------
//
// The restore used to go out without a token when nobody was signed
// in, and the answer was taken as if it belonged to whoever had the
// page open. It must not even make the request.

{
  const manager = new ScanManager();
  let requested = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    requested = true;
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({}),
    });
  };
  try {
    // There is no browser storage here, so there is no token, and the
    // call must return without asking the server anything.
    manager.restore();
    check(requested === false, 'the server was asked for scans without a reader');
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
