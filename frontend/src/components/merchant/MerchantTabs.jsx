import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Banknote,
  Receipt,
  BookOpen,
  Settings2,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { batch12 } from '../../i18n/keys_batch12';
import { toast } from '../../contexts/ToastContext';
import merchantApi from '../../services/merchantApi';
import MerchantTill from './MerchantTill';
import MerchantProductCatalog from './MerchantProductCatalog';
import MerchantInvoicingPanel from './MerchantInvoicingPanel';
import MerchantReportPanel from './MerchantReportPanel';

/**
 * The shop, in four parts.
 *
 * A warung owner wants the till and nothing else. A studio wants the
 * invoice and the terms. A company that sells across borders wants the
 * currency and the rule of another country.
 *
 * So the tabs are drawn from what the shop says it is. The server
 * holds that answer and the rules that follow from it, and the browser
 * is told; it does not keep a copy of the rules, because a copy
 * drifts.
 */

const TAB_KEYS = ['catalog', 'pos', 'invoicing', 'report'];

const MerchantTabs = ({ merchant, onSold }) => {
  const { t, language } = useTranslation();
  const K = batch12[language]?.merchant || batch12.id.merchant;

  const [tab, setTab] = useState('pos');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!merchant?.id) return;
    setLoading(true);
    try {
      const data = await merchantApi.getBusinessProfile(merchant.id);
      setProfile(data);
    } catch (err) {
      console.error('Failed to load the business profile:', err);
    } finally {
      setLoading(false);
    }
  }, [merchant?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const capabilities = profile?.capabilities || {};
  const fields = capabilities.fields || {};

  /**
   * Which tabs this shop has.
   *
   * A warung has no journal and no invoice tab, because there is
   * nothing in them for it. The tab is not merely hidden; it does not
   * exist for this shop.
   */
  const visibleTabs = TAB_KEYS.filter((key) => {
    if (key === 'catalog' || key === 'pos') return true;
    if (key === 'invoicing') {
      return (
        fields.tax_settings?.shown ||
        fields.payment_terms?.shown ||
        fields.multi_currency?.shown
      );
    }
    return fields.journal?.shown;
  });

  useEffect(() => {
    // If the shop changes into a mode without the tab that is open,
    // the page must not sit on a tab that is no longer there.
    if (visibleTabs.length && !visibleTabs.includes(tab)) {
      setTab('pos');
    }
  }, [visibleTabs.join(','), tab]);

  const changeProfile = async (next) => {
    if (!merchant?.id || next === capabilities.profile) return;
    setSaving(true);
    try {
      await merchantApi.updateMerchant(merchant.id, {
        business_profile: next,
      });
      await loadProfile();
      toast.success(K.profile.changing);
    } catch (err) {
      console.error('Failed to change the business mode:', err);
      toast.error(K.profile.change_failed);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (settings) => {
    if (!merchant?.id) return;
    setSaving(true);
    try {
      await merchantApi.updateBusinessProfile(merchant.id, settings);
      toast.success(K.settings.saved);
      await loadProfile();
    } catch (err) {
      console.error('Failed to save the settings:', err);
      toast.error(K.settings.save_failed);
    } finally {
      setSaving(false);
    }
  };

  if (!merchant) return null;

  const tabIcons = {
    catalog: Package,
    pos: Banknote,
    invoicing: Receipt,
    report: BookOpen,
  };

  const MODES = [
    { key: 'UMKM', label: K.profile.umkm, description: K.profile.umkm_desc },
    { key: 'B2B', label: K.profile.b2b, description: K.profile.b2b_desc },
    {
      key: 'CROSS_BORDER',
      label: K.profile.cross_border,
      description: K.profile.cross_border_desc,
    },
  ];
  const currentMode = MODES.find((m) => m.key === capabilities.profile) || MODES[0];

  return (
    <div className="space-y-4">
      {/* Which kind of shop this is, and the reason for it. */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Settings2 size={16} />
              {K.profile.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {K.profile.hint}
            </p>
          </div>
          <div className="min-w-[16rem]">
            <label
              htmlFor="business-profile"
              className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
            >
              {K.profile.label}
            </label>
            <select
              id="business-profile"
              value={capabilities.profile || 'UMKM'}
              onChange={(e) => changeProfile(e.target.value)}
              disabled={saving || loading}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 disabled:opacity-60"
            >
              {MODES.map((mode) => (
                <option key={mode.key} value={mode.key}>
                  {mode.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {currentMode.description}
            </p>
          </div>
        </div>
      </div>

      {/* The tabs this shop has. */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {visibleTabs.map((key) => {
          const Icon = tabIcons[key];
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-medium'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={16} />
              {K.tab[key]}
            </button>
          );
        })}
      </div>

      {tab === 'catalog' && (
        <MerchantProductCatalog merchant={merchant} />
      )}

      {tab === 'pos' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <MerchantTill merchant={merchant} onSold={onSold} profile={profile} />
        </div>
      )}

      {tab === 'invoicing' && (
        <MerchantInvoicingPanel
          merchant={merchant}
          profile={profile}
          onSaved={saveSettings}
          saving={saving}
        />
      )}

      {tab === 'report' && (
        <MerchantReportPanel merchant={merchant} profile={profile} />
      )}
    </div>
  );
};

export default MerchantTabs;
