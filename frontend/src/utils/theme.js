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

/* ======================================================================== */
/* THE CONCEPT ENGINE                                                        */
/* ======================================================================== */
/*
 * A concept is the visual identity of the whole app: not a set of swatches
 * but a way the app is drawn - the canvas and its pattern, the card border
 * and its shadow, the shape of a badge, the way the numbers are set, and
 * how the companion reacts.
 *
 * The MODE (light / dark / system) and the ACCENT (the colour of a button)
 * stay where they were: they are the reader's own choices, and they keep
 * working on top of whichever concept is active. The concept says what the
 * app LOOKS like; the mode says whether it is drawn on a light page or a
 * dark one; the accent says which colour the buttons are.
 *
 * The concept lives in localStorage (`fm_theme_concept`) so the first paint
 * is right, in React context so every component can read it, and in the
 * account's `preferences` (`ui_concept`) so it follows the reader to
 * another device.
 *
 * It is written onto BOTH <html> and <body> as `data-theme-concept` and as
 * `.concept-<id>`, so a stylesheet can key on either, and so everything
 * that is portalled out to the body (toasts, sheets, the command bar) is
 * inside the concept as well.
 */

export const THEME_CONCEPT_KEY = 'fm_theme_concept';

/**
 * The six concepts.
 *
 * The palette of four colours is what the reader sees on the card in the
 * picker. The canvas and the ink are the two values that have to be known
 * in JavaScript, because they are written as inline styles on the root
 * element - which beat every stylesheet - so they cannot be left to the
 * stylesheet alone.
 *
 * The rest of the concept - the pattern, the border, the shadow, the
 * ornament, the way the numbers are set - is CSS, in styles/theme-concepts.css.
 */
export const THEME_CONCEPTS = {
  kawaii_bento: {
    id: 'kawaii_bento',
    labelKey: 'appearance.concept_kawaii_bento',
    descriptionKey: 'appearance.concept_kawaii_bento_desc',
    tagKey: 'appearance.concept_tag_kawaii',
    iconName: 'money_bag_yen',
    persona: 'koneko',
    lineKey: 'appearance.concept_line_kawaii_bento',
    palette: ['#F7F2E7', '#FFFDF9', '#4A3540', '#D9698F'],
    canvas: { light: '#F7F2E7', dark: '#221C1A' },
    ink: { light: '#2C221E', dark: '#F4EBE1' },
  },
  medieval_fantasy: {
    id: 'medieval_fantasy',
    labelKey: 'appearance.concept_medieval_fantasy',
    descriptionKey: 'appearance.concept_medieval_fantasy_desc',
    tagKey: 'appearance.concept_tag_fantasy',
    iconName: 'money_bag_rp',
    persona: 'kogane',
    lineKey: 'appearance.concept_line_medieval_fantasy',
    palette: ['#F3EADA', '#FBF6E8', '#C5A059', '#161B2E'],
    canvas: { light: '#F3EADA', dark: '#14121F' },
    ink: { light: '#3E2C1C', dark: '#F1E7D2' },
  },
  cyberpunk: {
    id: 'cyberpunk',
    labelKey: 'appearance.concept_cyberpunk',
    descriptionKey: 'appearance.concept_cyberpunk_desc',
    tagKey: 'appearance.concept_tag_neon',
    iconName: 'briefcase',
    persona: 'zenimaru',
    lineKey: 'appearance.concept_line_cyberpunk',
    palette: ['#070A14', '#0F1424', '#22D3EE', '#FF4FD8'],
    canvas: { light: '#E9EDF6', dark: '#070A14' },
    ink: { light: '#101527', dark: '#E6F0FF' },
  },
  corporate: {
    id: 'corporate',
    labelKey: 'appearance.concept_corporate',
    descriptionKey: 'appearance.concept_corporate_desc',
    tagKey: 'appearance.concept_tag_saas',
    iconName: 'office',
    persona: 'minori',
    lineKey: 'appearance.concept_line_corporate',
    palette: ['#F6F7F9', '#FFFFFF', '#1D4ED8', '#0F172A'],
    canvas: { light: '#F6F7F9', dark: '#0B1120' },
    ink: { light: '#0F172A', dark: '#E5E7EB' },
  },
  retro_8bit: {
    id: 'retro_8bit',
    labelKey: 'appearance.concept_retro_8bit',
    descriptionKey: 'appearance.concept_retro_8bit_desc',
    tagKey: 'appearance.concept_tag_arcade',
    iconName: 'calculator',
    persona: 'kaneru',
    lineKey: 'appearance.concept_line_retro_8bit',
    palette: ['#EDE7D6', '#FFFDF2', '#16202B', '#B33A18'],
    canvas: { light: '#EDE7D6', dark: '#101418' },
    ink: { light: '#16202B', dark: '#F2F5E9' },
  },
  cute_sankou: {
    id: 'cute_sankou',
    labelKey: 'appearance.concept_cute_sankou',
    descriptionKey: 'appearance.concept_cute_sankou_desc',
    tagKey: 'appearance.concept_tag_editorial',
    iconName: 'receipt',
    persona: 'mone',
    lineKey: 'appearance.concept_line_cute_sankou',
    palette: ['#FFF4F7', '#FFFFFF', '#B8457A', '#C9B6E4'],
    canvas: { light: '#FFF4F7', dark: '#241A20' },
    ink: { light: '#4A3540', dark: '#F7EAF1' },
  },
};

