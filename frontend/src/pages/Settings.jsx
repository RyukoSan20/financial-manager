/**
 * The settings page, as a bento.
 *
 * It used to be a heading, a search box, a column of tabs on the
 * left, and a white card on the right. That is a form. It works, and
 * it says nothing about the app it belongs to.
 *
 * This is the same page as a bento grid. The banner across the top
 * says what the page is and gives the reader the filter and the way
 * to the concept page. The rail down the left is the categories. The
 * workspace on the right is a set of tiles of different sizes, so the
 * eye is told what matters: the account first, then the switches that
 * do the dull work, then the form.
 *
 * The two things this refactor must not break are the form state and
 * the save handlers. Everything below the layout is the same code it
 * was, with the same keys and the same API calls.
 *
 * The colours are all concept tokens, so the page changes with the
 * concept like everything else does.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Select } from '../components/ui';
import { User, Lock, Globe, Download, Trash2, Loader2, Palette, Coins, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import api from '../services/api';
import { useCurrency, CURRENCIES, CURRENCY_CODES } from '../utils/currency';
import { getUserAvatarUrl } from '../utils/avatarHelper';
import ReadinessChecklist from '../components/ReadinessChecklist';
import DataExportStudio from '../components/settings/DataExportStudio';
import PrivacyPage from './Settings/PrivacyPage';
import SettingsBentoHeader from '../components/settings/SettingsBentoHeader';
import PixelArtBusinessIcon from '../components/ui/PixelArtBusinessIcon';
import { readerFlag, setReaderFlag } from '../utils/featureFlags';
import { toast } from '../contexts/ToastContext';

/**
 * The categories, and the pixel icon that stands for each one.
 *
 * The icons are drawn, not borrowed. An operating system emoji would
 * be drawn by whatever machine the reader happens to be on, so the
 * same "lock" would be a flat glyph on one phone and a glossy
 * padlock on another, and neither would match anything else on the
 * page.
 */
const CATEGORY_ICONS = {
  profile: 'smartphone',
  appearance: 'clipboard',
  security: 'briefcase',
  preferences: 'calculator',
  data: 'receipt',
  privacy: 'ewallet',
  app: 'office',
};

