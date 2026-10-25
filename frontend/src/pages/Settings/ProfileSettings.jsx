// Profile Settings Page - backed by GET/PUT /api/me
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useTranslation } from '../../i18n';

const ProfileSettings = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    full_name: '',
    phone: '',
    avatar_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const user = await api.request('/me');
      setProfile({
        username: user.username || '',
        email: user.email || '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        avatar_url: user.avatar_url || ''
      });
    } catch (e) {
      console.error('Load profile error:', e);
      setError(e.message || 'Gagal memuat profil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.request('/me', {
        method: 'PUT',
        body: JSON.stringify({
          username: profile.username,
          full_name: profile.full_name,
          phone: profile.phone,
          avatar_url: profile.avatar_url
        })
      });
      setMessage(t('profile_settings.saved'));
      await loadProfile();
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">{t('profile_settings.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary-600 text-white p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">{t('profile_settings.title')}</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {message && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-bold text-lg mb-4">{t('profile_settings.subtitle')}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder={t('profile_settings.username')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile_settings.email')}
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full p-3 border rounded-lg bg-gray-100 text-gray-600"
                  placeholder="email@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('profile_settings.email_locked')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder={t('profile_settings.full_name')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  No. Telepon
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Foto Profil
                </label>
                <input
                  type="url"
                  value={profile.avatar_url}
                  onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder={t('profile_settings.website')}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
