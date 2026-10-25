import { createContext, useContext, useState, useEffect } from 'react';
import id from './id';
import en from './en';
import ja from './ja';
import {
  currencyStore,
  currencyConfig,
  formatCurrency as formatMoney,
  formatNumber as formatPlainNumber,
} from '../utils/currency';

const translations = { id, en, ja };

/**
 * How each language writes a number and a date.
 *
 * This is about the language, not about the money. The currency the
 * app shows is a separate choice and lives in utils/currency.js.
 */
export const LOCALE_CONFIG = {
  id: {
    locale: 'id-ID',
    thousandsSeparator: '.',
    decimalSeparator: ',',
  },
  en: {
    locale: 'en-US',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  ja: {
    locale: 'ja-JP',
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
};

/**
 * Kept for backwards compatibility.
 *
 * The currency here is the currency of the app's own money, which is
 * rupiah. It is not the display currency, and it does not change with
 * the language. Use utils/currency.js for the display currency.
 */
export const CURRENCY_CONFIG = {
  id: { currency: 'IDR', locale: 'id-ID', symbol: 'Rp', decimals: 0, thousandsSeparator: '.', decimalSeparator: ',' },
  en: { currency: 'IDR', locale: 'en-US', symbol: 'Rp', decimals: 0, thousandsSeparator: '.', decimalSeparator: ',' },
  ja: { currency: 'IDR', locale: 'ja-JP', symbol: 'Rp', decimals: 0, thousandsSeparator: '.', decimalSeparator: ',' },
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
  const t = (key, fallback = '', values = null) => {
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

    // The holes in a word are filled in with the values that came
    // with the key, so a sentence can be written in one language and
    // still carry a number that changes.
    const fill = (text) => {
      if (!values || typeof values !== 'object') return text;
      return String(text).replace(/\{(\w+)\}/g, (match, name) => {
        const value = values[name];
        if (value === undefined || value === null) return match;
        return typeof value === 'number' ? String(Math.round(value * 100) / 100) : String(value);
      });
    };

    const found = lookup(translations[language]);
    if (found) return fill(found);

    const english = lookup(translations.en);
    if (english) return fill(english);

    if (fallback) return fill(fallback);

    // A key with no translation anywhere is a bug, but showing
    // "nav.map" on the screen is worse than showing the last part
    // of the key, which at least reads as a word. The audit script
    // reports the missing key either way.
    const leaf = keys[keys.length - 1];
    return leaf
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, c => c.toUpperCase());
  };
  
  // Format money. The amount is converted into the currency the
  // reader picked, using the live rates.
  const formatCurrency = (amount, from = 'IDR', showSymbol = true) =>
    formatMoney(amount, from, { showSymbol });

  // Format a plain number.
  const formatNumber = (num) => formatPlainNumber(num);

  // The currency the app is showing money in.
  const getCurrencyConfig = () => currencyConfig(currencyStore.currency);

  // The currency the reader picked, and the way to change it.
  const displayCurrency = currencyStore.currency;
  const setDisplayCurrency = (code) => currencyStore.setCurrency(code);
  
  return (
    <I18nContext.Provider value={{ 
      language, 
      changeLanguage, 
      t, 
      languages: Object.keys(translations),
      formatCurrency,
      formatNumber,
      getCurrencyConfig,
      displayCurrency,
      setDisplayCurrency,
      currencyConfig: CURRENCY_CONFIG,
      localeConfig: LOCALE_CONFIG,
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
