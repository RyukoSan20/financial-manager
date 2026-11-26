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
  Palette,
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { getUserAvatarUrl, builtInAvatarOptions } from '../utils/avatarHelper';
import { amountSign, isIncoming, isOutgoing } from '../utils/transactionSign';
import { useTranslation } from '../i18n';
import { useOnDataMutated } from '../utils/dataSyncBus';
import DraggableSparkleMascot from '../components/mascot/DraggableSparkleMascot';

const StatTile = ({ icon: Icon, label, value, tone = 'neutral', sublabel }) => (
  <div className={`theme-stat-box${tone === 'income' ? ' theme-stat-box--income' : tone === 'expense' ? ' theme-stat-box--expense' : ''}`} data-tone={tone}>
    <div className="flex items-center gap-1.5 text-xs font-semibold">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
    <p className="text-lg font-extrabold mt-1 break-words tabular-nums">{value}</p>
    {sublabel && <p className="text-xs mt-0.5 opacity-80">{sublabel}</p>}
  </div>
);

const ProfileSummary = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Whether the reader is choosing a picture.
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  // The picture being chosen.
  const [avatarChoice, setAvatarChoice] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

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
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // The profile is the reader's own summary of their money, so it
  // hears about every write to a transaction and asks the server
  // again. A reader who recorded their lunch and then came here was
  // shown the spending from before they recorded it.
  useOnDataMutated(
    () => {
      load();
    },
    ['transaction']
  );

  /**
   * Choose one of our pictures.
   *
   * The picture is the reader's own, and it is one of ours. It is
   * written to the profile, and the page reads it back, so the
   * picture in the sidebar is the same one that is here.
   */
  const saveAvatar = async (option) => {
    if (savingAvatar) return;
    setSavingAvatar(true);
    setAvatarChoice(option.key);
    try {
      await api.request('/me', {
        method: 'PUT',
        body: JSON.stringify({ avatar_url: option.key }),
      });
      await load();
      setShowAvatarPicker(false);
    } catch (err) {
      console.error('The picture could not be saved:', err);
      setAvatarChoice(null);
    } finally {
      setSavingAvatar(false);
    }
  };

  if (loading) {
    return (
      <div className="theme-page-shell min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('profile.loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-page-shell min-h-screen flex items-center justify-center p-6">
        <div className="theme-card max-w-sm w-full p-5 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={load}
            className="theme-btn-primary"
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
    <div className="theme-page-shell min-h-screen pb-24" data-testid="profile-summary-page">
      {/* Header */}
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="theme-btn-ghost !px-3 !py-2"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="theme-section-title text-lg font-bold leading-tight">{t('profile.summary_title')}</h1>
          <p className="mt-1 text-xs opacity-75">{t('profile.summary_subtitle')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-4 p-4 pt-10">
        {/* The member row: the identity card, and the pass beside it */}
        <div className="grid gap-4 lg:grid-cols-2" data-testid="profile-top-row">
        {/* Identity card */}
        <section className="theme-card relative p-5 pt-6" data-testid="profile-identity-card">
          {/* The companion perches on the top edge of the card. */}
          <div className="absolute -top-9 right-5" data-testid="profile-companion">
            <DraggableSparkleMascot persona="koneko" size={72} hint={t('profile.drag_me', 'Geser aku!')} label="Koneko" />
          </div>
          <div className="flex items-start gap-4">
            {/* The picture of the reader.

                It is always one of ours. A reader who signed in with
                Google kept seeing their Google photo here - a
                picture of a person rather than a picture of a
                reader, from a server we do not control. */}
            {/* The picture, and the button that changes it.

                The picture and the button are one column, so the
                button is directly under the thing it changes. */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <img
                src={getUserAvatarUrl(identity)}
                alt={identity.display_name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#E5E7EB] bg-[#F7F6F2]"
                onError={(e) => {
                  // The drawn picture is the last line of defence: if
                  // even that fails, the initials are shown.
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.style.setProperty('display', 'flex');
                }}
              />
              <div
                className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-xl font-bold shrink-0 -mt-16"
                style={{ display: 'none' }}
              >
                {identity.initials}
              </div>

              {/* Choose another of our pictures.

                  The reader's picture is theirs to choose, and the
                  four we have are drawn by us - so they always work,
                  they are always the same size, and they never
                  point at a server we do not control. */}
              <button
                type="button"
                onClick={() => setShowAvatarPicker((v) => !v)}
                aria-expanded={showAvatarPicker}
                className="theme-badge !normal-case !tracking-normal hover:brightness-95 whitespace-nowrap"
              >
                <Palette className="w-3.5 h-3.5" aria-hidden="true" />
                {t('profile.change_avatar', 'Ubah Ikon Avatar')}
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold truncate pr-16">
                  {identity.display_name}
                </h2>
                {identity.is_verified && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <p className="text-sm opacity-70 truncate">
                {identity.email}
              </p>
              {identity.username && (
                <p className="text-xs opacity-60 mt-0.5">
                  @{identity.username}
                </p>
              )}
            </div>
          </div>

          {/* The four pictures.

              They are drawn by us, so they always work, they are
              always the same size, and they never point at a server
              we do not control. The reader picks one and it is
              theirs, here and in the sidebar and in the header. */}
          {showAvatarPicker ? (
            <div className="theme-stat-box mt-4" data-testid="avatar-picker">
              <p className="text-xs font-semibold mb-2.5">
                {t('profile.choose_avatar', 'Pilih ikon avatar')}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {builtInAvatarOptions().map((option) => {
                  const chosen =
                    (avatarChoice || identity.avatar_url || '').includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => saveAvatar(option)}
                      disabled={savingAvatar}
                      aria-label={option.name}
                      aria-pressed={chosen}
                      className={`w-12 h-12 rounded-full overflow-hidden ring-2 transition-[box-shadow,border-color,opacity] duration-150 disabled:opacity-50 ${
                        chosen
                          ? 'ring-primary-500 ring-offset-2 dark:ring-offset-gray-800'
                          : 'ring-transparent hover:ring-primary-300'
                      }`}
                    >
                      <img
                        src={option.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
              {savingAvatar ? (
                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  {t('common.saving', 'Menyimpan...')}
                </p>
              ) : null}
            </div>
          ) : null}

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

        {/* The member pass: a perforated forest-green ticket, like the invite ticket of the household */}
        <section className="theme-ticket-card hh-card-forest p-5" data-testid="profile-pass-card">
          <div className="hh-ticket px-6 py-5 text-center">
            <p className="text-[11px] font-extrabold tracking-[0.2em] opacity-90">
              {t('profile.pass_label', 'KARTU ANGGOTA')}
            </p>
            <p className="hh-code mt-2 text-3xl sm:text-4xl" data-pass-code>
              {`FM-${String(identity.username || identity.initials || 'USER').toUpperCase().slice(0, 8)}`}
            </p>
            <span className="theme-badge hh-badge mt-4 !px-4 !py-2 !text-xs" data-testid="profile-rank">
              {identity.is_verified ? t('profile.pass_verified', 'Anggota Terverifikasi') : t('profile.pass_member', 'Anggota')}
            </span>
          </div>
          <p className="mt-3 text-xs opacity-80">
            {identity.member_since ? `${t('profile.member_since')} ${identity.member_since.display}` : t('profile.pass_hint', 'Kartu ini milikmu.')}
          </p>
        </section>
        </div>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="profile-stats">
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
        <section className="theme-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
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
          <section className="theme-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-400" />
                {t('profile.recent_transactions')}
              </h3>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {recent_transactions.map((tx) => (
                <li key={tx.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isIncoming(tx.type)
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {isIncoming(tx.type) ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {tx.merchant_name || tx.description || (isIncoming(tx.type) ? t('transaction.income') : t('transaction.expense'))}
                    </p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                  <p
                    className={`text-sm font-semibold shrink-0 ${
                      isIncoming(tx.type) ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {amountSign(tx.type)}
                    {formatCurrency(tx.amount, tx.currency)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Login history */}
        {login_history?.length > 0 && (
          <section className="theme-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold flex items-center gap-2">
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
          className="theme-btn-primary w-full !justify-between !py-3.5"
          data-testid="profile-edit"
        >
          <span className="text-sm">
            {t('profile.edit_profile')}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ProfileSummary;
export { ProfileSummary };