export const THEME_CONCEPT_IDS = Object.keys(THEME_CONCEPTS);
export const DEFAULT_THEME_CONCEPT = 'kawaii_bento';

/**
 * The tokens of every concept, as a map of the custom property to its
 * value.
 *
 * The stylesheet declares the same tokens on the root element - that is
 * how a concept reaches every page. This copy is here for one reason:
 * the picker has to show all six concepts AT ONCE, on one page, and the
 * tokens of the concept that is active cannot be the tokens of the five
 * that are not.
 *
 * So each card in the picker carries its own tokens as inline custom
 * properties, and the classes that draw it read those. The card is then
 * drawn in its own concept while the page around it stays in the active
 * one.
 *
 * The two copies are held together by a test
 * (styles/__tests__/themeConcepts.test.js), which reads the stylesheet and
 * compares it with this map.
 */
export const CONCEPT_TOKENS = {
  kawaii_bento: {
    light: {
      '--concept-canvas': '#F7F2E7',
      '--concept-ink': '#2C221E',
      '--concept-ink-muted': '#6B5A52',
      '--concept-card': '#FFFDF9',
      '--concept-card-line': '#E6DCC7',
      '--concept-card-radius': '14px',
      '--concept-card-shadow': '4px 4px 0 #E9DFC9',
      '--concept-accent': '#B8457A',
      '--concept-accent-ink': '#FFFDF9',
      '--concept-badge-bg': '#F7E6C8',
      '--concept-badge-ink': '#6B4A12',
      '--concept-badge-radius': '999px',
      '--concept-rail': '#FFFDF9',
      '--concept-rail-line': '#E6DCC7',
      '--concept-rail-ink': '#4A3540',
      '--concept-rail-active': '#F7E6C8',
      '--concept-rail-active-ink': '#4A3540',
      '--concept-pattern': 'radial-gradient(circle at 1px 1px, rgba(74, 53, 64, 0.10) 1px, transparent 0)',
      '--concept-pattern-size': '22px 22px',
      '--concept-num-tracking': '0.01em',
      '--concept-title-tracking': '0.01em',
      '--concept-ornament': 'none',
    },
    dark: {
      '--concept-canvas': '#221C1A',
      '--concept-ink': '#F4EBE1',
      '--concept-ink-muted': '#C6B5A8',
      '--concept-card': '#2E2521',
      '--concept-card-line': '#473A33',
      '--concept-card-shadow': '4px 4px 0 rgba(0, 0, 0, 0.45)',
      '--concept-accent': '#E889A8',
      '--concept-accent-ink': '#2A141C',
      '--concept-badge-bg': '#4A3540',
      '--concept-badge-ink': '#F7E6C8',
      '--concept-rail': '#2E2521',
      '--concept-rail-line': '#473A33',
      '--concept-rail-ink': '#F0E4DA',
      '--concept-rail-active': '#4A3540',
      '--concept-rail-active-ink': '#F7E6C8',
      '--concept-pattern': 'radial-gradient(circle at 1px 1px, rgba(240, 228, 218, 0.10) 1px, transparent 0)',
    },
  },
  medieval_fantasy: {
    light: {
      '--concept-canvas': '#F3EADA',
      '--concept-ink': '#3E2C1C',
      '--concept-ink-muted': '#6B523A',
      '--concept-card': '#FBF6E8',
      '--concept-card-line': '#C5A059',
      '--concept-card-radius': '6px',
      '--concept-card-shadow': '0 4px 0 #D5C3A1, 0 10px 20px rgba(139, 108, 72, 0.16)',
      '--concept-accent': '#8A5A12',
      '--concept-accent-ink': '#FFF8E7',
      '--concept-badge-bg': '#F5D77F',
      '--concept-badge-ink': '#2C1D0C',
      '--concept-badge-radius': '4px',
      '--concept-rail': '#1A1E31',
      '--concept-rail-line': '#C5A059',
      '--concept-rail-ink': '#F1E7D2',
      '--concept-rail-active': '#F5D77F',
      '--concept-rail-active-ink': '#2C1D0C',
      '--concept-pattern':
        'linear-gradient(45deg, rgba(197, 160, 89, 0.16) 25%, transparent 25%), linear-gradient(-45deg, rgba(197, 160, 89, 0.16) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(197, 160, 89, 0.16) 75%), linear-gradient(-45deg, transparent 75%, rgba(197, 160, 89, 0.16) 75%)',
      '--concept-pattern-size': '64px 64px',
      '--concept-num-tracking': '0.02em',
      '--concept-title-tracking': '0.04em',
      '--concept-ornament': "'\\2756'",
    },
    dark: {
      '--concept-canvas': '#14121F',
      '--concept-ink': '#F1E7D2',
      '--concept-ink-muted': '#C4B391',
      '--concept-card': '#1E1B2E',
      '--concept-card-line': '#C5A059',
      '--concept-card-shadow': '0 4px 0 rgba(0, 0, 0, 0.5), 0 10px 24px rgba(0, 0, 0, 0.4)',
      '--concept-accent': '#D9B978',
      '--concept-accent-ink': '#241A05',
      '--concept-badge-bg': '#3A2E12',
      '--concept-badge-ink': '#F5D77F',
      '--concept-rail': '#0B0E18',
      '--concept-rail-line': '#C5A059',
      '--concept-rail-ink': '#F1E7D2',
      '--concept-rail-active': '#F5D77F',
      '--concept-rail-active-ink': '#2C1D0C',
      '--concept-pattern':
        'linear-gradient(45deg, rgba(197, 160, 89, 0.10) 25%, transparent 25%), linear-gradient(-45deg, rgba(197, 160, 89, 0.10) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(197, 160, 89, 0.10) 75%), linear-gradient(-45deg, transparent 75%, rgba(197, 160, 89, 0.10) 75%)',
    },
  },
  cyberpunk: {
    light: {
      '--concept-canvas': '#E9EDF6',
      '--concept-ink': '#101527',
      '--concept-ink-muted': '#4A5570',
      '--concept-card': '#FFFFFF',
      '--concept-card-line': '#C6D0E4',
      '--concept-card-radius': '2px',
      '--concept-card-shadow': '0 0 0 1px rgba(30, 111, 168, 0.18)',
      '--concept-accent': '#12628F',
      '--concept-accent-ink': '#FFFFFF',
      '--concept-badge-bg': '#CFF3FB',
      '--concept-badge-ink': '#075985',
      '--concept-badge-radius': '2px',
      '--concept-rail': '#FFFFFF',
      '--concept-rail-line': '#C6D0E4',
      '--concept-rail-ink': '#1B2340',
      '--concept-rail-active': '#12628F',
      '--concept-rail-active-ink': '#FFFFFF',
      '--concept-pattern':
        'linear-gradient(rgba(18, 98, 143, 0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(18, 98, 143, 0.10) 1px, transparent 1px)',
      '--concept-pattern-size': '28px 28px',
      '--concept-num-tracking': '0.06em',
      '--concept-title-tracking': '0.14em',
      '--concept-ornament': 'none',
    },
    dark: {
      '--concept-canvas': '#070A14',
      '--concept-ink': '#E6F0FF',
      '--concept-ink-muted': '#8FA3C4',
      '--concept-card': '#0F1424',
      '--concept-card-line': '#24304C',
      '--concept-card-shadow': '0 0 0 1px rgba(34, 211, 238, 0.22), 0 0 18px rgba(34, 211, 238, 0.10)',
      '--concept-accent': '#22D3EE',
      '--concept-accent-ink': '#04161A',
      '--concept-badge-bg': '#22D3EE',
      '--concept-badge-ink': '#04161A',
      '--concept-rail': '#0B1020',
      '--concept-rail-line': '#24304C',
      '--concept-rail-ink': '#C8D8F2',
      '--concept-rail-active': '#22D3EE',
      '--concept-rail-active-ink': '#04161A',
      '--concept-pattern':
        'linear-gradient(rgba(34, 211, 238, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.14) 1px, transparent 1px)',
    },
  },
  corporate: {
    light: {
      '--concept-canvas': '#F6F7F9',
      '--concept-ink': '#0F172A',
      '--concept-ink-muted': '#4B5563',
      '--concept-card': '#FFFFFF',
      '--concept-card-line': '#E2E8F0',
      '--concept-card-radius': '12px',
      '--concept-card-shadow': '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)',
      '--concept-accent': '#1D4ED8',
      '--concept-accent-ink': '#FFFFFF',
      '--concept-badge-bg': '#DBEAFE',
      '--concept-badge-ink': '#1E3A8A',
      '--concept-badge-radius': '6px',
      '--concept-rail': '#FFFFFF',
      '--concept-rail-line': '#E2E8F0',
      '--concept-rail-ink': '#334155',
      '--concept-rail-active': '#DBEAFE',
      '--concept-rail-active-ink': '#1E3A8A',
      '--concept-pattern': 'none',
      '--concept-pattern-size': '32px 32px',
      '--concept-num-tracking': '0em',
      '--concept-title-tracking': '-0.01em',
      '--concept-ornament': 'none',
    },
    dark: {
      '--concept-canvas': '#0B1120',
      '--concept-ink': '#E5E7EB',
      '--concept-ink-muted': '#9CA3AF',
      '--concept-card': '#131C31',
      '--concept-card-line': '#253154',
      '--concept-card-shadow': '0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.28)',
      '--concept-accent': '#60A5FA',
      '--concept-accent-ink': '#0B1120',
      '--concept-badge-bg': '#1E3A8A',
      '--concept-badge-ink': '#DBEAFE',
      '--concept-rail': '#0F172A',
      '--concept-rail-line': '#253154',
      '--concept-rail-ink': '#CBD5E1',
      '--concept-rail-active': '#1E3A8A',
      '--concept-rail-active-ink': '#DBEAFE',
    },
  },
  retro_8bit: {
    light: {
      '--concept-canvas': '#EDE7D6',
      '--concept-ink': '#16202B',
      '--concept-ink-muted': '#4A5560',
      '--concept-card': '#FFFDF2',
      '--concept-card-line': '#16202B',
      '--concept-card-radius': '0px',
      '--concept-card-shadow': '4px 4px 0 #16202B',
      '--concept-accent': '#A63513',
      '--concept-accent-ink': '#FFFDF2',
      '--concept-badge-bg': '#A63513',
      '--concept-badge-ink': '#FFFDF2',
      '--concept-badge-radius': '0px',
      '--concept-rail': '#16202B',
      '--concept-rail-line': '#16202B',
      '--concept-rail-ink': '#F2F5E9',
      '--concept-rail-active': '#A63513',
      '--concept-rail-active-ink': '#FFFDF2',
      '--concept-pattern':
        'linear-gradient(90deg, rgba(22, 32, 43, 0.07) 8px, transparent 8px), linear-gradient(rgba(22, 32, 43, 0.07) 8px, transparent 8px)',
      '--concept-pattern-size': '16px 16px',
      '--concept-num-tracking': '0.04em',
      '--concept-title-tracking': '0.1em',
      '--concept-ornament': 'none',
    },
    dark: {
      '--concept-canvas': '#101418',
      '--concept-ink': '#F2F5E9',
      '--concept-ink-muted': '#A9B4C0',
      '--concept-card': '#1A2129',
      '--concept-card-line': '#3B4753',
      '--concept-card-shadow': '4px 4px 0 rgba(0, 0, 0, 0.6)',
      '--concept-accent': '#E2703A',
      '--concept-accent-ink': '#16181C',
      '--concept-badge-bg': '#E2703A',
      '--concept-badge-ink': '#16181C',
      '--concept-rail': '#0A0D11',
      '--concept-rail-line': '#3B4753',
      '--concept-rail-ink': '#E6EBD8',
      '--concept-rail-active': '#E2703A',
      '--concept-rail-active-ink': '#16181C',
      '--concept-pattern':
        'linear-gradient(90deg, rgba(226, 112, 58, 0.08) 8px, transparent 8px), linear-gradient(rgba(226, 112, 58, 0.08) 8px, transparent 8px)',
    },
  },
  cute_sankou: {
    light: {
      '--concept-canvas': '#FFF4F7',
      '--concept-ink': '#4A3540',
      '--concept-ink-muted': '#7A6470',
      '--concept-card': '#FFFFFF',
      '--concept-card-line': '#F0DDE4',
      '--concept-card-radius': '18px',
      '--concept-card-shadow': '0 8px 20px rgba(122, 74, 105, 0.12)',
      '--concept-accent': '#B8457A',
      '--concept-accent-ink': '#FFFFFF',
      '--concept-badge-bg': '#FFE9A8',
      '--concept-badge-ink': '#7A4A12',
      '--concept-badge-radius': '999px',
      '--concept-rail': '#FFFFFF',
      '--concept-rail-line': '#F0DDE4',
      '--concept-rail-ink': '#4A3540',
      '--concept-rail-active': '#FFE9A8',
      '--concept-rail-active-ink': '#7A4A12',
      '--concept-pattern': 'radial-gradient(circle at 2px 2px, rgba(184, 69, 122, 0.12) 2px, transparent 0)',
      '--concept-pattern-size': '26px 26px',
      '--concept-num-tracking': '0.01em',
      '--concept-title-tracking': '0.02em',
      '--concept-ornament': 'none',
    },
    dark: {
      '--concept-canvas': '#241A20',
      '--concept-ink': '#F7EAF1',
      '--concept-ink-muted': '#CDB3C0',
      '--concept-card': '#31232B',
      '--concept-card-line': '#4C3742',
      '--concept-card-shadow': '0 8px 24px rgba(0, 0, 0, 0.4)',
      '--concept-accent': '#E58BB4',
      '--concept-accent-ink': '#2A1420',
      '--concept-badge-bg': '#4A3A22',
      '--concept-badge-ink': '#FFE9A8',
      '--concept-rail': '#31232B',
      '--concept-rail-line': '#4C3742',
      '--concept-rail-ink': '#F7EAF1',
      '--concept-rail-active': '#4A3A22',
      '--concept-rail-active-ink': '#FFE9A8',
      '--concept-pattern': 'radial-gradient(circle at 2px 2px, rgba(229, 139, 180, 0.14) 2px, transparent 0)',
    },
  },
};

