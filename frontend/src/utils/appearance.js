/**
 * The look of the app: the colour scheme, the font, the background.
 *
 * The theme is the light or dark half. On top of that sits the colour
 * scheme, which decides what the accent colour is, and the font, which
 * decides how the numbers are drawn. The financial background is a
 * pattern behind the content, drawn in the accent colour at a low
 * opacity so it reads as texture and not as content.
 *
 * Everything here is a CSS custom property. The components read the
 * variables rather than hard-coding colours, so changing the scheme
 * changes the whole app at once.
 *
 * The choice is stored in localStorage so the first paint is right, and
 * in the user's settings so it follows the user to another device. The
 * two are reconciled by `syncAppearance` in the settings context, which
 * uses the revision to decide which one is newer.
 */

export const SCHEME_KEY = 'finmanager-scheme';
export const FONT_KEY = 'finmanager-font';
export const FONT_SCALE_KEY = 'finmanager-font-scale';
export const BACKGROUND_KEY = 'finmanager-background';

/**
 * The colour schemes.
 *
 * Each one is a set of shades for the accent. The accent is what the
 * buttons, the active tab and the chart lines are drawn in, so the
 * scheme is what the app "feels" like.
 *
 * The names are finance-adjacent on purpose: emerald is the money
 * green, slate is the neutral one, and the rest are there for a user
 * who wants their own.
 */
export const COLOR_SCHEMES = {
  emerald: {
    id: 'emerald',
    label: 'Emerald (Uang Hijau)',
    description: 'Hijau uang. Tenang dan terbaca.',
    // 50 to 900, in the emerald family.
    shades: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    accent: '#059669',
    onAccent: '#ffffff',
  },
  blue: {
    id: 'blue',
    label: 'Blue (Korporat)',
    description: 'Biru korporat. Tenang dan profesional.',
    shades: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    accent: '#2563eb',
    onAccent: '#ffffff',
  },
  violet: {
    id: 'violet',
    label: 'Violet (Kreatif)',
    description: 'Ungu. Untuk yang ingin tampil beda.',
    shades: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    accent: '#7c3aed',
    onAccent: '#ffffff',
  },
  amber: {
    id: 'amber',
    label: 'Amber (Hangat)',
    description: 'Kuning hangat. Terasa hangat dan оптиis.',
    shades: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    accent: '#d97706',
    onAccent: '#ffffff',
  },
  rose: {
    id: 'rose',
    label: 'Rose (Hangat)',
    description: 'Merah muda. Berani dan hangat.',
    shades: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
    },
    accent: '#e11d48',
    onAccent: '#ffffff',
  },
  slate: {
    id: 'slate',
    label: 'Slate (Netral)',
    description: 'Abu-abu. Netral dan tidak ramai.',
    shades: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    accent: '#475569',
    onAccent: '#ffffff',
  },
};

export const SCHEME_IDS = Object.keys(COLOR_SCHEMES);
export const DEFAULT_SCHEME = 'emerald';

/**
 * The fonts.
 *
 * The default is a plain sans, because that is what numbers want. The
 * others are there for a user who wants the app to read differently.
 * Every one is a system font stack, so nothing has to be downloaded and
 * the app works the same offline.
 */
