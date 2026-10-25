// Appearance Settings - the colour scheme, the font, the background.
//
// The choice is applied to the page as it is made, so the user can see
// what they picked without going back and forth. It is stored locally
// right away and sent to the server, so it follows the user to another
// device.
import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  COLOR_SCHEMES,
  SCHEME_IDS,
  FONT_FAMILIES,
  FONT_IDS,
  FONT_SCALES,
  FONT_SCALE_IDS,
  BACKGROUNDS,
  BACKGROUND_IDS,
} from '../../utils/appearance';
import { useTranslation } from '../../i18n';

const Section = ({ title, hint, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
    <h2 className="font-bold text-lg mb-1 text-gray-900 dark:text-gray-100">
      {title}
    </h2>
    {hint && (
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{hint}</p>
    )}
    {children}
  </div>
);

/**
 * A preview of the accent, so the user can see what the scheme looks
 * like without leaving the page.
 */
const SchemeSwatch = ({ scheme }) => (
  <div className="flex items-center gap-1">
    {[600, 500, 400, 300].map((step) => (
      <span
        key={step}
        className="h-5 w-5 rounded-full ring-1 ring-black/5"
        style={{ backgroundColor: scheme.shades[step] }}
      />
    ))}
  </div>
);

const Appearance = () => {
  const { t } = useTranslation();
  const {
    colorScheme,
    fontFamily,
    fontScale,
    backgroundStyle,
    setColorScheme,
    setFontFamily,
    setFontScale,
    setBackgroundStyle,
    isDarkMode,
    mode,
    setTheme,
  } = useTheme();

  const [saved, setSaved] = useState(false);

  // The flash of "saved" is short, so it is cleared again on its own.
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const mark = () => {
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="bg-accent text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('appearance.title')}</h1>
          {saved && (
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {t('appearance.saved')}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* --- The theme --- */}
        <Section
          title={t('appearance.mode')}
          hint={t('appearance.mode_hint')}
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', labelKey: 'appearance.mode_light', emoji: '☀️' },
              { id: 'dark', labelKey: 'appearance.mode_dark', emoji: '🌙' },
              { id: 'system', labelKey: 'appearance.mode_system', emoji: '🖥️' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setTheme(option.id);
                  mark();
                }}
                className={`rounded-lg border-2 p-3 text-center transition ${
                  mode === option.id
                    ? 'border-accent bg-accent-soft'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="text-xl">{option.emoji}</div>
                <div className="text-xs font-medium mt-1 text-gray-700 dark:text-gray-200">
                  {t(option.labelKey)}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* --- The colour scheme --- */}
        <Section
          title={t('appearance.accent')}
          hint="Warna tombol, tab aktif, dan grafik. Dipakai di kedua mode terang dan gelap."
        >
          <div className="space-y-2">
            {SCHEME_IDS.map((id) => {
              const scheme = COLOR_SCHEMES[id];
              const active = colorScheme === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setColorScheme(id);
                    mark();
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg border-2 p-3 text-left transition ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <SchemeSwatch scheme={scheme} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {t(scheme.labelKey)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t(scheme.descriptionKey)}
                    </div>
                  </div>
                  {active && (
                    <span className="text-accent text-sm font-bold">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* --- The font --- */}
        <Section
          title={t('appearance.font')}
          hint="Untuk angka, selalu tabular supaya kolom rupiah rapi."
        >
          <div className="space-y-2">
            {FONT_IDS.map((id) => {
              const font = FONT_FAMILIES[id];
              const active = fontFamily === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setFontFamily(id);
                    mark();
                  }}
                  className={`w-full rounded-lg border-2 p-3 text-left transition ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="text-sm font-medium text-gray-800 dark:text-gray-100"
                    style={{ fontFamily: font.stack }}
                  >
                    {t(font.labelKey)}
                  </div>
                  <div
                    className="text-xs text-gray-500 dark:text-gray-400"
                    style={{ fontFamily: font.stack }}
                  >
                    Rp1.250.000 — {t(font.descriptionKey)}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* --- The size --- */}
        <Section
          title={t('appearance.text_size')}
          hint={t('appearance.scale_hint')}
        >
          <div className="grid grid-cols-4 gap-2">
            {FONT_SCALE_IDS.map((id) => {
              const scale = FONT_SCALES[id];
              const active = fontScale === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setFontScale(id);
                    mark();
                  }}
                  className={`rounded-lg border-2 py-2.5 transition ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div
                    className="font-semibold text-gray-800 dark:text-gray-100"
                    style={{ fontSize: `${scale.percent * 0.42}rem` }}
                  >
                    Aa
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {t(scale.labelKey)}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* --- The background --- */}
        <Section
          title={t('appearance.background')}
          hint="Pola di belakang konten. Grid keuangan seperti kertas grafik."
        >
          <div className="grid grid-cols-2 gap-2">
            {BACKGROUND_IDS.map((id) => {
              const background = BACKGROUNDS[id];
              const active = backgroundStyle === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setBackgroundStyle(id);
                    mark();
                  }}
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div
                    className="h-16 rounded-md mb-2 border border-gray-200 dark:border-gray-600 overflow-hidden preview-bg"
                    data-preview={background.id}
                  />
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-100">
                    {t(background.labelKey)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {t(background.descriptionKey)}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* --- A preview --- */}
        <Section title={t('appearance.preview')}>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t('appearance.preview_balance')}
              </span>
              <span
                className="text-lg font-bold tabular-nums"
                style={{ color: 'var(--scheme-accent-fg, var(--scheme-accent))' }}
              >
                Rp12.450.000
              </span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t('appearance.preview_expense')}
              </span>
              <span className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                -Rp3.250.000
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                Tombol utama
              </button>
              <button className="bg-accent-soft text-accent-strong px-3 py-1.5 rounded-lg text-xs font-medium">
                Tombol halus
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default Appearance;