/**
 * The inline custom properties that draw one concept, on one side of the
 * mode. Used by the picker, where all six concepts are on one page.
 *
 * The dark side is the light side with the dark values laid over it. The
 * stylesheet does the same thing by inheritance - the dark block only
 * writes the tokens that change - and the picker has to do it the same
 * way, or a card that is missing a token would silently take it from the
 * concept that happens to be active on the page.
 */
export function conceptTokenStyle(id, isDark) {
  const tokens = CONCEPT_TOKENS[id];
  if (!tokens) return undefined;
  if (!isDark) return tokens.light;
  return { ...tokens.light, ...tokens.dark };
}

/**
 * The Kakeibo palette - the canvas the app was drawn on before concepts
 * existed. It is still the fallback for a browser that refuses to give us
 * storage: a reader whose localStorage is blocked must still get a page
 * that looks right, not one with no canvas at all.
 */
export const KAKEIBO_CANVAS = { light: '#FAF9F6', dark: '#0F1512' };
export const KAKEIBO_INK = { light: '#2D312E', dark: '#ECEFEC' };

/**
 * Read the concept the reader has chosen.
 *
 * Returns the id. A reader who has never chosen one has the default
 * concept, so this never returns null for a reader with storage - only
 * for a browser that will not talk to localStorage at all.
 */
