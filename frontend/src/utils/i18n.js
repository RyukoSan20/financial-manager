// Internationalization utilities for FinManager

// Currency configurations per locale
export const CURRENCY_CONFIG = {
  id: {
    currency: 'IDR',
    locale: 'id-ID',
    symbol: 'Rp',
    decimals: 0,
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  en: {
    currency: 'USD',
    locale: 'en-US',
    symbol: '$',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  ja: {
    currency: 'JPY',
    locale: 'ja-JP',
    symbol: '¥',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
};

// Default language
export const DEFAULT_LANGUAGE = 'id';

// Get language from localStorage or default
export const getCurrentLanguage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('language') || DEFAULT_LANGUAGE;
  }
  return DEFAULT_LANGUAGE;
};

// Format number with locale-specific separators
export const formatNumber = (value, language = DEFAULT_LANGUAGE) => {
  const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
  const num = parseFloat(value) || 0;
  
  const parts = num.toFixed(config.decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
  
  return config.decimals > 0 
    ? parts.join(config.decimalSeparator)
    : parts[0];
};

// Format currency with symbol
export const formatCurrency = (amount, language = DEFAULT_LANGUAGE, showSymbol = true) => {
  const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
  const formatted = formatNumber(amount, language);
  
  return showSymbol 
    ? `${config.symbol} ${formatted}`
    : formatted;
};

// Parse localized number string to float
export const parseLocalizedNumber = (value, language = DEFAULT_LANGUAGE) => {
  const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
  if (!value) return 0;
  
  // Remove currency symbol and whitespace
  let cleaned = value.replace(/[^\d.,\-]/g, '');
  
  // Normalize separators based on locale
  if (config.thousandsSeparator === '.') {
    // Indonesian format: 1.000.000,50 -> 1000000.50
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // English format: 1,000,000.50 -> 1000000.50
    cleaned = cleaned.replace(/,/g, '');
  }
  
  return parseFloat(cleaned) || 0;
};

// Format date with locale
export const formatDate = (date, language = DEFAULT_LANGUAGE, options = {}) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  
  const localeMap = {
    id: 'id-ID',
    en: 'en-US',
    ja: 'ja-JP',
  };
  
  const locale = localeMap[language] || 'id-ID';
  
  const defaultOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  
  return dateObj.toLocaleDateString(locale, { ...defaultOptions, ...options });
};

// Format percentage
export const formatPercentage = (value, language = DEFAULT_LANGUAGE) => {
  const num = parseFloat(value) || 0;
  return `${formatNumber(num, language)}%`;
};

// Get currency symbol
export const getCurrencySymbol = (language = DEFAULT_LANGUAGE) => {
  const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
  return config.symbol;
};

// Get currency code
export const getCurrencyCode = (language = DEFAULT_LANGUAGE) => {
  const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
  return config.currency;
};

// Available languages
export const LANGUAGES = [
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', currency: 'IDR' },
  { code: 'en', name: 'English', flag: '🇺🇸', currency: 'USD' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', currency: 'JPY' },
];
