/**
 * The switches.
 *
 * A switch turns a piece of the interface on or off without changing
 * anything else. Every switch here is off unless the build turns it
 * on, so a reader sees the same thing they saw before unless the
 * switch is deliberately opened.
 *
 * There are two kinds:
 *
 * - **Build switches.** Read from the environment at build time
 *   (`VITE_UI_POLISH=1 npm run build`). They are fixed for the life of
 *   the build, so the whole bundle agrees about them.
 *
 * - **Reader switches.** Stored in the browser, so a reader can try
 *   something and put it back. They are off to begin with.
 *
 * Nothing here changes the appearance on its own. A switch that is
 * off means the old markup is used, exactly as before.
 */

/**
 * The build switches.
 *
 * `VITE_UI_POLISH` turns on the tidied-up headers and the consistent
 * icon family. It is off by default, so a reader who has not asked
 * for it sees no difference.
 */
const BUILD_FLAGS = {
  UI_POLISH: 'VITE_UI_POLISH',
};

/**
 * The reader switches.
 *
 * These are off to begin with. They are stored under one key, so the
 * whole set can be cleared in one go.
 */
const READER_FLAGS = {
  /** The grouped sidebar, alongside the old one. */
  NAV_V2: 'navV2',
  /** One primary add action on each page. */
  SINGLE_ADD: 'singleAdd',
  /** The merchant page behind an advanced-features setting. */
  ADVANCED_FEATURES: 'advancedFeatures',
  /** Reminders, which send nothing until they are turned on. */
  REMINDERS: 'reminders',
  /**
   * The richer mascot drawing, made by the asset generator.
   *
   * Off by default. The inline drawing is the one that ships, because
   * it takes the colour of what it sits on and never waits for a
   * file. This one has more in it, so it is worth turning on to see
   * whether it is worth shipping.
   */
  MASCOT_ART: 'mascotArt',
};

/** Where the reader switches are kept. */
const STORAGE_KEY = 'featureFlags';

/**
 * Is a build switch on?
 *
 * The environment is read once, at load. Everything in the bundle
 * therefore agrees about the answer, which a switch read from storage
 * on each render would not.
 */
export function buildFlag(name) {
  const key = BUILD_FLAGS[name];
  if (!key) return false;
  // Outside the bundler there is no environment to read, so the
  // switch is off. This is the case in the tests, and in any tool
  // that loads the module directly.
  const env = import.meta.env || {};
  const raw = env[key];
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

/**
 * Is a reader switch on?
 *
 * A switch that has never been touched is off. One that has been
 * turned off is also off, and stays off.
 */
export function readerFlag(name) {
  const key = READER_FLAGS[name];
  if (!key) return false;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed[key]);
  } catch (err) {
    // A broken value is treated as off, so the interface still works.
    return false;
  }
}

/**
 * Turn a reader switch on or off.
 *
 * The answer is written down, so it survives a reload. An unknown
 * switch name is refused rather than written, so a typo does not
 * quietly become a setting that does nothing.
 */
export function setReaderFlag(name, value) {
  const key = READER_FLAGS[name];
  if (!key) return false;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (value) {
      parsed[key] = true;
    } else {
      delete parsed[key];
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Turn every reader switch off.
 *
 * A way back to how it was, in one step.
 */
export function clearReaderFlags() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    /* storage unavailable */
  }
}

/**
 * The switches, as they stand.
 *
 * Used by the settings page to show what is on and off.
 */
export function allFlags() {
  const result = {};
  for (const name of Object.keys(BUILD_FLAGS)) {
    result[name] = buildFlag(name);
  }
  for (const name of Object.keys(READER_FLAGS)) {
    result[name] = readerFlag(name);
  }
  return result;
}

export const FLAG_NAMES = {
  BUILD: BUILD_FLAGS,
  READER: READER_FLAGS,
};

export default {
  buildFlag,
  readerFlag,
  setReaderFlag,
  clearReaderFlags,
  allFlags,
  FLAG_NAMES,
};
