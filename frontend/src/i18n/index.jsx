import { createContext, useContext, useState, useEffect } from 'react';
import id from './id';
import en from './en';
import ja from './ja';

const translations = { id, en, ja };

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
  
  const t = (key, fallback = '') => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return fallback || key;
      }
    }
    
    return value || fallback || key;
  };
  
  return (
    <I18nContext.Provider value={{ language, changeLanguage, t, languages: Object.keys(translations) }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

// Hook for component-level translation
export const useTranslation = () => {
  const { t, language, changeLanguage, languages } = useI18n();
  return { t, language, changeLanguage, languages };
};

export default I18nContext;