export const FONT_FAMILIES = {
  sans: {
    id: 'sans',
    label: 'Sans (Standar)',
    description: 'Paling netral dan mudah dibaca.',
    stack:
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    numeric: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  },
  serif: {
    id: 'serif',
    label: 'Serif (Klasik)',
    description: 'Serif, terasa resmi seperti laporan keuangan.',
    stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    numeric: "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace",
  },
  mono: {
    id: 'mono',
    label: 'Mono (Data)',
    description: 'Semua monospasi. Cocok untuk yang baca angka.',
    stack: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    numeric: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  rounded: {
    id: 'rounded',
    label: 'Rounded (Lembut)',
    description: 'Sudut bulat, terasa ramah.',
    stack: "'Nunito', 'Quicksand', system-ui, -apple-system, 'Segoe UI', sans-serif",
    numeric: "ui-rounded, 'SF Pro Rounded', 'Nunito', Menlo, monospace",
  },
};

export const FONT_IDS = Object.keys(FONT_FAMILIES);
export const DEFAULT_FONT = 'sans';

/**
 * How big the text is.
 *
 * The scale is a multiplier on the root font size, so everything in
 * the app grows together, including the charts and the spacing.
 */
export const FONT_SCALES = {
  sm: { id: 'sm', label: 'Kecil', percent: 90 },
  md: { id: 'md', label: 'Sedang', percent: 100 },
  lg: { id: 'lg', label: 'Besar', percent: 110 },
  xl: { id: 'xl', label: 'Sangat besar', percent: 122 },
};

export const FONT_SCALE_IDS = Object.keys(FONT_SCALES);
export const DEFAULT_FONT_SCALE = 'md';

/**
 * The background.
 *
 * 'plain' is a flat colour. 'grid' is the financial chart paper: a
 * grid of lines, the kind that is printed behind a candlestick chart.
 * 'rings' is a soft radial glow. 'mesh' is several of them, which
 * reads as depth without being busy.
 */
export const BACKGROUNDS = {
  plain: { id: 'plain', label: 'Polos', description: 'Warna polos, tenang.' },
  grid: {
    id: 'grid',
    label: 'Grid Keuangan',
    description: 'Kertas grafik, seperti di layar saham.',
  },
  rings: {
    id: 'rings',
    label: 'Cahaya',
    description: 'Cahaya lembut di belakang konten.',
  },
  mesh: {
    id: 'mesh',
    label: 'Gradien',
    description: 'Lapisan cahaya, lebih kaya.',
  },
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);
export const DEFAULT_BACKGROUND = 'plain';


// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

function readStored(key, allowed, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = localStorage.getItem(key);
    if (value && allowed.includes(value)) return value;
  } catch (err) {
    /* storage unavailable */
  }
  return fallback;
}

function writeStored(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    /* storage unavailable */
  }
}

export function getColorScheme() {
  return readStored(SCHEME_KEY, SCHEME_IDS, DEFAULT_SCHEME);
}

export function setColorScheme(id) {
  const value = SCHEME_IDS.includes(id) ? id : DEFAULT_SCHEME;
  writeStored(SCHEME_KEY, value);
  return value;
}

export function getFontFamily() {
  return readStored(FONT_KEY, FONT_IDS, DEFAULT_FONT);
}

export function setFontFamily(id) {
  const value = FONT_IDS.includes(id) ? id : DEFAULT_FONT;
  writeStored(FONT_KEY, value);
  return value;
}

export function getFontScale() {
  return readStored(FONT_SCALE_KEY, FONT_SCALE_IDS, DEFAULT_FONT_SCALE);
}

export function setFontScale(id) {
  const value = FONT_SCALE_IDS.includes(id) ? id : DEFAULT_FONT_SCALE;
  writeStored(FONT_SCALE_KEY, value);
  return value;
}

export function getBackgroundStyle() {
  return readStored(BACKGROUND_KEY, BACKGROUND_IDS, DEFAULT_BACKGROUND);
}

export function setBackgroundStyle(id) {
  const value = BACKGROUND_IDS.includes(id) ? id : DEFAULT_BACKGROUND;
  writeStored(BACKGROUND_KEY, value);
  return value;
}


// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

/**
 * Put the look on the document.
 *
 * The custom properties go on the root element. The component classes
 * read them, so one call changes the whole app.
 */
