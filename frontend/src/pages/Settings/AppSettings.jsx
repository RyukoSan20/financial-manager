// App Settings Page - Theme, Language, Currency, etc.
// Backed by GET/PUT /api/settings/app, with localStorage as an offline mirror.
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { THEME_DARK, THEME_LIGHT, THEME_SYSTEM } from '../../utils/theme';
import { useTranslation } from '../../i18n';
import { batch2, fill } from '../../i18n/keys_batch2';

const DEFAULTS = {
  theme: 'system',
  language: 'id',
  currency: 'IDR',
  date_format: 'DD/MM/YYYY',
  start_of_week: 'monday',
  timezone: 'Asia/Jakarta',
  auto_backup: false,
  biometric_login: false
};

const AppSettings = () => {
  const { t, language } = useTranslation();
  const K = batch2[language]?.app_settings || batch2.id.app_settings;
  const { theme: activeTheme, setTheme } = useTheme();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // Seed from localStorage first so the UI is never empty while the API responds
    try {
      const cached = localStorage.getItem('app_settings');
      if (cached) setSettings({ ...DEFAULTS, ...JSON.parse(cached) });
    } catch {
      /* ignore malformed cache */
    }

    try {
      const data = await api.request('/settings/app');
      const merged = { ...DEFAULTS, ...(data || {}) };
      setSettings(merged);
      localStorage.setItem('app_settings', JSON.stringify(merged));
    } catch (e) {
      console.error('Load app settings error:', e);
      setError(e.message || K.load_error);
    } finally {
      setLoading(false);
    }
  }, [K]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Apply the stored theme preference to the document.
   *
   * 'system' resolves to the OS preference and keeps following it.
   * 'light' and 'dark' are persisted as an explicit user choice and
   * permanently override the OS preference and force-dark heuristics.
   */
  useEffect(() => {
    if (loading) return;
    if (
      settings.theme === THEME_SYSTEM ||
      settings.theme === THEME_DARK ||
      settings.theme === THEME_LIGHT
    ) {
      setTheme(settings.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, loading]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    // Optimistic local mirror so the next page load works offline too
    localStorage.setItem('app_settings', JSON.stringify(settings));
    try {
      await api.request('/settings/app', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      setMessage(t('app_settings.saved'));
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message || K.save_error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t('app_settings.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">{t('app_settings.title')}</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {message && (
          <div className="p-3 bg-green-100 text-green-700 rounded-lg">{message}</div>
        )}
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('app_settings.appearance')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('app_settings.theme')}</label>
              <div className="flex gap-2">
                {[
                  { value: 'light', icon: '☀️', label: t('appearance.mode_light') },
                  { value: 'dark', icon: '🌙', label: t('appearance.mode_dark') },
                  { value: 'system', icon: '💻', label: t('appearance.mode_system') },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSettings({ ...settings, theme: opt.value })}
                    className={`flex-1 py-2 px-4 rounded-lg border ${
                      settings.theme === opt.value
                        ? 'bg-primary-600 text-white border-primary-500'
                        : 'bg-white text-gray-700'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {K.theme_hint}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {fill(
                  K.theme_active,
                  activeTheme === THEME_DARK
                    ? t('appearance.mode_dark')
                    : t('appearance.mode_light'),
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('app_settings.language')}</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="id">🇮🇩 {K.lang_id}</option>
                <option value="en">🇺🇸 {K.lang_en}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('app_settings.regional')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('app_settings.currency')}</label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="IDR">🇮🇩 {K.currency_idr}</option>
                <option value="USD">🇺🇸 {K.currency_usd}</option>
                <option value="EUR">🇪🇺 {K.currency_eur}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('app_settings.date_format')}</label>
              <select
                value={settings.date_format}
                onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="DD/MM/YYYY">{K.date_ddmyyyy}</option>
                <option value="MM/DD/YYYY">{K.date_mdyyyy}</option>
                <option value="YYYY-MM-DD">{K.date_iso}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('app_settings.week_starts')}</label>
              <select
                value={settings.start_of_week}
                onChange={(e) => setSettings({ ...settings, start_of_week: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="monday">{t('app_settings.monday')}</option>
                <option value="sunday">{t('app_settings.sunday')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('app_settings.timezone')}</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="Asia/Jakarta">{K.tz_wib}</option>
                <option value="Asia/Makassar">{K.tz_wita}</option>
                <option value="Asia/Jayapura">{K.tz_wit}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('app_settings.security')}</h2>

          <div className="space-y-4">
            <ToggleItem
              title={t('app_settings.auto_backup')}
              description={K.auto_backup_desc}
              checked={settings.auto_backup}
              onChange={() => setSettings({ ...settings, auto_backup: !settings.auto_backup })}
            />

            <ToggleItem
              title={t('app_settings.biometric')}
              description={K.biometric_desc}
              checked={settings.biometric_login}
              onChange={() =>
                setSettings({ ...settings, biometric_login: !settings.biometric_login })
              }
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
        >
          {saving ? t('app_settings.saving') : '💾 ' + t('app_settings.save_settings')}
        </button>
      </div>
    </div>
  );
};

const ToggleItem = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <button
      onClick={onChange}
      aria-pressed={checked}
      className={`w-12 h-7 rounded-full transition-colors ${
        checked ? 'bg-primary-500' : 'bg-gray-300'
      }`}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export default AppSettings;
