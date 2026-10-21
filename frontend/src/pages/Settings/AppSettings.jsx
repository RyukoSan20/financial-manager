// App Settings Page - Theme, Language, Currency, etc.
import { useState, useEffect } from 'react';

const AppSettings = () => {
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'id',
    currency: 'IDR',
    date_format: 'DD/MM/YYYY',
    start_of_week: 'monday',
    auto_backup: false,
    biometric_login: false
  });
  const [saving, setSaving] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('app_settings', JSON.stringify(settings));
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-blue-500 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">⚙️ Pengaturan Aplikasi</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Tampilan</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tema</label>
              <div className="flex gap-2">
                {['light', 'dark', 'system'].map(t => (
                  <button
                    key={t}
                    onClick={() => setSettings({...settings, theme: t})}
                    className={`flex-1 py-2 px-4 rounded-lg border ${
                      settings.theme === t 
                        ? 'bg-blue-500 text-white border-blue-500' 
                        : 'bg-white text-gray-700'
                    }`}
                  >
                    {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '💻 System'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bahasa</label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({...settings, language: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="id">🇮🇩 Indonesia</option>
                <option value="en">🇺🇸 English</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Regional</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mata Uang</label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({...settings, currency: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="IDR">🇮🇩 Rupiah (IDR)</option>
                <option value="USD">🇺🇸 Dollar (USD)</option>
                <option value="EUR">🇪🇺 Euro (EUR)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format Tanggal</label>
              <select
                value={settings.date_format}
                onChange={(e) => setSettings({...settings, date_format: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minggu dimulai</label>
              <select
                value={settings.start_of_week}
                onChange={(e) => setSettings({...settings, start_of_week: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="monday">Senin</option>
                <option value="sunday">Minggu</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-lg mb-4">Keamanan</h2>
          
          <div className="space-y-4">
            <ToggleItem
              title="Backup Otomatis"
              description="Backup data setiap hari"
              checked={settings.auto_backup}
              onChange={() => setSettings({...settings, auto_backup: !settings.auto_backup})}
            />
            
            <ToggleItem
              title="Login Biometrik"
              description="Gunakan sidik jari/face ID"
              checked={settings.biometric_login}
              onChange={() => setSettings({...settings, biometric_login: !settings.biometric_login})}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
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
      className={`w-12 h-7 rounded-full transition-colors ${
        checked ? 'bg-blue-500' : 'bg-gray-300'
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