export function applyAppearance(appearance = {}) {
  if (typeof document === 'undefined') return;

  // The look is passed around in the same shape the server uses it
  // (snake_case), because that is what `readAppearance` returns and
  // what the API sends. The camelCase names are accepted as well so a
  // caller using either style works.
  const {
    color_scheme: colorScheme = DEFAULT_SCHEME,
    colorScheme: colorSchemeAlt = DEFAULT_SCHEME,
    font_family: fontFamily = DEFAULT_FONT,
    fontFamily: fontFamilyAlt = DEFAULT_FONT,
    font_scale: fontScale = DEFAULT_FONT_SCALE,
    fontScale: fontScaleAlt = DEFAULT_FONT_SCALE,
    background_style: backgroundStyle = DEFAULT_BACKGROUND,
    backgroundStyle: backgroundStyleAlt = DEFAULT_BACKGROUND,
  } = appearance;

  const schemeId = colorScheme || colorSchemeAlt;
  const fontId = fontFamily || fontFamilyAlt;
  const scaleId = fontScale || fontScaleAlt;
  const backgroundId = backgroundStyle || backgroundStyleAlt;

  const root = document.documentElement;

  const scheme = COLOR_SCHEMES[schemeId] || COLOR_SCHEMES[DEFAULT_SCHEME];
  const font = FONT_FAMILIES[fontId] || FONT_FAMILIES[DEFAULT_FONT];
  const scale = FONT_SCALES[scaleId] || FONT_SCALES[DEFAULT_FONT_SCALE];
  const background =
    BACKGROUNDS[backgroundId] || BACKGROUNDS[DEFAULT_BACKGROUND];

  root.setAttribute('data-scheme', scheme.id);
  root.setAttribute('data-font', font.id);
  root.setAttribute('data-font-scale', scale.id);
  root.setAttribute('data-background', background.id);

  // The shades, so a component can use any step of the accent. Every
  // step of the scale is set, including the ones the dark mode needs,
  // so a step never falls back to a stale value from another scheme.
  Object.entries(scheme.shades).forEach(([step, value]) => {
    root.style.setProperty(`--scheme-${step}`, value);
  });
  ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].forEach(
    (step) => {
      if (!scheme.shades[step]) {
        root.style.setProperty(`--scheme-${step}`, scheme.shades[500]);
      }
    }
  );

  root.style.setProperty('--scheme-accent', scheme.accent);
  root.style.setProperty('--scheme-on-accent', scheme.onAccent);

  root.style.setProperty('--font-sans', font.stack);
  root.style.setProperty('--font-mono', font.numeric);

  // The scale is a multiplier on the root size, so everything grows
  // together.
  root.style.setProperty('--font-scale', String(scale.percent / 100));
  root.style.fontSize = `${scale.percent}%`;

  // The background is drawn by a layer behind the content. It uses the
  // light steps of the scheme, which are already set above.
  root.style.setProperty(
    '--background-image',
    buildBackground(background.id, scheme)
  );
}

/**
 * The background pattern, as a CSS background.
 *
 * The financial grid is drawn with two repeating gradients: one for
 * the lines and one for the heavier ones every fifth cell, the way
 * chart paper is printed.
 */
function buildBackground(id, scheme) {
  switch (id) {
    case 'grid': {
      const line = 'rgba(100, 116, 139, 0.10)';
      const heavy = 'rgba(100, 116, 139, 0.16)';
      return [
        `linear-gradient(${heavy} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${heavy} 1px, transparent 1px)`,
        `linear-gradient(${line} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      ].join(', ') + ', none';
    }
    case 'rings': {
      return `radial-gradient(circle at 20% 10%, ${scheme.shades[100]} 0%, transparent 45%), ` +
             `radial-gradient(circle at 85% 30%, ${scheme.shades[50]} 0%, transparent 40%)`;
    }
    case 'mesh': {
      return `radial-gradient(at 15% 20%, ${scheme.shades[200]} 0px, transparent 50%), ` +
             `radial-gradient(at 85% 15%, ${scheme.shades[100]} 0px, transparent 45%), ` +
             `radial-gradient(at 70% 80%, ${scheme.shades[50]} 0px, transparent 45%), ` +
             `radial-gradient(at 25% 85%, ${scheme.shades[100]} 0px, transparent 45%)`;
    }
    case 'plain':
    default:
      return 'none';
  }
}

/**
 * The look the user has chosen, as a plain object.
 *
 * Used to seed the settings page and to send to the server.
 */
export function readAppearance() {
  return {
    color_scheme: getColorScheme(),
    font_family: getFontFamily(),
    font_scale: getFontScale(),
    background_style: getBackgroundStyle(),
  };
}
