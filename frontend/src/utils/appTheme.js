/**
 * The app theme: which whole design the app is drawn in.
 *
 *   corporate  "Korporat Catchy" - the warm, clean design the app has (default)
 *   medieval   "Royal Aurelia"   - gold-framed guild hall on argyle parchment
 *   jade       "Jade Sovereign"  - emerald fintech terminal
 *
 * The choice is kept in localStorage (`fm_ui_theme`) so the first paint
 * is right, in React context so every component can read it, and in the
 * account's `preferences` (`ui_theme`) so it follows the reader to
 * another device.
 *
 * It is written onto BOTH <html> and <body> as `data-app-theme` and as
 * `.theme-<id>`, so a stylesheet can key on either, and so everything
 * that is portalled out to the body (toasts, sheets, the command bar)
 * is inside the theme as well.
 *
 * `medieval` can have a panel palette (the colour of the sidebar and the
 * guild cards): the default is the royal midnight blue, and the rest are
 * catchy jewel tones for whoever does not want a dark panel.
 */

export const THEME_KEY = 'fm_ui_theme';
export const PALETTE_KEY = 'fm_ui_palette';

export const APP_THEMES = {
  corporate: {
    id: 'corporate',
    emoji: '\u{1F3DB}\uFE0F',
    labelKey: 'appearance.theme_corporate',
    descriptionKey: 'appearance.theme_corporate_desc',
    swatch: ['#F7F6F2', '#FFFFFF', '#1F3A2E'],
    // The little drawing of the design, in its own colours.
    mini: {
      page: '#F7F6F2', side: '#FFFFFF', sideLine: '#E6E4DD',
      card: '#FFFFFF', cardLine: '#E5E7EB',
      ticket: '#1F3A2E', btn: '#1F3A2E',
      ink: '#111827', radius: 10, active: '#EAF3EE', row: '#334155',
    },
  },
  medieval: {
    id: 'medieval',
    emoji: '\u2694\uFE0F',
    labelKey: 'appearance.theme_medieval',
    descriptionKey: 'appearance.theme_medieval_desc',
    swatch: ['#f6eed9', '#161b2e', '#c5a059'],
    mini: {
      page: '#f6eed9', side: 'linear-gradient(180deg,#161b2e,#0b0e18)', sideLine: '#c5a059',
      card: '#fbf6e8', cardLine: '#b59b72',
      ticket: 'linear-gradient(180deg,#161b2e,#0b0e18)', btn: 'linear-gradient(180deg,#f5d77f,#c59b27)',
      ink: '#4a3525', radius: 8, active: '#d4af37', row: '#f3e9d2',
    },
  },
  jade: {
    id: 'jade',
    emoji: '\u{1F48E}',
    labelKey: 'appearance.theme_jade',
    descriptionKey: 'appearance.theme_jade_desc',
    swatch: ['#ECF4F0', '#0F2922', '#10B981'],
    mini: {
      page: '#ECF4F0', side: '#0F2922', sideLine: '#1E463B',
      card: '#FFFFFF', cardLine: '#A7F3D0',
      ticket: 'linear-gradient(135deg,#064E3B,#0F2922)', btn: 'linear-gradient(135deg,#10B981,#047857)',
      ink: '#06281E', radius: 7, active: '#10B981', row: '#D1FAE5',
    },
  },
};
export const APP_THEME_IDS = Object.keys(APP_THEMES);
export const DEFAULT_APP_THEME = 'corporate';

/** Panel palettes of the medieval theme. `panel` is the top and bottom of a guild card / the sidebar. */
export const PALETTES = {
  royal: { id: 'royal', labelKey: 'appearance.pal_royal', panel: ['#161b2e', '#0b0e18'], swatch: '#161b2e' },
  aurora: { id: 'aurora', labelKey: 'appearance.pal_aurora', panel: ['#5a2d9c', '#2f1a74'], swatch: '#5a2d9c' },
  sakura: { id: 'sakura', labelKey: 'appearance.pal_sakura', panel: ['#a3285f', '#5e1d52'], swatch: '#a3285f' },
  ocean: { id: 'ocean', labelKey: 'appearance.pal_ocean', panel: ['#0b6b78', '#0a3f6e'], swatch: '#0b6b78' },
  ember: { id: 'ember', labelKey: 'appearance.pal_ember', panel: ['#a23d1b', '#5e1c3a'], swatch: '#a23d1b' },
  forest: { id: 'forest', labelKey: 'appearance.pal_forest', panel: ['#17693f', '#0c3d4a'], swatch: '#17693f' },
};
export const PALETTE_IDS = Object.keys(PALETTES);
export const DEFAULT_PALETTE = 'royal';

function readStored(key, allowed, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v && allowed.includes(v)) return v;
  } catch (err) { /* storage unavailable */ }
  return fallback;
}

function writeStored(key, value) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch (err) { /* storage unavailable */ }
}

export const getAppTheme = () => readStored(THEME_KEY, APP_THEME_IDS, DEFAULT_APP_THEME);
export const getPalette = () => readStored(PALETTE_KEY, PALETTE_IDS, DEFAULT_PALETTE);

export function setAppTheme(id) {
  const v = APP_THEME_IDS.includes(id) ? id : DEFAULT_APP_THEME;
  writeStored(THEME_KEY, v);
  return v;
}

export function setPalette(id) {
  const v = PALETTE_IDS.includes(id) ? id : DEFAULT_PALETTE;
  writeStored(PALETTE_KEY, v);
  return v;
}

/** The next theme in the cycle: corporate -> medieval -> jade -> corporate. */
export const nextAppTheme = (id) => APP_THEME_IDS[(APP_THEME_IDS.indexOf(id) + 1) % APP_THEME_IDS.length];

/**
 * Write the theme onto the document: <html> and <body>.
 * `medieval` also carries the guild-shell classes its stylesheet keys on.
 */
export function applyAppTheme({ theme, palette }) {
  if (typeof document === 'undefined') return;
  const targets = [document.documentElement, document.body].filter(Boolean);
  for (const el of targets) {
    for (const id of APP_THEME_IDS) el.classList.toggle(`theme-${id}`, id === theme);
    el.setAttribute('data-app-theme', theme);
    el.setAttribute('data-app-palette', palette);
  }
  const root = document.documentElement;
  // The medieval skin is a light parchment design; the app's dark variants
  // would half-dark it, so it is always drawn on the light side.
  if (theme === 'medieval') root.classList.remove('dark');
}

export const readThemePrefs = () => ({ ui_theme: getAppTheme(), ui_palette: getPalette() });
