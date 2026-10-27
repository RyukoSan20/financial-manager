// Notifications Settings Page - backed by GET/PUT /api/settings/notifications
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';
import { batch2 } from '../../i18n/keys_batch2';
import ReminderSettings from '../../components/settings/ReminderSettings';

const DEFAULTS = {
  email_notifications: true,
  push_notifications: true,
  transaction_alerts: true,
  budget_alerts: true,
  weekly_summary: true,
  monthly_summary: false,
  reminder_frequency: 'weekly',
  reminder_days_before: 3
};

const NotificationSettings = () => {
  const { t, language } = useTranslation();
  const K = batch2[language]?.notification || batch2.id.notification;
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.request('/settings/notifications');
      setSettings({ ...DEFAULTS, ...(data || {}) });
    } catch (e) {
      console.error('Load notification settings error:', e);
      setError(e.message || K.load_error);
    } finally {
      setLoading(false);
    }
  }, [K]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.request('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      setMessage(t('notification_settings.saved'));
      await load();
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
        <div className="text-gray-500">{t('notification_settings.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">{t('notification_settings.title')}</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {message && (
          <div className="p-3 bg-green-100 text-green-700 rounded-lg">{message}</div>
        )}
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('notification_settings.subtitle')}</h2>

          <div className="space-y-4">
            <ToggleItem
              title={t('notification_settings.email')}
              description={K.desc_email}
              checked={settings.email_notifications}
              onChange={() => handleToggle('email_notifications')}
            />

            <ToggleItem
              title={t('notification_settings.push')}
              description={K.desc_push}
              checked={settings.push_notifications}
              onChange={() => handleToggle('push_notifications')}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{K.alerts_title}</h2>

          <div className="space-y-4">
            <ToggleItem
              title={t('notification_settings.transaction')}
              description={t('notification_settings.large_transaction')}
              checked={settings.transaction_alerts}
              onChange={() => handleToggle('transaction_alerts')}
            />

            <ToggleItem
              title={t('notification_settings.budget')}
              description={K.desc_budget}
              checked={settings.budget_alerts}
              onChange={() => handleToggle('budget_alerts')}
            />

            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {K.reminder_frequency}
              </label>
              <select
                value={settings.reminder_frequency}
                onChange={(e) => setSettings({ ...settings, reminder_frequency: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="daily">{t('notification_settings.daily')}</option>
                <option value="weekly">{t('notification_settings.weekly')}</option>
                <option value="monthly">{t('notification_settings.monthly')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {K.reminder_days_before}
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={settings.reminder_days_before}
                onChange={(e) =>
                  setSettings({ ...settings, reminder_days_before: Number(e.target.value) || 0 })
                }
                className="w-full p-3 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">{t('notification_settings.report')}</h2>

          <div className="space-y-4">
            <ToggleItem
              title={t('notification_settings.weekly_summary')}
              description={K.desc_weekly}
              checked={settings.weekly_summary}
              onChange={() => handleToggle('weekly_summary')}
            />

            <ToggleItem
              title={t('notification_settings.monthly_summary')}
              description={K.desc_monthly}
              checked={settings.monthly_summary}
              onChange={() => handleToggle('monthly_summary')}
            />
          </div>
        </div>

        {/* The reminders. This is its own panel, because the reminders
            are opt-in and are shown by the browser on this device. */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <ReminderSettings />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
        >
          {saving ? t('notification_settings.saving') : '💾 ' + t('notification_settings.save')}
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

export default NotificationSettings;