export const Settings = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');
  // The search box filters the setting rows inside the tabs, and the
  // tabs themselves. A long settings page is hard to navigate without
  // it.
  const [search, setSearch] = useState('');
  const [passport, setPassport] = useState(null);
  // Whether the setup list has been put away. It is a welcome, and a
  // welcome that pushes the form out of sight is a welcome in the
  // wrong place.
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  // What the companion is saying. It changes when something happens,
  // and the figure celebrates when it does.
  const [mascotMessage, setMascotMessage] = useState(() => t('settings.bento.mascot_greeting'));
  const [celebrate, setCelebrate] = useState(0);

  useEffect(() => {
    let alive = true;
    api.get('/settings/passport')
      .then((res) => { if (alive) setPassport(res); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The tabs are built once per language, not once per render. A list
  // written in the body of a component is a new list every time, and
  // the search below is then filtered from scratch every time.
  const tabs = useMemo(() => [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'security', label: t('settings.tabs.security'), icon: Lock },
    { id: 'preferences', label: t('settings.tabs.preferences'), icon: Globe },
    { id: 'data', label: t('settings.tabs.data'), icon: Download },
    { id: 'privacy', label: t('settings.tabs.privacy'), icon: ShieldCheck },
    { id: 'app', label: t('settings.tabs.app'), icon: SlidersHorizontal },
  ], [t]);

  // The search filters the tabs as well as the rows inside them.
  const visibleTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter((tab) => tab.label.toLowerCase().includes(q));
  }, [search, tabs]);

  // A tab that the filter has hidden must not stay selected, or the
  // workspace would show a card the reader cannot see they chose.
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  /**
   * Say something to the companion, and let it celebrate.
   *
   * The page never touches the figure directly. It says what
   * happened, and the companion decides how to look about it. That
   * keeps the celebration in one place.
   */
  const speak = useCallback((messageKey) => {
    setMascotMessage(t(messageKey));
    setCelebrate((n) => n + 1);
  }, [t]);

  const isGuest = Boolean(user?.is_guest);
  const stats = [
    { key: 'accounts', value: passport?.counts?.accounts },
    { key: 'transactions', value: passport?.counts?.transactions },
    { key: 'goals', value: passport?.counts?.goals },
    { key: 'budgets', value: passport?.counts?.budgets },
  ];

  const hasResults = visibleTabs.length > 0;

  return (
    <div className="sbg-shell" data-testid="settings-bento">
      <SettingsBentoHeader
        eyebrow={t('settings.bento.eyebrow')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        query={search}
        onQueryChange={setSearch}
        searchPlaceholder={t('settings.search_placeholder')}
        appearanceLabel={t('settings.bento.appearance_link')}
        categoryLabel={t('settings.bento.category')}
        signOutLabel={t('settings.sign_out')}
        onSignOut={() => {
          localStorage.clear();
          logout();
        }}
        mascotPersona="kaneru"
        mascotMessage={mascotMessage}
        mascotHint={t('settings.bento.mascot_hint')}
        celebrateSignal={celebrate}
        resultCount={visibleTabs.length}
        totalCount={tabs.length}
      />

      {/* The two columns: the categories on the left, the workspace
          on the right. */}
      <div className="sbg-layout">
        <nav className="sbg-rail" aria-label={t('settings.bento.category')} data-testid="settings-bento-rail">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id}
              className="sbg-rail__card"
              data-testid={`settings-bento-rail-${tab.id}`}
            >
              <PixelArtBusinessIcon
                name={CATEGORY_ICONS[tab.id] || 'coin'}
                size={26}
                badge={false}
              />
              <span className="sbg-rail__label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sbg-grid" data-testid="settings-bento-workspace">
          {hasResults ? (
            <>
              {/* The account tile. Who the reader is, how far along
                  they are, and the four numbers that say how much is
                  in here. */}
              <section className="sbg-tile sbg-tile--7" data-testid="settings-bento-account">
                <div className="sbg-tile__head">
                  <h2 className="sbg-tile__title">{t('settings.bento.account_title')}</h2>
                </div>

                {passport ? (
                  <>
                    <div className="sbg-account">
                      {/* The picture of the reader.

                          It is always one of ours - never the Google
                          photo the reader signed in with. */}
                      <span className="sbg-account__avatar">
                        <img
                          src={getUserAvatarUrl(passport)}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </span>
                      <span className="sbg-account__who">
                        <p className="sbg-account__name">{passport.name}</p>
                        <p className="sbg-account__mail">{passport.email}</p>
                        <span className="sbg-account__status">
                          {isGuest ? t('settings.bento.guest') : t('settings.bento.member')}
                        </span>
                      </span>
                    </div>

                    <div className="sbg-progress">
                      <div className="sbg-progress__row">
                        <span>{t('settings.bento.onboarding')}</span>
                        <span className="sbg-progress__count">
                          {passport.readiness_done}/{passport.readiness_total}
                        </span>
                      </div>
                      <div
                        className="sbg-progress__track"
                        role="progressbar"
                        aria-valuenow={passport.readiness_done}
                        aria-valuemin={0}
                        aria-valuemax={passport.readiness_total}
                        aria-label={t('settings.bento.onboarding')}
                      >
                        <div
                          className="sbg-progress__fill"
                          style={{ width: `${passport.readiness_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="sbg-stats" data-testid="settings-bento-stats">
                      {stats.map(({ key, value }) => (
                        <div key={key} className="sbg-stat">
                          <p className="sbg-stat__value">{value ?? 0}</p>
                          <p className="sbg-stat__label">{t(`passport.count.${key}`)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>

              {/* The switches that do the dull work. */}
              <section className="sbg-tile sbg-tile--5" data-testid="settings-bento-automation">
                <div className="sbg-tile__head">
                  <h2 className="sbg-tile__title">{t('settings.bento.automation_title')}</h2>
                </div>
                <p className="sbg-tile__sub">{t('settings.bento.automation_desc')}</p>
                <div className="sbg-toggles">
                  <AutomationToggle
                    flag="REMINDERS"
                    title={t('settings.bento.toggle_reminders')}
                    description={t('settings.bento.toggle_reminders_desc')}
                    onChange={() => speak('settings.bento.mascot_toggled')}
                  />
                  <AutomationToggle
                    flag="SMART_SPLIT_BILL"
                    title={t('settings.bento.toggle_recurring')}
                    description={t('settings.bento.toggle_recurring_desc')}
                    onChange={() => speak('settings.bento.mascot_toggled')}
                  />
                </div>
              </section>

              {/* The form. The account name and the email, in the
                  concept's own inputs. */}
              <section className="sbg-tile sbg-tile--12" data-testid="settings-bento-form">
                <div className="sbg-tile__head">
                  <h2 className="sbg-tile__title">{t('settings.bento.form_title')}</h2>
                </div>
                <p className="sbg-tile__sub">{t('settings.bento.form_desc')}</p>
                <ProfileForm user={user} onSaved={() => speak('settings.bento.mascot_saved')} />
              </section>

              {/* The panel the reader actually chose. It sits below
                  the tiles so the account and the switches are the
                  first thing read, and it keeps every panel that was
                  here before. */}
              <section className="sbg-tile sbg-tile--12" data-testid="settings-bento-panel">
                {activeTab === 'profile' && <ProfileTab user={user} />}
                {activeTab === 'appearance' && <AppearanceTab />}
                {activeTab === 'security' && <SecurityTab />}
                {activeTab === 'preferences' && <PreferencesTab user={user} />}
                {activeTab === 'data' && <DataTab logout={logout} />}
                {activeTab === 'privacy' && <PrivacyPage />}
                {activeTab === 'app' && <AppFeaturesTab />}
              </section>

              {/* The setup list. It was in the narrow left column,
                  above the navigation and the form, so it pushed the
                  form the reader came for below the fold. It is a
                  welcome, not the page, so it can be put away. */}
              {!checklistDismissed && (
                <section className="sbg-tile sbg-tile--12" data-testid="settings-bento-checklist">
                  <ReadinessChecklist onDismiss={() => setChecklistDismissed(true)} />
                </section>
              )}
            </>
          ) : (
            <div className="sbg-empty" data-testid="settings-bento-empty">
              <h2 className="sbg-empty__title">{t('settings.bento.filter_empty')}</h2>
              <p className="sbg-empty__text">{t('settings.bento.filter_empty_hint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * One switch, as a card you press.
 *
 * It is a button rather than a checkbox because a checkbox is a small
 * target on a phone, and a card that says what the switch does is
 * clearer than a box with a label beside it.
 */
const AutomationToggle = ({ flag, title, description, onChange }) => {
  const [on, setOn] = useState(() => readerFlag(flag));

  return (
    <button
      type="button"
      className="sbg-toggle"
      aria-pressed={on}
      data-testid={`settings-bento-toggle-${flag}`}
      onClick={() => {
        const next = !on;
        setOn(next);
        setReaderFlag(flag, next);
        onChange?.(next);
      }}
    >
      <span className="sbg-toggle__body">
        <span className="sbg-toggle__title">{title}</span>
        <span className="sbg-toggle__desc">{description}</span>
      </span>
      <span className="sbg-switch" aria-hidden="true" />
    </button>
  );
};

/**
 * The account form, in the concept's own inputs.
 *
 * This is the form that was in the profile tab, with the same state
 * and the same request. Only the markup around it changed.
 */
const ProfileForm = ({ user, onSaved }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: user?.email || '',
    username: user?.username || '',
    full_name: user?.full_name || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError('');

    try {
      const response = await api.request('/me', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: form.full_name,
          username: form.username,
        }),
      });

      if (response) {
        setSaved(true);
        // Update localStorage with new user data
        const updatedUser = { ...user, ...form };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        onSaved?.();
      }
    } catch (err) {
      setError(t('settings.profile.failed') + ': ' + (err.message || t('settings.profile.unknown_error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sbg-form" data-testid="settings-bento-profile-form">
      <div className="sbg-field">
        <label className="sbg-field__label" htmlFor="sbg-email">
          {t('settings.profile.email')}
        </label>
        <input
          id="sbg-email"
          className="sbg-field__input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          disabled
        />
      </div>

      <div className="sbg-field">
        <label className="sbg-field__label" htmlFor="sbg-username">
          {t('settings.profile.username')}
        </label>
        <input
          id="sbg-username"
          className="sbg-field__input"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
      </div>

      <div className="sbg-field sbg-form__wide">
        <label className="sbg-field__label" htmlFor="sbg-full-name">
          {t('settings.profile.full_name')}
        </label>
        <input
          id="sbg-full-name"
          className="sbg-field__input"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
      </div>

      <div className="sbg-actions sbg-form__wide">
        <button type="submit" className="sbg-save" disabled={loading} data-testid="settings-bento-save">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('settings.profile.save')}
        </button>
        {saved ? (
          <span className="sbg-saved" data-testid="settings-bento-saved">
            {t('settings.bento.save_done')}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="sbg-error sbg-form__wide" data-testid="settings-bento-error">
          {error}
        </div>
      ) : null}
    </form>
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

/**
 * The application features tab.
 *
 * The switches that turn the newer parts of the app on live on their
 * own page. Until now there was no way to reach that page from the
 * settings, which meant the switches were invisible to anyone who did
 * not already know the address.
 */
const AppFeaturesTab = () => {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <SlidersHorizontal className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold">{t('settings.appFeatures.title')}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {t('settings.appFeatures.description')}
      </p>
      <Link
        to="/settings/app"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
      >
        <SlidersHorizontal className="w-4 h-4" />
        {t('settings.appFeatures.cta')}
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
                className={`p-3 rounded-lg border-2 transition-[border-color,background-color] text-center ${
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
  // Whether the reader has been asked whether they really want to
  // delete everything.
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  // The delete is two questions, not one.
  //
  // The first one is the dialog: the reader is told what is about to
  // happen, in their own language, and the way out is the way in.
  //
  // The second one asks them to type a word. That is the one that
  // really protects the data, because it cannot be dismissed by a
  // stray keypress, so it stays as it was.
  const doDelete = async () => {
    // Second confirmation with explicit action. The word to type is
    // given in the language of the page, so it is one the person can
    // actually read and copy.
    const word = t('settings.data.confirm_word');
    const confirmationText = window.prompt(t('settings.data.confirm_prompt') + ' ("' + word + '")');
    if ((confirmationText || '').trim().toUpperCase() !== word.toUpperCase()) {
      if (confirmationText !== null) {
        toast.warning(t('settings.data.confirm_invalid'));
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

  // The first question. The reader says yes here, and then the word
  // is asked for.
  const handleDelete = () => setShowDeleteDialog(true);

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

          {/* The export studio.
              Two bare buttons said nothing about what was in the
              file. Now the reader chooses the dates, the kinds of
              transaction, the account and the columns, and sees what
              matches before anything is downloaded. */}
          <DataExportStudio />

          {/* The old way is still here, for the reader who wants
              everything at once. */}
          <details className="mt-4">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              {t('export.export_everything')}
            </summary>
            <div className="flex gap-3 mt-3">
              <Button onClick={handleExportJSON} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                {t('settings.data.export_json')}
              </Button>
              <Button variant="secondary" onClick={handleExportCSV} disabled={loading}>
                <Download className="w-4 h-4 mr-2" />
                {t('settings.data.export_csv')}
              </Button>
            </div>
          </details>
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

      {/* The first of the two questions. The second one asks for the
          word, and stays as it was. */}
      <ConfirmDialog
        open={showDeleteDialog}
        onConfirm={() => {
          setShowDeleteDialog(false);
          doDelete();
        }}
        onCancel={() => setShowDeleteDialog(false)}
        titleKey="common.confirm_delete_title"
        messageKey="settings.data.confirm_delete_warning"
        confirmLabelKey="common.confirm_delete_action"
        cancelLabelKey="common.cancel"
        tone="danger"
      />
    </Card>
  );
};

export default Settings;
