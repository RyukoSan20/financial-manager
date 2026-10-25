import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Select } from '../components/ui';
import { User, Lock, Bell, Globe, Download, Trash2, Loader2, LogOut, Palette, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import { useCurrency, CURRENCIES, CURRENCY_CODES } from '../utils/currency';

export const Settings = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'security', label: t('settings.tabs.security'), icon: Lock },
    { id: 'preferences', label: t('settings.tabs.preferences'), icon: Globe },
    { id: 'data', label: t('settings.tabs.data'), icon: Download },
  ];

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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-64">
          <Card className="p-2">
            {tabs.map((tab) => (
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
      setMessage('Export failed: ' + (error.message || 'Unknown error'));
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
      await api.data.deleteAll();
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
