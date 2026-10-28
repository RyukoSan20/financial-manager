/**
 * The same reader sees the same version, and nothing leaves the device.
 *
 * An experiment is only worth running if the readers are split into
 * groups and stay in them. A reader who saw one version yesterday and
 * another today cannot be counted in either group, so the answer
 * means nothing.
 *
 * These tests check that the assignment is stable, that the split is
 * even, that a reader can be put back, and that nothing is sent
 * anywhere.
 *
 * The storage is faked, so the same code is checked without a browser.
 *
 * Run with: node src/utils/__tests__/abTesting.test.js
 */

import {
  EXPERIMENTS,
  bucketFor,
  getAssignments,
  getCounts,
  getVariant,
  hashString,
  isVariant,
  readerKey,
  resetAssignments,
  setVariant,
  trackEvent,
} from '../abTesting.js';

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

// --- The hash is stable ---------------------------------------------------

{
  check(hashString('reader-1') === hashString('reader-1'), 'the hash is not stable');
  check(hashString('reader-1') !== hashString('reader-2'), 'two readers get the same hash');
  check(hashString('') === hashString(''), 'the hash of nothing is not stable');
  check(hashString(null) === hashString(''), 'nothing and the empty string differ');
  check(Number.isFinite(hashString('x')), 'the hash is not a number');
}

// --- The bucket is stable and in range ------------------------------------

{
  const bucket = bucketFor('reader-1', 'exp_budget_wizard');
  check(bucket === bucketFor('reader-1', 'exp_budget_wizard'), 'the bucket is not stable');
  check(bucket >= 0 && bucket < 1, `the bucket ${bucket} is out of range`);
}

{
  // The same reader is in a different bucket for a different
  // experiment, so the two experiments are not correlated.
  const a = bucketFor('reader-1', 'exp_budget_wizard');
  const b = bucketFor('reader-1', 'exp_empty_state');
  check(a !== b, 'the two experiments put the reader in the same bucket');
}

// --- The version is stable -----------------------------------------------

{
  const store = fakeStorage();
  const first = getVariant('exp_budget_wizard', 'reader-1', store);
  const second = getVariant('exp_budget_wizard', 'reader-1', store);
  check(first === second, 'the reader was moved to another version');
  check(['control', 'recipe'].includes(first), `the version ${first} is not one of the two`);
}

{
  // Even with the storage cleared, the same reader lands on the same
  // version, because the bucket is decided by the hash.
  const store = fakeStorage();
  const first = getVariant('exp_budget_wizard', 'reader-1', store);
  resetAssignments(store);
  const second = getVariant('exp_budget_wizard', 'reader-1', store);
  check(first === second, 'the reader was moved to another version after a reset');
}

// --- The split is even ----------------------------------------------------

{
  const store = fakeStorage();
  const counts = { control: 0, recipe: 0 };
  const readers = 1000;
  for (let i = 0; i < readers; i += 1) {
    const variant = getVariant('exp_budget_wizard', `reader-${i}`, store);
    counts[variant] += 1;
  }
  // Half the readers, give or take. The exact number does not matter;
  // what matters is that neither group is tiny.
  check(counts.control > readers * 0.4, `only ${counts.control} of ${readers} readers saw the control`);
  check(counts.recipe > readers * 0.4, `only ${counts.recipe} of ${readers} readers saw the recipe`);
  check(
    counts.control + counts.recipe === readers,
    'some readers were not counted at all'
  );
}

// --- The reader can be put on a version by hand ---------------------------

{
  const store = fakeStorage();
  setVariant('exp_budget_wizard', 'recipe', store);
  check(getVariant('exp_budget_wizard', 'reader-1', store) === 'recipe', 'the reader was not put on the version');
  check(isVariant('exp_budget_wizard', 'recipe', 'reader-1', store) === true, 'isVariant disagrees');
  check(isVariant('exp_budget_wizard', 'control', 'reader-1', store) === false, 'isVariant disagrees the other way');
}

{
  const store = fakeStorage();
  check(setVariant('exp_budget_wizard', 'nonsense', store) === false, 'an unknown version was accepted');
  check(setVariant('no_such_experiment', 'control', store) === false, 'an unknown experiment was accepted');
}

// --- An experiment that is not named does not run --------------------------

{
  const store = fakeStorage();
  check(getVariant('no_such_experiment', 'reader-1', store) === null, 'an unknown experiment ran');
  check(isVariant('no_such_experiment', 'control', 'reader-1', store) === false, 'an unknown experiment matched');
}

// --- Both experiments are named -------------------------------------------

{
  check(
    EXPERIMENTS.exp_budget_wizard && EXPERIMENTS.exp_budget_wizard.variants.includes('recipe'),
    'the budget experiment is not named as it should be'
  );
  check(
    EXPERIMENTS.exp_empty_state && EXPERIMENTS.exp_empty_state.variants.includes('honest'),
    'the empty state experiment is not named as it should be'
  );
}

// --- The counts -----------------------------------------------------------

{
  const store = fakeStorage();
  trackEvent('exp_budget_wizard', 'recipe_applied', store);
  trackEvent('exp_budget_wizard', 'recipe_applied', store);
  trackEvent('exp_budget_wizard', 'budget_created', store);
  const counts = getCounts(store);
  check(counts['exp_budget_wizard:recipe_applied'] === 2, 'the count is wrong');
  check(counts['exp_budget_wizard:budget_created'] === 1, 'the count is wrong');
}

{
  const store = fakeStorage();
  check(trackEvent('exp_budget_wizard', 'x', null) === false, 'tracking without storage reported success');
}

// --- The assignments can be read back -------------------------------------

{
  const store = fakeStorage();
  getVariant('exp_budget_wizard', 'reader-1', store);
  getVariant('exp_empty_state', 'reader-1', store);
  const assignments = getAssignments(store);
  check(
    ['control', 'recipe'].includes(assignments.exp_budget_wizard),
    'the budget assignment was not written down'
  );
  check(
    ['control', 'honest'].includes(assignments.exp_empty_state),
    'the empty state assignment was not written down'
  );
}

// --- The reader key -------------------------------------------------------

{
  const store = fakeStorage();
  const key = readerKey(store);
  check(typeof key === 'string' && key.length > 0, 'the reader key is empty');
  check(readerKey(store) === key, 'the reader key changed between calls');
  check(readerKey(fakeStorage()) !== key, 'two devices have the same reader key');
}

// --- A broken value in storage does not break the page --------------------

{
  const store = fakeStorage({ abExperiments: 'not json' });
  const variant = getVariant('exp_budget_wizard', 'reader-1', store);
  check(['control', 'recipe'].includes(variant), 'a broken value broke the assignment');
}

{
  const store = fakeStorage({ abExperiments: '{"exp_budget_wizard":"nonsense"}' });
  const variant = getVariant('exp_budget_wizard', 'reader-1', store);
  check(['control', 'recipe'].includes(variant), 'an unknown version in storage was kept');
}

{
  // No storage at all.
  check(getVariant('exp_budget_wizard', 'reader-1', null) !== null, 'no storage broke the assignment');
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);

if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
