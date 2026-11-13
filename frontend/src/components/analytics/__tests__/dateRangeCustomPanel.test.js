/**
 * The Custom Date Range Studio.
 *
 * "Rentang Tanggal Kustom" used to be a button that did nothing
 * visible: no calendar, no date boxes, nothing a reader could click
 * on to choose a fortnight the presets did not cover.
 *
 * These checks are at the level of the component's own source and
 * structure, in the style the rest of this app's component tests
 * use (no jsdom/testing-library is wired in) - they check that the
 * studio panel, its inputs, its quick-jump chips and its apply
 * button are really there, pre-filled, and wired to call `onChange`
 * with a complete `{ preset: 'custom', start, end }` choice.
 *
 * Run with: node src/components/analytics/__tests__/dateRangeCustomPanel.test.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
    console.log(`FAIL  ${name}`);
  }
};

console.log('the custom date range studio');

const bar = read('src/components/analytics/DateRangeFilterBar.jsx');
const dateRange = read('src/utils/dateRange.js');

// ---------------------------------------------------------------------
// Clicking "custom" opens the studio, pre-filled
// ---------------------------------------------------------------------

check(
  'clicking a preset calls choosePreset, which opens the studio for "custom"',
  /choosePreset = \(preset\) => \{/.test(bar) && /setOpen\(true\)/.test(bar),
  'the panel must actually open, not stay collapsed'
);

check(
  'the custom choice is never left with blank dates',
  /const start = choice\.start \|\| resolved\.start \|\| toIsoDate\(new Date\(\)\)/.test(bar) &&
    /const end = choice\.end \|\| resolved\.end \|\| toIsoDate\(new Date\(\)\)/.test(bar),
  'both dates must have a fallback so the boxes are never empty'
);

check(
  'opening custom tells the parent the choice right away',
  /onChange\?\.\(\{ \.\.\.choice, preset: 'custom', start, end \}\)/.test(bar),
  'the parent must hear about the pre-filled range as soon as the studio opens'
);

// ---------------------------------------------------------------------
// The studio panel itself: both inputs and the apply button
// ---------------------------------------------------------------------

check(
  'the studio panel renders when open',
  /data-testid="custom-range-panel"/.test(bar)
);

check(
  'the studio has a "from" date input',
  /data-testid="date-range-start"/.test(bar) && /type="date"/.test(bar)
);

check(
  'the studio has a "to" date input',
  /data-testid="date-range-end"/.test(bar)
);

check(
  'the studio has an Apply button that calls applyCustom',
  /data-testid="date-range-apply"/.test(bar) && /onClick=\{applyCustom\}/.test(bar)
);

check(
  'applying sends a complete custom choice back to the parent',
  /onChange\?\.\(\{ \.\.\.choice, preset: 'custom', start, end \}\);/.test(bar),
  'the apply button must hand back { preset: "custom", start, end }'
);

check(
  'the studio has a Reset button',
  /data-testid="date-range-reset"/.test(bar) && /resetCustom/.test(bar)
);

// ---------------------------------------------------------------------
// The quick-jump chips
// ---------------------------------------------------------------------

for (const key of ['month_start', '14d', '30d', 'year_start']) {
  check(
    `the studio has the "${key}" quick-jump chip`,
    bar.includes(`data-testid={\`date-range-jump-${key}\`}`) || bar.includes(`key: '${key}'`)
  );
}

check(
  'each quick-jump chip sets the draft start date',
  /applyJump = \(jump\) => \{\s*setDraftStart\(jump\.date\(\)\);/.test(bar)
);

// ---------------------------------------------------------------------
// The active-range badge and the emoji-free, high-contrast pills
// ---------------------------------------------------------------------

check(
  'the active range is shown as a live badge, not left for the reader to infer',
  /data-testid="date-range-label"/.test(bar) && /date_range\.active_label/.test(bar)
);

check(
  'the custom pill carries a Lucide calendar icon, not the OS emoji',
  /<Calendar className="w-3 h-3"/.test(bar) && !bar.includes('📅') && !bar.includes('📆')
);

check(
  'the active preset pill gets a high-contrast fill in both themes',
  /background: '#52796F', borderColor: '#52796F', color: '#fff'/.test(bar)
);

check(
  'the filter pills use the X-style spring micro-interaction',
  /motion-x-spring/.test(bar)
);

// ---------------------------------------------------------------------
// dateRange.js: toIsoDate exists and is exported, for the quick jumps
// ---------------------------------------------------------------------

check(
  'toIsoDate is exported for the quick-jump chips to use',
  /export function toIsoDate/.test(dateRange) && /toIsoDate/.test(bar)
);

console.log('');
console.log(`date range custom panel: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
