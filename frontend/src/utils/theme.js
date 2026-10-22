/**
 * Theme controller - prevents the "forced dark mode" contrast breakage.
 *
 * The problem this solves:
 *   1. Chrome/Edge "Force Dark Mode", Android "Force Dark", and various
 *      browser extensions repaint our colors behind our back. Light-mode
 *      pages end up with dark backgrounds but our light-theme text colors,
 *      which makes text unreadable.
 *   2. On mobile the OS theme was silently pushing the whole app dark,
 *      even when the user had explicitly chosen light.
 *
 * Strategy:
 *   - Three explicit modes: 'light', 'dark' and 'system'.
 *     'light' and 'dark' are hard user choices and always win over the OS.
 *     'system' hands control back to `prefers-color-scheme` and keeps
 *     following it as the OS setting changes.
 *   - `color-scheme` is declared on the root element so the browser's own
 *     form controls, scrollbars and canvas background follow our theme.
 *   - We opt out of the automatic darkening by explicitly setting
 *     background/text colors on html and body, which stops the "force
 *     dark" heuristics from having anything to repaint.
 *   - `forced-color-adjust: none` disables Windows High Contrast forced
 *     color inversion for our own chrome while keeping it available to
 *     genuine accessibility needs via the `forced-colors` media query.
 *   - An inline bootstrap script in index.html applies the theme before
 *     first paint, so there is never a flash of the wrong theme.
 *
 * The stored value is always one of the strings 'light' | 'dark' | 'system'.
 * Legacy values (a JSON object, or the old 'theme' key) are migrated on
 * read so an old session never gets stuck in the wrong theme.
 */

export const THEME_KEY = 'finmanager-theme';
export const THEME_STORAGE_KEY = 'theme'; // legacy key, kept for migration

export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';
export const THEME_SYSTEM = 'system';

export const THEME_MODES = [THEME_LIGHT, THEME_DARK, THEME_SYSTEM];

/**
 * Read the stored preference (the user's *mode*, not the resolved theme).
 * Returns 'light' | 'dark' | 'system' | null (no choice stored yet).
 */
export function readStoredTheme() {
  if (typeof window === 'undefined') return null;
  try {
    let value = localStorage.getItem(THEME_KEY);
    if (value === null) value = localStorage.getItem(THEME_STORAGE_KEY);

    if (value === null || value === undefined) return null;

    // Older builds stored a JSON blob: {"preference":"light","source":"user"}
    if (typeof value === 'string' && value.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        const pref = parsed?.preference ?? parsed?.theme ?? parsed?.value;
        value = THEME_MODES.includes(pref) ? pref : null;
      } catch (err) {
        value = null;
      }
    }

    if (value === THEME_LIGHT || value === THEME_DARK || value === THEME_SYSTEM) {
      return value;
    }
  } catch (err) {
    // Private mode / storage disabled - fall through to system preference.
  }
  return null;
}

/**
 * Persist the preference. Passing 'system' stores it explicitly so the
 * app knows the user wants to follow the OS, and the OS watcher stays
 * active.
 */
export function writeStoredTheme(mode) {
  if (typeof window === 'undefined') return;
  try {
    const value = THEME_MODES.includes(mode) ? mode : THEME_LIGHT;
    localStorage.setItem(THEME_KEY, value);
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (err) {
    // Storage unavailable - the theme still applies for this session.
  }
}

/**
 * The system preference, used when the mode is 'system' or when the user
 * has never made a choice.
 */
export function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return THEME_LIGHT;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEME_DARK
      : THEME_LIGHT;
  } catch (err) {
    return THEME_LIGHT;
  }
}

/**
 * Resolve the theme that should actually be applied right now.
 * An explicit 'light' or 'dark' choice always wins over the OS preference.
 */
export function resolveTheme() {
  const stored = readStoredTheme();
  if (stored === THEME_LIGHT || stored === THEME_DARK) return stored;
  // 'system' or no choice -> follow the OS.
  return getSystemTheme();
}

/**
 * Apply the theme to the document root.
 *
 * The `data-theme` attribute gives our CSS a stable hook, and the `dark`
 * class keeps Tailwind's `dark:` variants working.
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === THEME_DARK;

  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', isDark ? THEME_DARK : THEME_LIGHT);
  // Also expose the preference mode so CSS can react to "system" if needed.
  root.setAttribute('data-theme-mode', readStoredTheme() || THEME_SYSTEM);

  // Tell the browser which color scheme our UI is authored for. This drives
  // native widgets (date pickers, scrollbars, form controls) and, crucially,
  // makes the browser stop applying its own automatic darkening to our page.
  root.style.colorScheme = isDark ? THEME_DARK : THEME_LIGHT;

  // Hard-set the base colors. A page with an explicit background and text
  // color is much harder for "force dark" heuristics to invert than one that
  // inherits them from the UA stylesheet.
  root.style.backgroundColor = isDark ? '#111827' : '#f9fafb';
  root.style.color = isDark ? '#f3f4f6' : '#111827';

  // Update the browser chrome color on mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#111827' : '#3b82f6');
  }
}

/**
 * Watch the OS preference.
 *
 * The OS only gets to change the theme when the user's mode is 'system'
 * (or when they have never chosen). An explicit 'light'/'dark' choice
 * must never be overridden.
 */
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  let media;
  try {
    media = window.matchMedia('(prefers-color-scheme: dark)');
  } catch (err) {
    return () => {};
  }

  const handler = (event) => {
    const stored = readStoredTheme();
    // Ignore OS changes when the user made an explicit light/dark choice.
    if (stored === THEME_LIGHT || stored === THEME_DARK) return;
    onChange(event.matches ? THEME_DARK : THEME_LIGHT);
  };

  if (media.addEventListener) {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }
  // Safari < 14
  media.addListener(handler);
  return () => media.removeListener(handler);
}