export function readThemeConcept() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(THEME_CONCEPT_KEY);
    if (value && THEME_CONCEPT_IDS.includes(value)) return value;
    if (!value) return DEFAULT_THEME_CONCEPT;
  } catch (err) {
    // Private mode / storage disabled.
    return null;
  }
  // A stored value that is not one of the six is a value from a newer
  // build, or a mistake. The default is the safe answer.
  return DEFAULT_THEME_CONCEPT;
}

/**
 * Keep the concept. An unknown id falls back to the default rather than
 * clearing the choice, so a typo in a stored value never leaves the app
 * without an identity.
 */
export function writeThemeConcept(id) {
  if (typeof window === 'undefined') return DEFAULT_THEME_CONCEPT;
  const value = THEME_CONCEPT_IDS.includes(id) ? id : DEFAULT_THEME_CONCEPT;
  try {
    window.localStorage.setItem(THEME_CONCEPT_KEY, value);
  } catch (err) {
    // Storage unavailable - the concept still applies for this session.
  }
  return value;
}

/**
 * Write the concept onto the document: <html> and <body>.
 *
 * Both, because everything that is portalled out to the body - toasts,
 * sheets, the command bar - has to be inside the concept as well, and a
 * rule that keys on `data-theme-concept` finds it on either.
 */
