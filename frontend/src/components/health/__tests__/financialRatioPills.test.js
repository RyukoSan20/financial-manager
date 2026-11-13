/**
 * The ratio cards: value and target, never the same string.
 *
 * "Ta-2.0% >= 20%" and "58.8 bulanTarget >= 6 bulan" were two
 * numbers mashed into one unreadable string, because the value and
 * the benchmark used to share a line with nothing between them on a
 * narrow screen.
 *
 * Each ratio is now its own card with three separate rows - name and
 * status, then value and target each in their own container, then a
 * progress bar with a target marker - so the value and the target
 * can never be read as one concatenated string. These checks are at
 * the level of the component's source, in the style the rest of this
 * app's component tests use (no jsdom/testing-library is wired in).
 *
 * Run with: node src/components/health/__tests__/financialRatioPills.test.js
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

console.log('financial ratio pills: value and target never collide');

const pills = read('src/components/health/FinancialRatioPills.jsx');

// ---------------------------------------------------------------------
// The three-row card structure
// ---------------------------------------------------------------------

check(
  'row 1 (name + status) is its own flex container',
  /data-testid="ratio-row-head"/.test(pills)
);

check(
  'row 2 (value + target) is its own flex container, separate from row 1',
  /data-testid="ratio-row-value"/.test(pills)
);

check(
  'row 3 (the progress bar) is its own container, separate from row 2',
  /data-testid="ratio-row-bar"/.test(pills)
);

// ---------------------------------------------------------------------
// The value and the benchmark are two different elements
// ---------------------------------------------------------------------

check(
  'the value is drawn by CountUpNumber in its own <p>, not string-concatenated with the target',
  /<p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums[^"]*">\s*<CountUpNumber/.test(pills)
);

check(
  'the benchmark badge is a separate <span>, with its own data-testid',
  /data-testid="ratio-benchmark"/.test(pills)
);

check(
  'the value and the benchmark badge are never built as one template string',
  // A regression would look like `${value}${benchmark}` or
  // `${value} ${benchmarkLabel}` inside a single text node. Neither
  // pattern exists: the two are always separate JSX children.
  !/\{value\}\{benchmarkLabel\}/.test(pills) && !/\{value\}\s*\{benchmarkLabel\}/.test(pills)
);

check(
  'the target marker on the bar is a distinct element from the fill',
  /data-testid="ratio-target-marker"/.test(pills) &&
    /motion-scrub-bar__fill/.test(pills)
);

// ---------------------------------------------------------------------
// No font-serif or font-mono leaking into the ratio card
// ---------------------------------------------------------------------

check(
  'the ratio card never uses font-serif or font-mono',
  !/font-serif/.test(pills) && !/font-mono/.test(pills)
);

check(
  'the ratio name uses the overline hierarchy (bold, uppercase, tracked)',
  /text-xs font-bold uppercase tracking-\[0\.06em\]/.test(pills)
);

// ---------------------------------------------------------------------
// The three ratios are all rendered as cards
// ---------------------------------------------------------------------

check(
  'all three ratios (savings, emergency fund, DSR) are rendered as RatioCard',
  (pills.match(/<RatioCard/g) || []).length === 3
);

check(
  'the status mark is still the server\'s own verdict, not re-derived from thresholds',
  /savingsRatio\?\.status/.test(pills) &&
    /emergencyFund\?\.status/.test(pills) &&
    /dsrRatio\?\.status/.test(pills)
);

// ---------------------------------------------------------------------
// The bar is drawn from the server's thresholds, not a second copy
// ---------------------------------------------------------------------
//
// The bar used to divide by 20, by 6 and by 30 to work out how full
// it was - a second copy of thresholds the server already owns, and
// the copy was already wrong: the server says the emergency fund's
// ideal_min is 3, not 6. So the geometry now comes from the
// ideal_min / ideal_max the server sends with each ratio.

check(
  'the bar geometry reads the thresholds the server sent',
  /ideal_min/.test(pills) && /ideal_max/.test(pills),
  'the pin and the fill must come from the server\'s own thresholds'
);

check(
  'no threshold is hardcoded as a divisor in the browser any more',
  !/\/\s*20\s*\)/.test(pills) &&
    !/\/\s*6\s*\)/.test(pills) &&
    !/\/\s*30\s*\)/.test(pills),
  'dividing by a literal threshold is the second copy that drifts'
);

check(
  'every ratio gets its geometry from the same helper',
  (pills.match(/\{\.\.\.barGeometry\(/g) || []).length === 3,
  'all three cards must derive the bar the same way'
);

check(
  'a ratio with no thresholds draws no invented target pin',
  /return \{ progressPercent: 0, markerPercent: null \}/.test(pills),
  'a pin with nothing behind it would be a made-up target'
);

check(
  'a "at most" target (DSR) is told apart from a "at least" target',
  /isCeiling/.test(pills),
  'more savings is better; more DSR is worse - the bar cannot treat them alike'
);

// The server has to actually send what the component now reads.
const router = read('../backend/app/modules/ai_advisor/health_coach/router.py');

check(
  'the health-coach router sends ideal_min and ideal_max for every ratio',
  (router.match(/"ideal_min":/g) || []).length >= 4 &&
    (router.match(/"ideal_max":/g) || []).length >= 4,
  'the component reads these; the API must send them'
);

// ---------------------------------------------------------------------
// CuteWellnessBento and HealthCoach stay free of serif/mono too
// ---------------------------------------------------------------------

const bento = read('src/components/health/CuteWellnessBento.jsx');
const healthPage = read('src/pages/HealthCoach.jsx');

check(
  'CuteWellnessBento never uses font-serif or font-mono',
  !/font-serif/.test(bento) && !/font-mono/.test(bento)
);

check(
  'HealthCoach.jsx never uses font-serif or font-mono',
  !/font-serif/.test(healthPage) && !/font-mono/.test(healthPage)
);

check(
  'the score hero draws an interactive radial gauge, not a static drawing',
  /RadialGauge/.test(bento) && /strokeDashoffset/.test(bento)
);

check(
  'the gauge animates over 800ms with the reference easing curve',
  /800ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/.test(bento)
);

console.log('');
console.log(`financial ratio pills: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
