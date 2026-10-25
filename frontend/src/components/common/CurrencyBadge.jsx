import { useTranslation } from '../../i18n';
import { useCurrency, CURRENCIES } from '../../utils/currency';
import { RefreshCw } from 'lucide-react';

/**
 * A small sign of which currency the app is showing, and how fresh the
 * rates behind it are.
 *
 * The reader needs to know this, because the number on the screen has
 * been converted. Without it, a rupiah balance shown as dollars looks
 * like a mistake.
 */
export const CurrencyBadge = ({ className = '' }) => {
  const { t } = useTranslation();
  const { currency, ratesAsOf, loading, error, refreshRates } = useCurrency();

  const config = CURRENCIES[currency] || CURRENCIES.IDR;

  const state = loading
    ? t('currency.rates_loading')
    : error
      ? t('currency.rates_error')
      : ratesAsOf
        ? `${t('currency.rates_updated')} ${new Date(ratesAsOf).toLocaleDateString()}`
        : t('currency.rates_loading');

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 ${className}`}
      title={state}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {config.symbol}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{currency}</span>
      <button
        type="button"
        onClick={refreshRates}
        className="ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label={t('currency.refresh_rates')}
        title={t('currency.refresh_rates')}
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default CurrencyBadge;