export function syncThemeConceptToDom(id) {
  if (typeof document === 'undefined') return DEFAULT_THEME_CONCEPT;
  const value = THEME_CONCEPT_IDS.includes(id) ? id : DEFAULT_THEME_CONCEPT;
  const targets = [document.documentElement, document.body].filter(Boolean);
  for (const el of targets) {
    for (const conceptId of THEME_CONCEPT_IDS) {
      el.classList.toggle(`concept-${conceptId}`, conceptId === value);
    }
    el.setAttribute('data-theme-concept', value);
  }
  // The canvas and the ink are inline styles on the root element, so they
  // have to be repainted when the concept changes.
  applyTheme(resolveTheme());
  return value;
}

/** The canvas of a concept, on the side of the mode that is showing. */
export function conceptCanvas(id, isDark) {
  const concept = THEME_CONCEPTS[id] || THEME_CONCEPTS[DEFAULT_THEME_CONCEPT];
  return isDark ? concept.canvas.dark : concept.canvas.light;
}

/** The ink of a concept, on the side of the mode that is showing. */
export function conceptInk(id, isDark) {
  const concept = THEME_CONCEPTS[id] || THEME_CONCEPTS[DEFAULT_THEME_CONCEPT];
  return isDark ? concept.ink.dark : concept.ink.light;
}

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
  //
  // These are written as inline styles on the root element, which beat
  // every stylesheet - so they have to be the right colours, or the
  // warm off-white canvas never shows.
  //
  // The concept decides which canvas and which ink: the concept is the
  // visual identity of the app, and the mode only says which side of it
  // is showing. When no concept is stored, the Kakeibo palette is used,
  // which is what the app looked like before concepts existed.
  const concept = readThemeConcept() || DEFAULT_THEME_CONCEPT;
  const canvas = conceptCanvas(concept, isDark);
  const ink = conceptInk(concept, isDark);
  root.style.backgroundColor = canvas;
  root.style.color = ink;

  // Update the browser chrome color on mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', canvas);
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
