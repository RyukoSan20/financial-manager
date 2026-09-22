// Register Page with Supabase + Backend fallback

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Register = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });
  const { register, isSupabase } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (form.password) {
      checkStrength(form.password);
    }
  }, [form.password]);

  const checkStrength = (password) => {
    let score = 0;
    const feedback = [];
    
    if (password.length >= 8) score++;
    else feedback.push('Min. 8 karakter');
    
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Huruf besar');
    
    if (/[a-z]/.test(password)) score++;
    else feedback.push('Huruf kecil');
    
    if (/\d/.test(password)) score++;
    else feedback.push('Angka');
    
    if (/[!@#$%^&*]/.test(password)) score++;
    else feedback.push('Simbol (!@#$%)');
    
    setPasswordStrength({ score: Math.min(4, Math.max(0, score - 1)), feedback });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (form.password !== form.confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (passwordStrength.score < 2) {
      setError('Password terlalu lemah. Gunakan kombinasi huruf besar, kecil, angka, dan simbol.');
      return;
    }

    setLoading(true);

    try {
      await register(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registrasi gagal. Email mungkin sudah terdaftar.');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (score) => {
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600'];
    return colors[score] || colors[0];
  };

  const getStrengthLabel = (score) => {
    const labels = ['Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
    return labels[score] || labels[0];
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-600 p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">FinManager</h1>
          <p className="text-primary-100">Buat akun baru untuk memulai</p>
          {isSupabase && (
            <span className="inline-block mt-2 px-2 py-1 bg-white/20 rounded-full text-xs text-white">
              Powered by Supabase
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Register Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="nama@email.com"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
              
              {/* Password Strength Indicator */}
              {form.password && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          i <= passwordStrength.score ? getStrengthColor(passwordStrength.score) : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-medium ${
                      passwordStrength.score < 2 ? 'text-red-500' :
                      passwordStrength.score < 4 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {getStrengthLabel(passwordStrength.score)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {form.password.length}/8+ karakter
                    </span>
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {passwordStrength.feedback.map((f, i) => (
                        <span key={i} className="inline-block mr-2">• {f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Konfirmasi Password *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className={`w-full px-4 py-3 border rounded-xl outline-none transition-all focus:ring-2 focus:ring-primary-500 ${
                  form.confirmPassword && form.password !== form.confirmPassword 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-200'
                }`}
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">Password tidak cocok</p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Password harus:</p>
              <ul className="space-y-1 text-xs text-gray-500">
                <li className={`flex items-center gap-2 ${form.password.length >= 8 ? 'text-green-600' : ''}`}>
                  {form.password.length >= 8 ? '✓' : '○'} Min. 8 karakter
                </li>
                <li className={`flex items-center gap-2 ${/[A-Z]/.test(form.password) ? 'text-green-600' : ''}`}>
                  {/[A-Z]/.test(form.password) ? '✓' : '○'} Huruf besar (A-Z)
                </li>
                <li className={`flex items-center gap-2 ${/[a-z]/.test(form.password) ? 'text-green-600' : ''}`}>
                  {/[a-z]/.test(form.password) ? '✓' : '○'} Huruf kecil (a-z)
                </li>
                <li className={`flex items-center gap-2 ${/\d/.test(form.password) ? 'text-green-600' : ''}`}>
                  {/\d/.test(form.password) ? '✓' : '○'} Angka (0-9)
                </li>
                <li className={`flex items-center gap-2 ${/[!@#$%^&*]/.test(form.password) ? 'text-green-600' : ''}`}>
                  {/[!@#$%^&*]/.test(form.password) ? '✓' : '○'} Simbol (!@#$%)
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Processing...
                </>
              ) : 'Daftar Akun'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Sudah punya akun?
            </p>
            <Link
              to="/login"
              className="block w-full py-3 border-2 border-primary-600 text-primary-600 rounded-xl font-semibold text-center hover:bg-primary-50 transition-all"
            >
              Masuk
            </Link>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              Dengan daftar, Anda menyetujui{' '}
              <a href="/terms" className="text-primary-600 hover:underline">Syarat</a>
              {' '}dan{' '}
              <a href="/privacy" className="text-primary-600 hover:underline">Kebijakan Privasi</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
