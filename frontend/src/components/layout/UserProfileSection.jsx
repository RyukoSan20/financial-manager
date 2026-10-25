/**
 * UserProfileSection - the interactive profile card in the navigation.
 *
 * Replaces the old static "User / user@example.com" text. It now:
 *   - shows the real user from the API (name, email, avatar),
 *   - shows a live activity history strip and identity chips,
 *   - and routes to the Profile Summary page when clicked.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, ChevronRight, Loader2, History, Mail, CalendarDays, Activity } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useTranslation } from '../../i18n';

export const UserProfileSection = ({ variant = 'menu', onNavigate }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.request('/profile/summary');
      setSummary(data);
    } catch (e) {
      // A failed summary must never break the navigation menu.
      console.warn('Profile section load failed:', e?.message || e);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClick = () => {
    if (onNavigate) onNavigate();
    navigate('/profile/summary');
  };

  const identity = summary?.identity;
  const stats = summary?.stats;

  const displayName = identity?.display_name || 'Pengguna';
  const displayEmail = identity?.email || '';
  const initials = identity?.initials || 'U';
  const avatarUrl = identity?.avatar_url;

  const activeDays = stats?.active_days ?? 0;
  const streak = stats?.current_streak ?? 0;
  const txCount = stats?.transaction_count ?? 0;

  return (
    <button
      onClick={handleClick}
      className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
      aria-label="Buka ringkasan profil"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-base font-bold shrink-0 overflow-hidden">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('bg-primary-500');
            }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Identity + activity summary */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400 shrink-0" />}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</p>

        {/* Profile History - live counters from the API */}
        {summary && (
          <div className="flex items-center gap-2.5 mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-0.5" title={t('profile_card.transactions_title')}>
              <Activity className="w-2.5 h-2.5" />
              {txCount} {t('profile_card.transactions')}
            </span>
            <span className="inline-flex items-center gap-0.5" title={t('profile_card.active_days_title')}>
              <History className="w-2.5 h-2.5" />
              {activeDays} {t('profile_card.active_days')}
            </span>
            {streak > 0 && (
              <span className="inline-flex items-center gap-0.5 text-orange-500 font-medium">
                🔥 {streak} {t('profile_card.days')}
              </span>
            )}
          </div>
        )}

        {/* Identity chips */}
        {summary && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
            {identity.member_since && (
              <span className="inline-flex items-center gap-0.5">
                <CalendarDays className="w-2.5 h-2.5" />
                {identity.member_since.display}
              </span>
            )}
            {stats && stats.account_balance !== 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Mail className="w-2.5 h-2.5" />
                {formatCurrency(stats.account_balance)}
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-primary-500 transition-colors" />
    </button>
  );
};

export default UserProfileSection;
