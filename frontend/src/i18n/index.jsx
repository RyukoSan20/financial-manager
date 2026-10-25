import { createContext, useContext, useState, useEffect } from 'react';
import id from './id';
import en from './en';
import ja from './ja';

const translations = { id, en, ja };

// Currency configurations per language
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

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState('id'); // Default Indonesian
  
  // Load saved language preference
  useEffect(() => {
    const saved = localStorage.getItem('language');
    if (saved && translations[saved]) {
      setLanguage(saved);
    }
  }, []);
  
  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('language', lang);
    }
  };
  
  /**
   * Look up a translation.
   *
   * When the key is not there in the language that is picked, the
   * English one is tried, because a missing translation is a gap in
   * the file rather than a reason to show the person a key like
   * "nav.map" on the screen. The key itself is only ever shown when
   * there is no English text either, because then there is nothing
   * better to say and the key at least says what was looked for.
   */
  const t = (key, fallback = '') => {
    // A key can be missing when it is built at run time, for example
    // when a list of options is read from a configuration. Returning
    // the fallback keeps the page on screen; throwing would leave a
    // blank page behind.
    if (typeof key !== 'string' || !key) return fallback || '';
    const keys = key.split('.');

    const lookup = (table) => {
      let value = table;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return undefined;
        }
      }
      return typeof value === 'string' ? value : undefined;
    };

    const found = lookup(translations[language]);
    if (found) return found;

    const english = lookup(translations.en);
    if (english) return english;

    if (fallback) return fallback;

    // A key with no translation anywhere is a bug, but showing
    // "nav.map" on the screen is worse than showing the last part
    // of the key, which at least reads as a word. The audit script
    // reports the missing key either way.
    const leaf = keys[keys.length - 1];
    return leaf
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, c => c.toUpperCase());
  };
  
  // Format currency based on language
  const formatCurrency = (amount, showSymbol = true) => {
    if (amount === null || amount === undefined) return '-';
    
    const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    const parts = num.toFixed(config.decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
    const formatted = parts.join(config.decimalSeparator);
    
    return showSymbol ? `${config.symbol} ${formatted}` : formatted;
  };
  
  // Format number
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    
    const config = CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
    const parts = num.toFixed(config.decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
    
    return parts.join(config.decimalSeparator);
  };
  
  // Get currency config
  const getCurrencyConfig = () => {
    return CURRENCY_CONFIG[language] || CURRENCY_CONFIG.id;
  };
  
  return (
    <I18nContext.Provider value={{ 
      language, 
      changeLanguage, 
      t, 
      languages: Object.keys(translations),
      formatCurrency,
      formatNumber,
      getCurrencyConfig,
      currencyConfig: CURRENCY_CONFIG,
    }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// Hook for component-level translation
export const useTranslation = () => {
  const context = useI18n();
  return context;
};

export default I18nContext;
