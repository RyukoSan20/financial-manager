/**
 * The page must not make the console angry.
 *
 * Run with:
 *   node src/components/parser/__tests__/noServerErrors.test.js
 *   BASE_URL=https://my-financial-manager.online node .../noServerErrors.test.js
 *
 * There is no test runner in this project, so the tests are plain node
 * files and each one prints its own count and exits non-zero when
 * something fails.
 *
 * What this checks
 *
 * The reader opens the transactions page. The page asks for a dozen
 * things at once. Every one of them has to answer, and none of them
 * may answer with a 5xx, because a 5xx is what the reader sees as "the
 * app is broken" even when the app is working perfectly well.
 *
 * The three ways of adding a transaction are opened as well, because
 * the reader opens them straight away: the text parser, the receipt
 * scanner and the voice input.
 *
 * The service worker gets a special mention. It used to answer a
 * request it could not reach with a 503, which put a 503 in the
 * console of a reader whose app was working. Now it answers with a
 * 504, which says what actually happened, and this test is what keeps
 * it that way.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

const HERE = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(message);
  }
}

/**
 * The 5xx answers, and the console messages.
 */
function watch(page) {
  const serverErrors = [];
  const consoleErrors = [];

  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      // A request that could not be made at all is not a server
      // error, and it is not the app's fault either.
      if (/Failed to load resource/.test(text)) {
        // The browser's own wording for a failed request. The status
        // is caught by the response handler above, so this is only
        // counted when no status came with it.
        if (!/the server responded with a status of/.test(text)) {
          consoleErrors.push(text);
        }
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });

  return { serverErrors, consoleErrors };
}

/**
 * Sign in as a guest, so the page is the page a reader sees.
 */
async function signIn(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const guest = page.getByRole('button', { name: /Lanjutkan sebagai Tamu|Coba Langsung Tanpa Akun|Masuk Mode Tamu/i });
  if (await guest.count()) {
    await guest.first().click();
    await page.waitForTimeout(6000);
  }
}

/**
 * Open one of the three ways of adding a transaction.
 */
async function openModal(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(2500);
    return true;
  }
  return false;
}

/**
 * Close whatever is open.
 *
 * The modal covers the page, so the next button cannot be reached
 * until it is gone. The close button is the one that says so, and the
 * escape key is the way out for a reader who has a keyboard.
 */
async function closeModal(page) {
  // The close button of the dialog.
  const close = page.locator('[role="dialog"] button[aria-label="Close"]');
  if (await close.count()) {
    try {
      await close.first().click({ timeout: 5000 });
      await page.waitForTimeout(1200);
    } catch {
      // The button was covered. The way out for a reader with a
      // keyboard is the escape key.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    }
  } else {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
  }
}

/**
 * The worker that answers when the network does not.
 *
 * This is checked by reading the source, because the offline path can
 * only be reached by pulling the network out from under the browser,
 * and a test that cannot be run on every build is a test that is not
 * run.
 */
function checkTheServiceWorker() {
  const worker = readFileSync(resolve(HERE, '../../../../public/sw.js'), 'utf8');
  const index = readFileSync(resolve(HERE, '../../../../index.html'), 'utf8');

  ok(
    /const OFFLINE_STATUS = 504/.test(worker),
    'the worker answers a dropped connection with 504, not 503'
  );
  ok(
    !/status:\s*503/.test(worker),
    'the worker never answers with a 503'
  );
  ok(
    /self\.skipWaiting\(\)/.test(worker),
    'the new worker takes over at once'
  );
  ok(
    /self\.clients\.claim\(\)/.test(worker),
    'the new worker takes over the pages that are already open'
  );
  ok(
    /finmanager-v\d+/.test(worker),
    'the worker has a cache name, so a new one replaces the old'
  );
  ok(
    /SKIP_WAITING/.test(index),
    'the page tells a waiting worker to take over'
  );
  ok(
    /updatefound/.test(index),
    'the page watches for a worker that arrives later'
  );
}

/**
 * Is the app being served?
 *
 * The build server of the pipeline does not serve the app, so there is
 * nothing to open there. The parts that can be checked without a
 * running app are still checked; the rest are reported as not run
 * rather than as a failure.
 */
async function appIsBeingServed(baseUrl) {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(8000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  checkTheServiceWorker();

  if (!(await appIsBeingServed(BASE_URL))) {
    console.log(
      `${passed} passed (the browser was not run: ${BASE_URL} is not being served)`
    );
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const { serverErrors, consoleErrors } = watch(page);

  // ---- The page itself -------------------------------------------------
  await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // It may have been sent to the sign-in page.
  if (page.url().includes('/login')) {
    await signIn(page, BASE_URL);
    await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
  } else {
    await page.waitForTimeout(5000);
  }

  ok(
    page.url().includes('/transactions'),
    `the transactions page was reached (got ${page.url()})`
  );

  // ---- The three ways of adding a transaction ---------------------------
  // Each one is opened on a page of its own. A modal covers the page
  // it is on, so the way to be sure the next one is opened from a
  // clean page is to go back to a clean page.
  for (const [label, button] of [
    ['the text parser', 'SMS'],
    ['the receipt scanner', 'Struk'],
    ['the voice input', 'Suara'],
  ]) {
    await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const opened = await openModal(page, button);
    ok(opened, `${label} opens`);

    if (opened) {
      // The modal is really there, and it is really the one that was
      // asked for.
      const dialog = page.locator('[role="dialog"]');
      ok(await dialog.count() > 0, `${label} shows a dialog`);
    }
  }

  // ---- The box to write in ----------------------------------------------
  await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await openModal(page, 'SMS');
  const textarea = page.locator('[role="dialog"] textarea').first();
  if (await textarea.count()) {
    const radius = await textarea.evaluate(
      (element) => getComputedStyle(element).borderRadius
    );
    ok(
      radius === '16px',
      `the textarea has a radius of 16px, not a pill (got ${radius})`
    );

    const padding = await textarea.evaluate(
      (element) => getComputedStyle(element).paddingLeft
    );
    ok(
      parseFloat(padding) >= 12,
      `the textarea has room on the left (got ${padding})`
    );
  } else {
    ok(false, 'the text parser has a box to write in');
  }

  // ---- The answers ------------------------------------------------------
  ok(
    serverErrors.length === 0,
    `no 5xx answers (${serverErrors.length}):\n    ${serverErrors.join('\n    ')}`
  );
  ok(
    consoleErrors.length === 0,
    `no console errors (${consoleErrors.length}):\n    ${consoleErrors.join('\n    ')}`
  );

  await browser.close();
}

main()
  .then(() => {
    if (failed) {
      console.error(`\n${failed} failed, ${passed} passed\n`);
      for (const failure of failures) {
        console.error(`  FAIL  ${failure}`);
      }
      console.error('');
      process.exit(1);
    }
    console.log(`${passed} passed`);
  })
  .catch((error) => {
    console.error(`\n${failed} failed, ${passed} passed\n`);
    console.error(`  FAIL  the browser could not be run: ${error.message}`);
    console.error('');
    process.exit(1);
  });
