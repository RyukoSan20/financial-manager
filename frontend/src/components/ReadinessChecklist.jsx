import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { api } from '../services/api';
import {
  User as UserIcon, Wallet, Receipt, Target, Flag,
  Coins, Bell, Check, ChevronRight,
} from 'lucide-react';

const ICONS = {
  user: UserIcon,
  wallet: Wallet,
  receipt: Receipt,
  target: Target,
  flag: Flag,
  coins: Coins,
  bell: Bell,
};

/**
 * The setup checklist.
 *
 * Shown on the dashboard and in settings. It says what is already set
 * up and what to do next, with a button that goes straight there.
 * The bar fills as the reader finishes, so the progress is visible
 * without reading the list.
 */
export default function ReadinessChecklist({ onDismiss }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/settings/readiness')
      // api.request returns the parsed body directly, not wrapped in
      // a "data" field.
      .then((res) => { if (alive) setReport(res); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  if (error) return null;
  if (!report) return null;

  // Nothing to do: either everything is set up, or the reader has
  // dismissed it. Either way, do not take the space.
  if (report.done_count === 0 && !report.total_count) return null;
  if (report.done_count === report.total_count) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
              {t('readiness.all_done_title')}
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
              {t('readiness.all_done_desc')}
            </p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
            >
              {t('readiness.done')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const pct = report.total_count
    ? Math.round((report.done_count / report.total_count) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('readiness.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('readiness.subtitle')}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          >
            {t('readiness.done')}
          </button>
        )}
      </div>

      {/* The progress bar. The number is the point: it is what tells
          the reader how far along they are at a glance. */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
          {report.done_count}/{report.total_count}
        </span>
      </div>

      <ul className="space-y-1.5">
        {report.items.map((item) => {
          const Icon = ICONS[item.icon] || Target;
          const isNext = item.key === report.next_key;
          return (
            <li key={item.key}>
              <button
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${
                  item.done
                    ? 'bg-gray-50 dark:bg-gray-800/50 opacity-70'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    item.done
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                      : isNext
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {item.done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {t(item.title_key)}
                    {isNext && !item.done && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        {t('readiness.next')}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                    {t(item.description_key)}
                  </span>
                </span>
                {!item.done && (
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
