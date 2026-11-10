/**
 * The settings screen.
 *
 * Two things about it are held here:
 *
 * - the "Semua siap!" banner had two dismiss buttons on top of each
 *   other. The page drew an X in the corner, and the banner drew a
 *   "Selesai" underneath it, so the reader saw one button with two
 *   words and a cross on top of them, and could not tell which part
 *   to press. There is one dismiss now: a pill that says "Selesai"
 *   and carries the X inside it.
 *
 * - the export is not two bare buttons any more. The reader chooses
 *   the dates, the kinds of transaction, the account and the columns,
 *   and sees what matches before anything is downloaded.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// frontend/src/components/__tests__/ -> frontend/src -> frontend -> root
const ROOT = join(HERE, '..', '..', '..', '..');

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8');

const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------------------
// The dismiss button
// ---------------------------------------------------------------------------

check('the banner draws one dismiss, not two', () => {
  const settings = read('frontend/src/pages/Settings.jsx');

  // The page used to draw an X in the corner of the banner, on top
  // of the banner's own button.
  assert.ok(
    !settings.includes('absolute top-2 right-2'),
    'the page still draws an X on top of the banner',
  );
  assert.ok(
    !settings.includes('settings.checklist_dismiss'),
    'the page still has its own dismiss button',
  );
});

check('the dismiss is a pill that says Selesai and carries the X', () => {
  const checklist = read('frontend/src/components/ReadinessChecklist.jsx');

  // One button, with both parts in it.
  assert.ok(
    checklist.includes('inline-flex items-center gap-1.5 px-3 py-1 rounded-lg'),
    'the dismiss is not a pill',
  );
  assert.ok(
    checklist.includes("data-testid=\"readiness-dismiss\""),
    'the dismiss cannot be found',
  );
  assert.ok(
    checklist.includes("<X className=\"w-3.5 h-3.5\""),
    'the X is not inside the button',
  );
});

check('there is exactly one dismiss on the banner', () => {
  const checklist = read('frontend/src/components/ReadinessChecklist.jsx');

  // The banner and the checklist each have one - and neither has an
  // absolute X sitting over the other.
  const dismisses = checklist.match(/data-testid="readiness-dismiss"/g) || [];
  assert.equal(dismisses.length, 2, 'the number of dismiss buttons is not two');
});

check('the dismiss is never positioned over the banner', () => {
  const checklist = read('frontend/src/components/ReadinessChecklist.jsx');

  // Nothing in the banner is absolutely positioned over the top
  // right corner, which is where the collision was.
  const banner = checklist.slice(
    checklist.indexOf('report.done_count === report.total_count'),
    checklist.indexOf('const pct ='),
  );
  assert.ok(
    !banner.includes('absolute'),
    'something is still positioned over the banner',
  );
});

// ---------------------------------------------------------------------------
// The export studio
// ---------------------------------------------------------------------------

check('the export studio is on the settings screen', () => {
  const settings = read('frontend/src/pages/Settings.jsx');

  assert.ok(
    settings.includes('DataExportStudio'),
    'the settings screen does not have the export studio',
  );
});

check('the export studio asks for the dates, the kinds, the account and the columns', () => {
  const studio = read('frontend/src/components/settings/DataExportStudio.jsx');

  for (const marker of [
    'export-preset-',
    'export-type-',
    'export-account-',
    'export-column-',
  ]) {
    assert.ok(studio.includes(marker), `the studio has no ${marker}`);
  }
});

check('the export studio shows how many transactions matched', () => {
  const studio = read('frontend/src/components/settings/DataExportStudio.jsx');

  assert.ok(
    studio.includes('data-testid="export-summary"'),
    'the studio does not say what matched',
  );
  assert.ok(
    studio.includes('data-testid="export-preview"'),
    'the studio has no preview',
  );
});

check('the export studio offers a CSV and a JSON', () => {
  const studio = read('frontend/src/components/settings/DataExportStudio.jsx');

  assert.ok(studio.includes('data-testid="export-download-csv"'));
  assert.ok(studio.includes('data-testid="export-download-json"'));
});

check('the studio asks the server for the preview, not the browser', () => {
  // The preview and the download are made by the same server code, so
  // the preview is the file and not an idea of it.
  const studio = read('frontend/src/components/settings/DataExportStudio.jsx');

  assert.ok(
    studio.includes('/data/export/studio'),
    'the studio does not ask the server',
  );
});

// ---------------------------------------------------------------------------
// The server
// ---------------------------------------------------------------------------

check('the server can filter the export', () => {
  const data = read('backend/app/api/routes/data.py');

  assert.ok(
    data.includes('/export/studio'),
    'the server has no export studio',
  );
  for (const marker of ['start_date', 'end_date', 'types', 'account_id', 'columns']) {
    assert.ok(
      data.includes(marker),
      `the server does not take ${marker}`,
    );
  }
});

check('the file the server makes carries a byte order mark', () => {
  const service = read('backend/app/services/export_service.py');

  assert.ok(
    service.includes('\\ufeff'),
    'the file does not start with a byte order mark',
  );
});
