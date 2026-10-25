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
import { useTranslation } from '../i18n';

const StatTile = ({ icon: Icon, label, value, tone = 'neutral', sublabel }) => {
  const tones = {
    neutral: 'bg-gray-50 text-gray-700 border-gray-100',
    income: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    expense: 'bg-rose-50 text-rose-700 border-rose-100',
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
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
  const { t } = useTranslation();
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
      setError(e.message || t('profile.load_error'));
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
          <span>{t('profile.loading')}</span>
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
            className="px-4 py-2 bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-800"
          >
            {t('profile.retry')}
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
      <div className="bg-primary-700 text-white px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">{t('profile.summary_title')}</h1>
            <p className="text-xs text-primary-100">{t('profile.summary_subtitle')}</p>
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
                className="w-16 h-16 rounded-full object-cover border-2 border-primary-100"
                onError={(e) => {
                  // Fall back to the initials avatar if the image URL breaks.
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.style.setProperty('display', 'flex');
                }}
              />
            ) : null}
            <div
              className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-xl font-bold shrink-0"
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
                <p className="text-xs text-gray-400 dark:text-gray-300 mt-0.5">
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
                {t('profile.member_since')} {identity.member_since.display}
              </div>
            )}
            {identity.last_login && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <History className="w-4 h-4 text-gray-400" />
                {t('profile.last_login')} {new Date(identity.last_login).toLocaleString('id-ID')}
              </div>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            icon={TrendingUp}
            label={t('profile.total_income')}
            value={formatCurrency(stats.total_income)}
            tone="income"
          />
          <StatTile
            icon={TrendingDown}
            label={t('profile.total_expense')}
            value={formatCurrency(stats.total_expense)}
            tone="expense"
          />
          <StatTile
            icon={Wallet}
            label={t('profile.account_balance')}
            value={formatCurrency(stats.account_balance)}
            tone="primary"
            sublabel={t('profile.account_count').replace('%count%', stats.account_count)}
          />
          <StatTile
            icon={Receipt}
            label={t('profile.total_transactions')}
            value={stats.transaction_count}
            sublabel={t('profile.receipts_scanned').replace('%count%', stats.receipt_scan_count)}
          />
          <StatTile
            icon={Flame}
            label={t('profile.active_streak')}
            value={`${stats.current_streak} ${t('profile.day_streak')}`}
            sublabel={t('profile.active_days_30').replace('%count%', stats.active_days)}
          />
          <StatTile
            icon={UserIcon}
            label={t('profile.currency')}
            value={identity.default_currency}
            sublabel={identity.timezone}
          />
        </section>

        {/* Activity history */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              {t('profile.history')}
            </h3>
            <span className="text-xs text-gray-400">{t('profile.last_30_days')}</span>
          </div>

          {history.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">
              {t('profile.no_activity')}
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
                      {t('profile.transaction_count').replace('%count%', h.total_count)}
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
                {t('profile.recent_transactions')}
              </h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {recent_transactions.map((tx) => (
                <li key={tx.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'income'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {tx.type === 'income' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {tx.merchant_name || tx.description || (tx.type === 'income' ? t('transaction.income') : t('transaction.expense'))}
                    </p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                  <p
                    className={`text-sm font-semibold shrink-0 ${
                      tx.type === 'income' ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
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
                {t('profile.login_history')}
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
            {t('profile.edit_profile')}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default ProfileSummary;
export { ProfileSummary };
