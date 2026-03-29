import React, { createContext, useContext, useMemo } from 'react';
import { en, ha, TranslationKeys } from './translations';
import { useSettingsStore } from '../store';

type Language = 'en' | 'ha';

interface I18nContextType {
  t: TranslationKeys;
  language: Language;
  isHausa: boolean;
  isEnglish: boolean;
}

const translations: Record<Language, TranslationKeys> = {
  en,
  ha,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const language = useSettingsStore((state) => state.language) as Language;

  const value = useMemo(() => ({
    t: translations[language] || translations.en,
    language,
    isHausa: language === 'ha',
    isEnglish: language === 'en',
  }), [language]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    // Return default English if not in provider
    return {
      t: translations.en,
      language: 'en' as Language,
      isHausa: false,
      isEnglish: true,
    };
  }
  return context;
};

// Helper to get nested translation values
export const getTranslation = (translations: TranslationKeys, path: string): string => {
  const keys = path.split('.');
  let result: any = translations;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path; // Return the path if translation not found
    }
  }
  
  return typeof result === 'string' ? result : path;
};
