// Notifications Settings Page - backed by GET/PUT /api/settings/notifications
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

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
      setError(e.message || 'Gagal memuat pengaturan notifikasi');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setMessage('Pengaturan notifikasi disimpan!');
      await load();
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message || 'Gagal menyimpan pengaturan notifikasi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Memuat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">🔔 Notifikasi</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {message && (
          <div className="p-3 bg-green-100 text-green-700 rounded-lg">{message}</div>
        )}
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Pengaturan Notifikasi</h2>

          <div className="space-y-4">
            <ToggleItem
              title="Notifikasi Email"
              description="Terima notifikasi via email"
              checked={settings.email_notifications}
              onChange={() => handleToggle('email_notifications')}
            />

            <ToggleItem
              title="Push Notification"
              description="Terima notifikasi di browser"
              checked={settings.push_notifications}
              onChange={() => handleToggle('push_notifications')}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Alert & Reminder</h2>

          <div className="space-y-4">
            <ToggleItem
              title="Alert Transaksi"
              description="Notifikasi untuk transaksi besar"
              checked={settings.transaction_alerts}
              onChange={() => handleToggle('transaction_alerts')}
            />

            <ToggleItem
              title="Alert Budget"
              description="Peringatan saat budget hampir habis"
              checked={settings.budget_alerts}
              onChange={() => handleToggle('budget_alerts')}
            />

            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frekuensi Reminder
              </label>
              <select
                value={settings.reminder_frequency}
                onChange={(e) => setSettings({ ...settings, reminder_frequency: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="daily">Harian</option>
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ingatkan berapa hari sebelumnya
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
          <h2 className="font-bold text-lg mb-4">Laporan</h2>

          <div className="space-y-4">
            <ToggleItem
              title="Ringkasan Mingguan"
              description="Kirim ringkasan setiap minggu"
              checked={settings.weekly_summary}
              onChange={() => handleToggle('weekly_summary')}
            />

            <ToggleItem
              title="Ringkasan Bulanan"
              description="Kirim ringkasan setiap bulan"
              checked={settings.monthly_summary}
              onChange={() => handleToggle('monthly_summary')}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : '💾 Simpan'}
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
