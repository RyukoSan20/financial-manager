/**
 * Which version of a thing this reader sees.
 *
 * The point of an experiment is to find out which of two ways of doing
 * something is better. The point of doing it *here*, on the reader's
 * own machine, is that nothing is sent anywhere: the choice is made
 * from a number that is already on this device, and it stays on this
 * device.
 *
 * So:
 *
 * - The cohort is decided by hashing something that is the same for
 *   the same reader every time. It is not a random number that is
 *   drawn once, because a reader who saw one version yesterday and
 *   another today cannot be counted in either group.
 * - The assignment is written down in the browser, so the reader sees
 *   the same version on every visit, and so a reader can be put back
 *   on the old version.
 * - Nothing leaves the device. There is no tracker, no beacon, and
 *   no request.
 *
 * The metrics are counted the same way: they are written down here and
 * nowhere else.
 *
 * The experiments themselves are named in EXPERIMENTS. Each one says
 * what the two versions are and how the readers are split between
 * them. An experiment that is not named there does not run.
 */

/** Where the assignments and the counts are kept. */
const STORAGE_KEY = 'abExperiments';

/**
 * The experiments.
 *
 * `variants` names the versions. `weight` is how the readers are
 * split: 0.5 means half see each.
 *
 * The bucket is decided by hashing the reader's key together with the
 * name of the experiment, so the same reader lands in the same bucket
 * for every experiment, and the split is even.
 */
export const EXPERIMENTS = {
  /**
   * The budget page: the ordinary form, or the instant recipe.
   */
  exp_budget_wizard: {
    variants: ['control', 'recipe'],
    weight: 0.5,
    description: 'The ordinary budget form against the instant recipe.',
  },
  /**
   * An empty page: plain words, or the mascot and the second action.
   */
  exp_empty_state: {
    variants: ['control', 'honest'],
    weight: 0.5,
    description: 'Plain empty text against the honest empty state.',
  },
};

/**
 * A number that is the same for the same text, every time.
 *
 * This is the FNV-1a hash. It is not a cryptographic hash and does not
 * need to be: it only has to spread the readers out evenly and give
 * the same reader the same answer.
 */
export function hashString(text) {
  let hash = 0x811c9dc5;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    // The multiply is done with a shift, because a multiply by 16777619
    // overflows a 32 bit number and JavaScript's bitwise operators work
    // on 32 bits.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The bucket a reader falls into, from 0 to 1.
 *
 * The reader's key and the name of the experiment are hashed together,
 * so the answer is the same for the same reader and the same
 * experiment, and different between experiments.
 */
export function bucketFor(readerKey, experimentName) {
  const hash = hashString(`${experimentName}:${readerKey ?? ''}`);
  return (hash % 10000) / 10000;
}

/**
 * The storage to use. The browser gives one; a test gives another.
 */
function storageOf(custom) {
  if (custom) return custom;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * What is written down.
 */
function readState(storage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * The version this reader sees.
 *
 * The name of the experiment and the key of the reader are what decide
 * it. The answer is written down the first time, so the reader sees
 * the same version on every visit even if the hash is changed later.
 *
 * An experiment that is not named does not run, and the reader is put
 * on the first version, which is the one that was there before.
 */
export function getVariant(experimentName, readerKey, storage = storageOf()) {
  const experiment = EXPERIMENTS[experimentName];
  if (!experiment) return null;

  const state = readState(storage);
  const key = readerKey ?? '';

  // Already decided for this reader.
  const decided = state[experimentName];
  if (decided && decided.for === key && experiment.variants.includes(decided.variant)) {
    return decided.variant;
  }

  // Not decided yet: the bucket decides.
  const bucket = bucketFor(key, experimentName);
  const index = Math.floor(bucket / experiment.weight);

  let variant;
  if (index >= experiment.variants.length) {
    // The last bucket, when the split does not divide evenly.
    variant = experiment.variants[experiment.variants.length - 1];
  } else {
    variant = experiment.variants[index];
  }

  state[experimentName] = { variant, for: key };
  writeState(storage, state);
  return variant;
}

/**
 * Is this reader on this version of this experiment?
 */
export function isVariant(experimentName, variant, readerKey, storage = storageOf()) {
  return getVariant(experimentName, readerKey, storage) === variant;
}

/**
 * Put the reader on a version by hand.
 *
 * The way back, and the way a reader who has been shown the wrong
 * version is put right.
 */
export function setVariant(experimentName, variant, storage = storageOf(), reader = readerKey(storage)) {
  const experiment = EXPERIMENTS[experimentName];
  if (!experiment) return false;
  if (!experiment.variants.includes(variant)) return false;
  const state = readState(storage);
  state[experimentName] = { variant, for: reader ?? '' };
  return writeState(storage, state);
}

/**
 * Forget the assignments, so the buckets are worked out again.
 */
export function resetAssignments(storage = storageOf()) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Count something.
 *
 * The count is written down on this device and is not sent anywhere.
 * It is a way of asking "how many readers finished this", and the
 * answer is only good for the device it was counted on.
 */
export function trackEvent(experimentName, event, storage = storageOf()) {
  if (!storage) return false;
  const state = readState(storage);
  const bucket = state.__events || (state.__events = {});
  const key = `${experimentName}:${event}`;
  bucket[key] = (bucket[key] || 0) + 1;
  return writeState(storage, state);
}

/**
 * The counts, so the settings page can show them.
 */
export function getCounts(storage = storageOf()) {
  const state = readState(storage);
  return { ...(state.__events || {}) };
}

/**
 * The assignments, so the settings page can show them.
 */
export function getAssignments(storage = storageOf()) {
  const state = readState(storage);
  const result = {};
  for (const name of Object.keys(EXPERIMENTS)) {
    const decided = state[name];
    result[name] = decided && decided.variant ? decided.variant : null;
  }
  return result;
}

/**
 * The key that identifies this reader on this device.
 *
 * It is made once and kept. It is not a name, an address, or
 * anything about the reader: it is a random string that says nothing
 * except "the same reader".
 */
export const READER_KEY_NAME = 'abReaderKey';

export function readerKey(storage = storageOf()) {
  if (!storage) return 'anonymous';
  try {
    const existing = storage.getItem(READER_KEY_NAME);
    if (existing) return existing;
    const random =
      globalThis.crypto && globalThis.crypto.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    storage.setItem(READER_KEY_NAME, random);
    return random;
  } catch {
    return 'anonymous';
  }
}

export default {
  EXPERIMENTS,
  hashString,
  bucketFor,
  getVariant,
  isVariant,
  setVariant,
  resetAssignments,
  trackEvent,
  getCounts,
  getAssignments,
  readerKey,
};
