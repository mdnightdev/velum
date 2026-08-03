import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, LanguageOption, translations } from './translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  supportedLanguages: SUPPORTED_LANGUAGES
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('velum_language') as SupportedLanguage;
      if (saved && translations[saved]) {
        return saved;
      }
      // Check browser language
      const browserLang = navigator.language?.slice(0, 2) as SupportedLanguage;
      if (browserLang && translations[browserLang]) {
        return browserLang;
      }
    }
    return 'en';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    if (translations[lang]) {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem('velum_language', lang);
      }
    }
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] || translations['en'];
    return langDict[key] || translations['en'][key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
