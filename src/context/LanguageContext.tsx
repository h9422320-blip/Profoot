"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import fr from "@/dictionaries/fr";
import en from "@/dictionaries/en";

type Language = "fr" | "en";
type Dictionary = typeof fr;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (keyPath: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries: Record<Language, Dictionary> = {
  fr,
  en,
};

/**
 * ── L'ANGLAIS ATTEND SA TRADUCTION ────────────────────────────────────────
 *
 * Le dictionnaire anglais existe et compte 62 clés. L'application, elle,
 * compte 105 écrans : trois fichiers seulement passent par `t()`. Basculer en
 * anglais ne traduit donc quasiment rien — on obtient une interface française
 * avec une poignée de mots anglais. C'est pire que du français assumé.
 *
 * Aucun sélecteur n'expose ce basculement : `setLang` n'est appelé nulle part.
 * Le seul chemin restant est une valeur « en » écrite dans le navigateur par
 * une version antérieure, qui y survivrait indéfiniment.
 *
 * On ferme donc ce chemin — sans rien supprimer. Le contexte, les deux
 * dictionnaires et `setLang` restent en place et fonctionnels : le jour où la
 * traduction est faite, il suffit de repasser cette constante à `true`.
 */
const ANGLAIS_PRET = false;

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("profoot_lang") as Language | null;
    if (savedLang === "fr" || (savedLang === "en" && ANGLAIS_PRET)) {
      setLangState(savedLang);
    }
    setMounted(true);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("profoot_lang", newLang);
  };

  const t = (keyPath: string): string => {
    const keys = keyPath.split(".");
    let current: any = dictionaries[lang];
    for (const key of keys) {
      if (current[key] === undefined) {
        console.warn(`Translation key not found: ${keyPath}`);
        return keyPath;
      }
      current = current[key];
    }
    return current as string;
  };

  // En SSR, on rend avec le thème par défaut pour éviter l'erreur "must be used within Provider"
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
