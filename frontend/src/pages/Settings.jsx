import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Select } from '../components/ui';
import { User, Lock, Bell, Globe, Download, Trash2, Loader2, LogOut, Palette, Coins, Search, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import { useCurrency, CURRENCIES, CURRENCY_CODES } from '../utils/currency';
import ReadinessChecklist from '../components/ReadinessChecklist';
import PrivacyPage from './Settings/PrivacyPage';

export const Settings = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');
  // The search box filters the setting rows inside the tabs, and the
  // tabs themselves. A long settings page is hard to navigate without
  // it.
  const [search, setSearch] = useState('');
  const [passport, setPassport] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/settings/passport')
      .then((res) => { if (alive) setPassport(res); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const tabs = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'security', label: t('settings.tabs.security'), icon: Lock },
    { id: 'preferences', label: t('settings.tabs.preferences'), icon: Globe },
    { id: 'data', label: t('settings.tabs.data'), icon: Download },
    { id: 'privacy', label: t('settings.tabs.privacy'), icon: ShieldCheck },
  ];

  // The search filters the tabs as well as the rows inside them.
  const visibleTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter((tab) => tab.label.toLowerCase().includes(q));
  }, [search, tabs]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
          <p className="text-gray-500 mt-1">{t('settings.subtitle')}</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => {
            localStorage.clear();
            logout();
          }}
          className="flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          {t('settings.sign_out')}
        </Button>
      </div>

      {/* The search box. It filters the settings rows below, so a
          reader who knows what they want does not have to know which
          tab holds it. */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('settings.search_placeholder')}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('settings.search_clear')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* The tab column: the identity card, the readiness
            checklist, and the tabs themselves. */}
        <div className="lg:w-72 space-y-4">
          {/* Passport card: who the reader is and how far along they
              are, in one glance. */}
          {passport && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                {passport.avatar_url ? (
                  <img
                    src={passport.avatar_url}
                    alt=""
                    className="w-11 h-11 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                    {passport.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {passport.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {passport.email}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t('readiness.title')}
                  </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                    {passport.readiness_done}/{passport.readiness_total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${passport.readiness_score}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ['accounts', passport.counts?.accounts],
                  ['transactions', passport.counts?.transactions],
                  ['goals', passport.counts?.goals],
                  ['budgets', passport.counts?.budgets],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 py-2">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm tabular-nums">
                      {v ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {t(`passport.count.${k}`)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <ReadinessChecklist />

          <Card className="p-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'preferences' && <PreferencesTab user={user} />}
          {activeTab === 'data' && <DataTab logout={logout} />}
          {activeTab === 'privacy' && <PrivacyPage />}
        </div>
      </div>
    </div>
  );
};

/**
 * The appearance tab.
 *
 * The heavy part of the appearance lives on its own page, which is
 * reachable from here and from the settings list.
 */
const AppearanceTab = () => {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <Palette className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold">{t('settings.appearance.title')}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {t('settings.appearance.description')}
      </p>
      <Link
        to="/settings/appearance"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
      >
        <Palette className="w-4 h-4" />
        {t('settings.appearance.cta')}
      </Link>
    </Card>
  );
};

const ProfileTab = ({ user }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    email: user?.email || '',
    username: user?.username || '',
    full_name: user?.full_name || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await api.request('/me', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: form.full_name,
          username: form.username,
        }),
      });
      
      if (response) {
        setMessage(t('settings.profile.saved'));
        // Update localStorage with new user data
        const updatedUser = { ...user, ...form };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
      }
    } catch (error) {
      setMessage(t('settings.profile.failed') + ': ' + (error.message || t('settings.profile.unknown_error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">{t('settings.profile.title')}</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('settings.profile.email')}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          disabled
        />
        <Input
          label={t('settings.profile.username')}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <Input
          label={t('settings.profile.full_name')}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {t('settings.profile.save')}
        </Button>
      </form>
    </Card>
  );
};

const SecurityTab = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.new_password !== form.confirm_password) {
      setMessage(t('settings.security.mismatch'));
      return;
    }
    
    if (form.new_password.length < 6) {
      setMessage(t('settings.security.too_short'));
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await api.request('/change-password', {
        method: 'POST',
        body: JSON.stringify({
          old_password: form.current_password,
          new_password: form.new_password,
        }),
      });
      
      if (response) {
        setMessage(t('settings.security.saved'));
        setForm({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (error) {
      setMessage(t('settings.security.failed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">{t('settings.security.title')}</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('settings.security.current_password')}
          type="password"
          value={form.current_password}
          onChange={(e) => setForm({ ...form, current_password: e.target.value })}
          required
        />
        <Input
          label={t('settings.security.new_password')}
          type="password"
          value={form.new_password}
          onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          required
        />
        <Input
          label={t('settings.security.confirm_password')}
          type="password"
          value={form.confirm_password}
          onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {t('settings.security.save')}
        </Button>
      </form>
    </Card>
  );
};

const PreferencesTab = ({ user }) => {
  const { language, changeLanguage, languages, t } = useTranslation();
  const { currency, setCurrency, ratesAsOf, ratesSource, loading, refreshRates } = useCurrency();
  const [saved, setSaved] = useState(false);
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);

  // The currency the app shows money in. It is a choice of its own:
  // picking a language does not change it, and changing it does not
  // change the language.
  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Each language is named in that language, so a person who cannot
  // read the current one can still find their own.
  const languageOptions = {
    id: { label: '🇮🇩 Indonesia', name: 'Bahasa Indonesia' },
    en: { label: '🇺🇸 English', name: 'English' },
    ja: { label: '🇯🇵 日本語', name: '日本語' },
  };

  const currencyOptions = useMemo(() => {
    const codes = showAllCurrencies ? CURRENCY_CODES : ['IDR', 'USD', 'EUR', 'JPY', 'GBP', 'AUD'];
    return codes.map((code) => ({
      value: code,
      label: `${CURRENCIES[code].symbol}  ${t(`currency.${code}`)}`,
    }));
  }, [showAllCurrencies, t]);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">{t('settings.preferences.title')}</h2>
      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700">
          {t('settings.preferences.saved')}
        </div>
      )}
      <div className="space-y-6">
        {/* Language Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Globe className="w-4 h-4 inline mr-2" />
            {t('settings.preferences.language')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(languageOptions).map(([code, { label, name }]) => (
              <button
                key={code}
                onClick={() => changeLanguage(code)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  language === code
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="text-2xl block mb-1">{label.split(' ')[0]}</span>
                <span className="text-sm font-medium">{name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {t('settings.preferences.selected')}: <strong>{languageOptions[language]?.name || 'English'}</strong>
          </p>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Coins className="w-4 h-4 inline mr-2" />
            {t('settings.preferences.currency')}
          </label>
          <Select
            label={t('currency.display_currency')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={currencyOptions}
          />
          <button
            type="button"
            onClick={() => setShowAllCurrencies((v) => !v)}
            className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAllCurrencies
              ? t('currency.show_fewer')
              : t('currency.show_all')}
          </button>
          <p className="mt-2 text-sm text-gray-500">{t('currency.display_hint')}</p>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
            <span className="text-xs text-gray-500">
              {loading
                ? t('currency.rates_loading')
                : ratesAsOf
                  ? `${t('currency.rates_updated')} ${new Date(ratesAsOf).toLocaleString()}`
                  : t('currency.rates_error')}
            </span>
            <button
              type="button"
              onClick={refreshRates}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              {t('currency.refresh_rates')}
            </button>
          </div>
        </div>

        <Button onClick={handleSave}>{t('settings.preferences.save')}</Button>
      </div>
    </Card>
  );
};

const DataTab = ({ logout }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleExportJSON = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.data.export();
      
      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finmanager_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage(t('settings.data.exported'));
    } catch (error) {
      console.error('Export error:', error);
      setMessage(t('settings.data.export_failed') + ': ' + (error.message || t('common.unknown_error')));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.data.exportCsv();
      
      // Create downloadable CSV file
      const blob = new Blob([data.content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage(t('settings.data.transactions_exported'));
    } catch (error) {
      console.error('CSV export error:', error);
      setMessage(t('settings.data.export_failed') + ': ' + (error.message || t('settings.profile.unknown_error')));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // First confirmation
    if (!window.confirm(t('settings.data.confirm_delete_warning'))) {
      return;
    }
    
    // Second confirmation with explicit action. The word to type is
    // given in the language of the page, so it is one the person can
    // actually read and copy.
    const word = t('settings.data.confirm_word');
    const confirmationText = window.prompt(t('settings.data.confirm_prompt') + ' ("' + word + '")');
    if ((confirmationText || '').trim().toUpperCase() !== word.toUpperCase()) {
      if (confirmationText !== null) {
        alert(t('settings.data.confirm_invalid'));
      }
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.data.deleteAll(word);
      setMessage(t('settings.data.deleted'));
      
      // Show notification
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: {
          type: 'success',
          title: t('settings.data.deleted_title'),
          message: t('settings.data.deleted_message')
        }
      }));
      
      // Clear local storage and logout
      localStorage.clear();
      
      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = error.message || t('settings.data.delete_failed');
      setMessage(t('settings.data.delete_failed') + ': ' + errorMsg);
      
      // Show notification
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: {
          type: 'error',
          title: t('settings.data.delete_failed_title'),
          message: errorMsg
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">{t('settings.data.title')}</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-2">{t('settings.data.export')}</h3>
          <p className="text-sm text-gray-500 mb-3">
            {t('settings.data.export_description')}
          </p>
          <div className="flex gap-3">
            <Button onClick={handleExportJSON} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              {t('settings.data.export_json')}
            </Button>
            <Button variant="secondary" onClick={handleExportCSV} disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              {t('settings.data.export_csv')}
            </Button>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-medium mb-2 text-danger-600">{t('settings.data.danger_zone')}</h3>
          <p className="text-sm text-gray-500 mb-3">
            {t('settings.data.delete_description')}
          </p>
          <Button variant="danger" onClick={handleDelete} disabled={loading}>
            <Trash2 className="w-4 h-4 mr-2" />
            {t('settings.data.delete_all')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default Settings;
