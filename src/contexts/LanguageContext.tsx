"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { dict as frDict } from "../dictionaries/fr";
import { dict as enDict } from "../dictionaries/en";
import type { Dictionary } from "../dictionaries/types";

type Language = "fr" | "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
}

const dictionaries: Record<Language, Dictionary> = {
  fr: frDict,
  en: enDict,
};

const STORAGE_KEY = "profoot_language";

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

function getInitialLanguage(): Language {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") {
      return stored;
    }
  }
  return "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  // Sync localStorage on mount (handles SSR hydration)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") {
      setLanguageState(stored);
    } else {
      localStorage.setItem(STORAGE_KEY, language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = dictionaries[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
