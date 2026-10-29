/**
 * The empty page comes in two versions, and the reader keeps the one
 * they were given.
 *
 * Run with: node src/components/common/__tests__/honestEmptyState.test.js
 *
 * The experiment decides which version of an empty page a reader sees.
 * Two things have to hold for that to mean anything:
 *
 * - the same reader sees the same version every time, so a reader who
 *   has seen the plain version keeps seeing it;
 * - the two versions really are different, so the comparison is a
 *   comparison and not two copies of one thing.
 *
 * The second point is the one that is easy to get wrong. A component
 * that reads an experiment and then ignores the answer looks exactly
 * like one that does not.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const componentPath = join(here, '..', 'HonestEmptyState.jsx');
const source = readFileSync(componentPath, 'utf8');

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
// The component reads the experiment
// ---------------------------------------------------------------------------

check(
  'the component reads the empty state experiment',
  /getVariant\(\s*'exp_empty_state'/.test(source),
  true
);

check(
  'the component decides the version once, not on every render',
  /useState\(\(\)\s*=>\s*getVariant/.test(source),
  true
);

check(
  'the component names both versions',
  /honest-empty--plain/.test(source),
  true
);

// ---------------------------------------------------------------------------
// The two versions are different
// ---------------------------------------------------------------------------

// The plain version has no picture in it. The mascot is the difference
// between the two versions, so if the plain one grew a mascot there
// would be nothing left to compare.
//
// The plain branch is the one that returns first, so it is the slice
// between the plain marker and the honest one that comes after it.
const plainStart = source.indexOf('honest-empty--plain');
const honestStart = source.indexOf('honest-empty__mascot');
const plainBranch = source.slice(plainStart, honestStart);

check(
  'the plain version has no mascot in it',
  /FinBuddyMascot/.test(plainBranch),
  false
);

// The word appears twice in the plain branch: once where the button
// is asked for, and once where it is handled. What matters is that
// there is one button, and that the second action is not there.
check(
  'the plain version has one button',
  (plainBranch.match(/<button/g) || []).length,
  1
);

check(
  'the plain version does not show the second action',
  /showSecondary/.test(plainBranch),
  false
);

// The honest version has the picture and the second action.
const honestBranch = source.slice(source.lastIndexOf('return ('));

check(
  'the honest version has the mascot in it',
  /FinBuddyMascot/.test(honestBranch),
  true
);

check(
  'the honest version has the second action',
  /showSecondary/.test(honestBranch),
  true
);

// ---------------------------------------------------------------------------
// Both versions say the same words
// ---------------------------------------------------------------------------

// The two versions have to be saying the same thing, or the
// experiment would be measuring a change of wording rather than a
// change of layout.
check(
  'both versions show the title',
  (source.match(/\{titleText\}/g) || []).length,
  2
);

check(
  'both versions show the description',
  (source.match(/\{descriptionText\}/g) || []).length,
  2
);

check(
  'both versions show the hint',
  (source.match(/\{hintText\}/g) || []).length,
  2
);

check(
  'both versions show the primary action',
  (source.match(/\{primaryText\}/g) || []).length,
  2
);

// ---------------------------------------------------------------------------
// The experiment is the one that was registered
// ---------------------------------------------------------------------------

const abSource = readFileSync(
  join(here, '..', '..', '..', 'utils', 'abTesting.js'),
  'utf8'
);

check(
  'the experiment the component reads is a registered one',
  /exp_empty_state:\s*\{/.test(abSource),
  true
);

check(
  'the experiment has the two versions the component draws',
  /variants:\s*\['control',\s*'honest'\]/.test(abSource),
  true
);

// ---------------------------------------------------------------------------

console.log(`honestEmptyState: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(failures.join('\n\n'));
  process.exit(1);
}
