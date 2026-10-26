// Format utilities with i18n support.
//
// The money formatting is handled by utils/currency.js, which holds the
// display currency and the live rates. The language only decides the
// way dates and numbers are read and written.

import {
  currencyStore,
  CURRENCIES,
  currencyConfig,
  formatCurrency as convertCurrency,
  formatNative as convertNative,
  formatNumber as convertNumber,
} from './currency';

// Get current language from localStorage or default
const getCurrentLanguage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('language') || 'id';
  }
  return 'id';
};

// The currency the app is showing money in.
//
// It is a choice of its own. The language does not change it, and
// changing it does not change the language.
const getCurrency = () => currencyStore.currency;

// The way a currency is written: its symbol, how many decimals it has,
// and how the digits are grouped.
const getCurrencyConfig = (currency = null) => currencyConfig(currency || getCurrency());

// Show an amount in the display currency.
//
// The second argument is the currency the amount is already in. When it
// is left out the amount is read in rupiah.
export const formatCurrency = (amount, currency = null) =>
  convertCurrency(amount, currency || 'IDR');

// Show an amount in the currency it is already in, with no conversion.
export const formatNative = (amount, currency = null) =>
  convertNative(amount, currency || 'IDR');

// Format a number the way the display currency is written.
export const formatNumber = (num) => convertNumber(num);

// Format percentage
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return '0%';
  const formatted = formatNumber(parseFloat(value).toFixed(decimals));
  return `${formatted}%`;
};

// Format date with language
export const formatDate = (dateString, format = 'short', language = null) => {
  if (!dateString) return '-';
  
  const lang = language || getCurrentLanguage();
  const date = new Date(dateString);
  
  const localeMap = {
    id: 'id-ID',
    en: 'en-US',
    ja: 'ja-JP',
  };
  
  const locale = localeMap[lang] || 'id-ID';
  
  const optionsMap = {
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    month: { month: 'long', year: 'numeric' },
    input: { day: '2-digit', month: '2-digit', year: 'numeric' },
  };
  
  return new Intl.DateTimeFormat(locale, optionsMap[format] || optionsMap.short).format(date);
};

// Format relative date
export const formatRelativeDate = (dateString, language = null) => {
  if (!dateString) return '-';
  
  const lang = language || getCurrentLanguage();
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  const translations = {
    id: { today: 'Hari ini', yesterday: 'Kemarin', days: 'hari lalu', weeks: 'minggu lalu', months: 'bulan lalu', years: 'tahun lalu' },
    en: { today: 'Today', yesterday: 'Yesterday', days: 'days ago', weeks: 'weeks ago', months: 'months ago', years: 'years ago' },
    ja: { today: '今日', yesterday: '昨日', days: '日前', weeks: '週間前', months: 'ヶ月前', years: '年前' },
  };
  
  const t = translations[lang] || translations.en;
  
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.yesterday;
  if (diffDays < 7) return `${diffDays} ${t.days}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t.weeks}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${t.months}`;
  return `${Math.floor(diffDays / 365)} ${t.years}`;
};

// Get class based on value type
export const getValueClass = (value) => {
  if (value > 0) return 'text-success-600 dark:text-success-400';
  if (value < 0) return 'text-danger-600 dark:text-danger-400';
  return 'text-gray-600 dark:text-gray-400';
};

// Truncate text
export const truncate = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// Get days remaining
export const getDaysRemaining = (targetDate) => {
  if (!targetDate) return 0;
  const target = new Date(targetDate);
  const now = new Date();
  const diffTime = target - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Get month range
export const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

// Get date range for last N days
export const getLastNDaysRange = (days = 30) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

// Parse localized number input
export const parseLocalizedNumber = (value, language = null) => {
  if (!value) return 0;

  // The reader types the number the way their language writes it. The
  // language decides how the separators are read, not the currency.
  const lang = language || getCurrentLanguage();
  const usesDotAsGroup = lang === 'id';

  let cleaned = value.toString().replace(/[^\d.,-]/g, '');

  if (usesDotAsGroup) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '').replace(/\.(?=\d{3}\b)/g, '');
    cleaned = cleaned.replace(',', '.');
  }

  return parseFloat(cleaned) || 0;
};
