/**
 * Profile Summary page.
 *
 * The destination of the interactive User Profile section in the navigation.
 * Shows the user's identity, their activity history and lifetime stats.
 * All data comes from GET /api/profile/summary - nothing is hardcoded.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Camera,
  CalendarDays,
  Flame,
  Mail,
  Phone,
  User as UserIcon,
  CheckCircle2,
  History,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';

const StatTile = ({ icon: Icon, label, value, tone = 'neutral', sublabel }) => {
  const tones = {
    neutral: 'bg-gray-50 text-gray-700 border-gray-100',
    income: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    expense: 'bg-rose-50 text-rose-700 border-rose-100',
    primary: 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold mt-1 break-words">{value}</p>
      {sublabel && <p className="text-xs opacity-70 mt-0.5">{sublabel}</p>}
    </div>
  );
};

const ProfileSummary = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const summary = await api.request('/profile/summary');
      setData(summary);
    } catch (e) {
      console.error('Profile summary error:', e);
      setError(e.message || 'Gagal memuat profil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Memuat profil...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-xl p-5 text-center border border-gray-200 dark:border-gray-700">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { identity, stats, history, recent_transactions, login_history } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-blue-700 text-white px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Ringkasan Profil</h1>
            <p className="text-xs text-blue-100">Identitas &amp; riwayat aktivitas</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Identity card */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-start gap-4">
            {identity.avatar_url ? (
              <img
                src={identity.avatar_url}
                alt={identity.display_name}
                className="w-16 h-16 rounded-full object-cover border-2 border-blue-100"
                onError={(e) => {
                  // Fall back to the initials avatar if the image URL breaks.
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.style.setProperty('display', 'flex');
                }}
              />
            ) : null}
            <div
              className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold shrink-0"
              style={{ display: identity.avatar_url ? 'none' : 'flex' }}
            >
              {identity.initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 dark:text-white truncate">
                  {identity.display_name}
                </h2>
                {identity.is_verified && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {identity.email}
              </p>
              {identity.username && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  @{identity.username}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
            {identity.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Phone className="w-4 h-4 text-gray-400" />
                {identity.phone}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Mail className="w-4 h-4 text-gray-400" />
              {identity.email}
            </div>
            {identity.member_since && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                Bergabung sejak {identity.member_since.display}
              </div>
            )}
            {identity.last_login && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <History className="w-4 h-4 text-gray-400" />
                Login terakhir {new Date(identity.last_login).toLocaleString('id-ID')}
              </div>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            icon={TrendingUp}
            label="Total Pemasukan"
            value={formatCurrency(stats.total_income)}
            tone="income"
          />
          <StatTile
            icon={TrendingDown}
            label="Total Pengeluaran"
            value={formatCurrency(stats.total_expense)}
            tone="expense"
          />
          <StatTile
            icon={Wallet}
            label="Saldo Akun"
            value={formatCurrency(stats.account_balance)}
            tone="primary"
            sublabel={`${stats.account_count} akun`}
          />
          <StatTile
            icon={Receipt}
            label="Total Transaksi"
            value={stats.transaction_count}
            sublabel={`${stats.receipt_scan_count} struk discan`}
          />
          <StatTile
            icon={Flame}
            label="Aktif Berturut"
            value={`${stats.current_streak} hari`}
            sublabel={`${stats.active_days} hari aktif (30 hari terakhir)`}
          />
          <StatTile
            icon={UserIcon}
            label="Mata Uang"
            value={identity.default_currency}
            sublabel={identity.timezone}
          />
        </section>

        {/* Activity history */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              Riwayat Aktivitas
            </h3>
            <span className="text-xs text-gray-400">30 hari terakhir</span>
          </div>

          {history.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">
              Belum ada aktivitas transaksi dalam 30 hari terakhir.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((h) => (
                <li key={h.date} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-11 shrink-0 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                      {h.display.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase">
                      {h.display.split(' ')[1]}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {h.total_count} transaksi
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-0.5">
                      {h.income > 0 && (
                        <span className="text-emerald-600 font-medium">
                          +{formatCurrency(h.income)}
                        </span>
                      )}
                      {h.expense > 0 && (
                        <span className="text-rose-600 font-medium">
                          -{formatCurrency(h.expense)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        h.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {h.net >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(h.net))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent transactions */}
        {recent_transactions?.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-400" />
                Transaksi Terbaru
              </h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {recent_transactions.map((t) => (
                <li key={t.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      t.type === 'income'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {t.type === 'income' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {t.merchant_name || t.description || (t.type === 'income' ? 'Pemasukan' : 'Pengeluaran')}
                    </p>
                    <p className="text-xs text-gray-400">{t.date}</p>
                  </div>
                  <p
                    className={`text-sm font-semibold shrink-0 ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Login history */}
        {login_history?.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-gray-400" />
                Riwayat Login
              </h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {login_history.map((l, idx) => (
                <li key={`${l.at}-${idx}`} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{l.action}</p>
                    {l.ip_address && (
                      <p className="text-xs text-gray-400">IP {l.ip_address}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">
                    {l.at ? new Date(l.at).toLocaleString('id-ID') : '-'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Action */}
        <button
          onClick={() => navigate('/settings/profile')}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Edit profil &amp; informasi akun
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default ProfileSummary;
export { ProfileSummary };
