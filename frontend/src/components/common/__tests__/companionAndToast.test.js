/**
 * The companion, and the toast that carries it.
 *
 * The application used the browser's own `alert` and `confirm` for the
 * moments that matter: a wishlist item added, a budget that could not
 * be saved, a transaction that is about to be deleted. Those dialogs
 * are drawn by the browser, not by the application. They cannot be
 * styled, they cannot be translated, on a phone they can sit behind
 * the page, and they break the picture of an application that has
 * taken the trouble to have a character in it.
 *
 * This covers three things:
 *
 * - the companion exists and can wear four outfits, each of which
 *   means something;
 * - the toast exists and is drawn by the application;
 * - no page reaches for the browser's own dialog any more.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const list = (p) => fs.readdirSync(path.join(ROOT, p));

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}: ${err.message}`);
  }
};

console.log('the companion and the toast');

// --- the companion ---------------------------------------------------------

const companionPath = 'src/components/common/MascotCompanion.jsx';
const hasCompanion = fs.existsSync(path.join(ROOT, companionPath));

check('the companion exists', () => {
  assert.ok(hasCompanion, `${companionPath} is missing`);
});

if (hasCompanion) {
  const companion = read(companionPath);

  check('the companion can wear the four outfits', () => {
    ['happy', 'worried', 'shopkeeper', 'detective'].forEach((mood) => {
      assert.ok(
        companion.includes(mood),
        `the companion cannot be ${mood}`
      );
    });
  });

  check('the companion is drawn, not a picture of a drawing', () => {
    assert.ok(companion.includes('<svg'), 'the companion must be drawn in the page');
  });

  check('the companion says something', () => {
    assert.ok(
      /messageKey|\bmessage\b/.test(companion),
      'a companion that says nothing is a picture, not a companion'
    );
  });

  check('the companion takes its size from the caller', () => {
    assert.ok(/size/.test(companion), 'the companion must be able to sit beside a line of text');
  });
}

// --- the toast -------------------------------------------------------------

const toastPath = 'src/components/common/MoeToast.jsx';
const hasToast = fs.existsSync(path.join(ROOT, toastPath));

check('the toast exists', () => {
  assert.ok(hasToast, `${toastPath} is missing`);
});

if (hasToast) {
  const toast = read(toastPath);

  check('the toast can say four different things', () => {
    ['success', 'error', 'warning', 'info'].forEach((tone) => {
      assert.ok(toast.includes(tone), `the toast cannot say ${tone}`);
    });
  });

  check('the toast carries the companion', () => {
    assert.ok(
      /MascotCompanion|companion/.test(toast),
      'the toast is the place the character appears'
    );
  });

  check('the toast can be dismissed', () => {
    assert.ok(
      /onDismiss|onClose/.test(toast),
      'a toast that cannot be dismissed is a dialog'
    );
  });
}

// --- no browser dialogs ----------------------------------------------------

const PAGE_DIRS = ['src/pages', 'src/components', 'src/hooks'];

const sourceFiles = [];
const walk = (dir) => {
  list(dir).forEach((name) => {
    const full = path.join(dir, name);
    const stat = fs.statSync(path.join(ROOT, full));
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(jsx?|js)$/.test(name) && !/__tests__/.test(full)) {
      sourceFiles.push(full);
    }
  });
};
PAGE_DIRS.forEach((d) => walk(d));

check('no page reaches for the browser alert', () => {
  const offenders = sourceFiles.filter((file) => {
    const text = read(file);
    // The word "alert" inside a class name or a comment is fine. What
    // is not fine is calling the browser's own function. The word may
    // also be the name of a local function, so the call has to be
    // looked at on its own line.
    return text
      .split('\n')
      .some((line) => /(?:^|[^.\w])alert\s*\(/.test(line) && !/^\s*(?:\/\/|\*)/.test(line));
  });
  assert.deepEqual(offenders, [], `these still call the browser dialog: ${offenders.join(', ')}`);
});

check('no page reaches for the browser confirm', () => {
  const offenders = sourceFiles.filter((file) => {
    const text = read(file);
    return /(?:^|[^.\w])confirm\s*\(/.test(text);
  });
  assert.deepEqual(offenders, [], `these still call the browser dialog: ${offenders.join(', ')}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
