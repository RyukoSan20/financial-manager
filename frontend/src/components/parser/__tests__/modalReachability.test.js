/**
 * The dialog has to be usable on a phone.
 *
 * Two things were broken and neither of them could be seen by
 * reading the source:
 *
 * 1. The close button did nothing.
 *
 *    It was not covered by anything and the click did reach it. The
 *    handler that was wired to it only put the state of the panel
 *    back the way it was, and never told the page that the panel was
 *    finished - so the panel stayed on the screen.
 *
 * 2. The buttons at the foot of the panel were under the bar at the
 *    bottom of the phone.
 *
 *    The page settles into place when it appears, and settling means
 *    moving, and an element that moves makes a layer of its own. The
 *    z-index of the panel was counted inside that layer, and the bar
 *    at the bottom of the phone is not inside it.
 *
 * Run with:
 *   node src/components/parser/__tests__/modalReachability.test.js
 *   BASE_URL=https://my-financial-manager.online node .../modalReachability.test.js
 */

import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

/**
 * Open the page and log in as a guest, so that the page behind the
 * dialog is a real page.
 */
async function openThePage(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const guest = page.getByRole('button', { name: /Lanjutkan sebagai Tamu|Coba Langsung Tanpa Akun|Masuk Mode Tamu/i });
  if (await guest.count()) {
    await guest.first().click();
    await page.waitForTimeout(6000);
  }

  await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
}

/**
 * Open one of the three ways of adding a transaction.
 */
async function openAModal(page, label) {
  const button = page.getByRole('button', { name: label, exact: true });
  if (!(await button.count())) return false;
  await button.first().click();
  await page.waitForTimeout(2500);
  return true;
}

/**
 * What the panel is made of, as the browser sees it.
 */
async function inspectThePanel(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;

    // The bar at the bottom of the phone. On a wide screen it is not
    // there at all - it is hidden - and its box is then empty, which
    // would make every comparison against it wrong.
    const nav = document.querySelector('.theme-bottomnav');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const barTop = navRect && navRect.height > 0 ? navRect.y : null;

    const close = dialog.querySelector('button[aria-label="Close"]');
    const closeRect = close ? close.getBoundingClientRect() : null;
    let closeHit = false;
    if (close && closeRect) {
      const at = document.elementFromPoint(
        closeRect.x + closeRect.width / 2,
        closeRect.y + closeRect.height / 2
      );
      closeHit = at === close || close.contains(at);
    }

    // Every button that is wide enough to be a real button, and
    // whether something is sitting on top of it.
    const buttons = Array.from(dialog.querySelectorAll('button'))
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().width > 40)
      .map((b) => {
        const r = b.getBoundingClientRect();
        const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          label: (b.innerText || '').trim().slice(0, 24),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
          aboveTheBar: barTop === null ? true : r.bottom <= barTop,
          reachable: at === b || b.contains(at),
        };
      });

    return {
      // The panel has to be on the body itself, not inside the page.
      onTheBody: dialog.parentElement && dialog.parentElement.parentElement === document.body,
      closeReachable: closeHit,
      closeTop: closeRect ? Math.round(closeRect.top) : null,
      barTop: barTop === null ? null : Math.round(barTop),
      buttons,
    };
  });
}

/**
 * Is the app being served?
 *
 * The build server of the pipeline does not serve the app, so there is
 * nothing to open there. The test is reported as not run rather than
 * as a failure.
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
  if (!(await appIsBeingServed(BASE_URL))) {
    console.log(`0 passed (the browser was not run: ${BASE_URL} is not being served)`);
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();

  for (const width of [390, 600, 1280]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width === 600 ? 800 : 844 });

    console.log(`\n--- ${width}px ---`);

    for (const [label, expected] of [
      ['SMS', ['Hapus', 'Analisis Sekarang']],
      ['Struk', ['Batal']],
      ['Suara', null],
    ]) {
      await openThePage(page);
      const opened = await openAModal(page, label);
      check(`[${label}] the panel opens`, opened === true);
      if (!opened) continue;

      const panel = await inspectThePanel(page);
      check(`[${label}] the panel is on the body`, panel !== null && panel.onTheBody === true);
      if (!panel) continue;

      check(`[${label}] the close button is the thing under the pointer`, panel.closeReachable === true);

      // The close button has to close.
      await page.locator('[role="dialog"] button[aria-label="Close"]').click();
      await page.waitForTimeout(1200);
      const stillOpen = await page.locator('[role="dialog"]').count();
      check(`[${label}] the close button closes the panel`, stillOpen === 0, `still ${stillOpen} open`);

      // And the escape key.
      await openThePage(page);
      await openAModal(page, label);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1200);
      const openAfterEscape = await page.locator('[role="dialog"]').count();
      check(`[${label}] the escape key closes the panel`, openAfterEscape === 0, `still ${openAfterEscape} open`);

      // And the buttons at the foot.
      await openThePage(page);
      await openAModal(page, label);
      const panel2 = await inspectThePanel(page);
      const covered = (panel2?.buttons || []).filter((b) => !b.reachable);
      check(`[${label}] no button is covered`, covered.length === 0, covered.map((b) => b.label).join(', '));

      const offScreen = (panel2?.buttons || []).filter((b) => !b.inViewport);
      check(`[${label}] every button is on the screen`, offScreen.length === 0, offScreen.map((b) => b.label).join(', '));

      if (expected) {
        for (const wanted of expected) {
          const found = (panel2?.buttons || []).find((b) => b.label.startsWith(wanted));
          check(`[${label}] "${wanted}" is there`, Boolean(found), 'not found');
          if (found) {
            check(`[${label}] "${wanted}" is above the bar`, found.aboveTheBar === true);
            check(`[${label}] "${wanted}" is reachable`, found.reachable === true);
          }
        }
      }
    }

    await page.close();
  }

  await browser.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

await main();
