/**
 * The dialog that asks before something is done.
 *
 * Run with: node src/components/ui/__tests__/confirmDialog.test.js
 *
 * The application used `window.confirm` for the questions that
 * matter. That dialog is drawn by the browser, so it cannot be
 * styled, it cannot be translated, and on a phone it can sit behind
 * the page. Two places used it.
 *
 * The checks here are on the source, because the bugs they guard
 * against are in the structure of the dialog rather than in a
 * calculation:
 *
 * - the dialog is drawn by the application, and the browser's own
 *   dialog is not used anywhere;
 * - the reader is never trapped: Escape closes it, the backdrop
 *   closes it, and there is a way out that is named;
 * - the button that does the thing is named after the thing, so
 *   there is no "OK" to interpret;
 * - the words come from the translation, so they are in the reader's
 *   own language.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dialogPath = join(here, '..', 'ConfirmDialog.jsx');
const source = readFileSync(dialogPath, 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(
      `${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`
    );
  }
}

// ---------------------------------------------------------------------------
// The browser's own dialog is not used
// ---------------------------------------------------------------------------

// The comment at the top of the file mentions the browser dialog, so
// the check is on the code and not on the whole file.
const dialogCode = source.replace(/\/\*[\s\S]*?\*\//g, '');

check(
  'the dialog does not use the browser one',
  /window\.confirm/.test(dialogCode),
  false
);

// ---------------------------------------------------------------------------
// The reader is never trapped
// ---------------------------------------------------------------------------

check(
  'Escape closes the dialog',
  /event\.key === 'Escape'/.test(source),
  true
);

check(
  'the backdrop closes the dialog',
  /onClick=\{onCancel\}[\s\S]{0,200}aria-hidden/.test(source),
  true
);

check(
  'there is a button that says no',
  /onClick=\{onCancel\}/.test(source),
  true
);

check(
  'the escape listener is removed when the dialog closes',
  /removeEventListener\('keydown'/.test(source),
  true
);

// ---------------------------------------------------------------------------
// The words come from the translation
// ---------------------------------------------------------------------------

check(
  'the title is looked up through the translation',
  /t\(titleKey/.test(source),
  true
);

check(
  'the message is looked up through the translation',
  /t\(messageKey/.test(source),
  true
);

check(
  'the confirming button is looked up through the translation',
  /t\(confirmLabelKey/.test(source),
  true
);

check(
  'the cancelling button is looked up through the translation',
  /t\(cancelLabelKey/.test(source),
  true
);

// ---------------------------------------------------------------------------
// The button is named after the thing
// ---------------------------------------------------------------------------

check(
  'the confirming button is not just "OK"',
  /confirmLabelKey \|\| 'common\.confirm'/.test(source),
  true
);

// ---------------------------------------------------------------------------
// It is a dialog, and it is announced as one
// ---------------------------------------------------------------------------

check(
  'it is an alert dialog',
  /role="alertdialog"/.test(source),
  true
);

check(
  'it is modal',
  /aria-modal="true"/.test(source),
  true
);

check(
  'it is labelled by its title',
  /aria-label=\{titleText\}/.test(source),
  true
);

// ---------------------------------------------------------------------------
// The places that used the browser dialog
// ---------------------------------------------------------------------------

const kanbanPath = join(
  here,
  '..',
  '..',
  '..',
  'features',
  'shopping',
  'components',
  'KanbanBoard.jsx'
);
const kanban = readFileSync(kanbanPath, 'utf8');

const kanbanCode = kanban.replace(/\/\*[\s\S]*?\*\//g, '');

check(
  'the shopping board does not use the browser dialog',
  /window\.confirm/.test(kanbanCode),
  false
);

check(
  'the shopping board asks with the application dialog',
  /<ConfirmDialog/.test(kanban),
  true
);

const settingsPath = join(here, '..', '..', '..', 'pages', 'Settings.jsx');
const settings = readFileSync(settingsPath, 'utf8');

const settingsCode = settings.replace(/\/\*[\s\S]*?\*\//g, '');

check(
  'the settings page does not use the browser dialog',
  /window\.confirm/.test(settingsCode),
  false
);

check(
  'the settings page asks with the application dialog',
  /<ConfirmDialog/.test(settings),
  true
);

// The word that has to be typed is still asked for. That is the one
// that really protects the data, and taking it away would be a
// change in behaviour, not an improvement.
check(
  'the word that has to be typed is still asked for',
  /confirm_prompt/.test(settings),
  true
);

check(
  'the word that has to be typed is still checked',
  /toUpperCase\(\) !== word\.toUpperCase\(\)/.test(settings),
  true
);

// ---------------------------------------------------------------------------

console.log(`confirmDialog: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
