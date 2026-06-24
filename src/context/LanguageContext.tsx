"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import fr from '@/dictionaries/fr';
import en from '@/dictionaries/en';

type Language = 'fr' | 'en';

type Dictionary = typeof fr;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries = {
  fr,
  en,
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('fr');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem('profoot_lang') as Language;
    if (savedLang === 'fr' || savedLang === 'en') {
      setLangState(savedLang);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('profoot_lang', newLang);
  };

  const t = (path: string): string => {
    const keys = path.split('.');
    let current: any = dictionaries[lang];
    
    for (const key of keys) {
      if (current === undefined || current === null) {
        return path; // Fallback to path if not found
      }
      current = current[key];
    }
    
    if (typeof current === 'string') {
      return current;
    }
    
    return path; // Fallback
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
