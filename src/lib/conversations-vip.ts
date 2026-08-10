/**
 * Conversations de l'Agent VIP : enregistrement et contrôle qualité.
 *
 * Aucune notation n'est confiée à une intelligence artificielle. Tout ce qui
 * est mesuré ici est constaté : le nombre de recherches réellement lancées, les
 * outils appelés, la durée, le coût — et le respect des règles de rédaction
 * qu'on a fixées à l'agent, vérifiable par simple lecture du texte.
 *
 * Ce que ce module ne prétend PAS mesurer : la véracité d'une affirmation. La
 * vérifier demanderait de refaire l'enquête, donc un jugement extérieur et un
 * coût. Ce qui est vérifiable gratuitement, en revanche, c'est si l'agent a
 * cherché avant de parler — et une réponse sans aucune recherche est le vrai
 * signal d'alerte.
 */

import { createAdminClient } from './supabase-admin';

export interface EchangeVip {
  id: string;
  user_id: string | null;
  question: string;
  reponse: string;
  recherches_web: number;
  outils_appeles: string[] | null;
  modele: string | null;
  duree_ms: number | null;
  jetons_entrants: number | null;
  jetons_sortants: number | null;
  jetons_cache: number | null;
  motif_arret: string | null;
  created_at: string;
}

/** Manquement à une règle de rédaction, détecté par lecture du texte. */
export interface Manquement {
  cle: string;
  libelle: string;
  explication: string;
}

export interface EchangeEvalue extends EchangeVip {
  email: string | null;
  /** Coût de l'échange en francs CFA, calculé sur les jetons consommés. */
  coutXof: number;
  manquements: Manquement[];
  /** Part des règles respectées, de 0 à 100. */
  conformite: number;
}

// Tarifs Sonnet 5 en dollars par million de jetons, et conversion en FCFA.
const PRIX_ENTREE = 2;
const PRIX_SORTIE = 10;
const USD_VERS_XOF = 600;

/**
 * Règles de rédaction imposées à l'agent, et façon de vérifier qu'il les tient.
 *
 * Elles reprennent une à une les consignes de son prompt. Une règle qu'on donne
 * sans jamais vérifier qu'elle est suivie est une règle qu'on espère, pas une
 * règle qu'on applique.
 */
const REGLES: {
  cle: string;
  libelle: string;
  explication: string;
  enfreinte: (e: EchangeVip) => boolean;
}[] = [
  {
    cle: 'recherche',
    libelle: 'A cherché avant de répondre',
    explication:
      "Aucune recherche web n'a été lancée : la réponse vient de la mémoire du modèle, qui a des mois de retard.",
    enfreinte: (e) => e.recherches_web === 0,
  },
  {
    cle: 'sources',
    libelle: 'Ne cite pas ses sources',
    explication:
      "Un nom de journal ou une tournure « selon… » apparaît. L'abonné doit lire ce qui se passe, pas d'où ça vient.",
    enfreinte: (e) =>
      /\b(selon|d'après)\s+[A-ZÉÀ]|Marca|Mundo Deportivo|L'Équipe|The Athletic|The Guardian|Sky Sports|Fabrizio Romano|\bCOPE\b|Relevo|AS\.com/i.test(
        e.reponse
      ),
  },
  {
    cle: 'tuyauterie',
    libelle: 'Ne parle pas de ses outils',
    explication:
      "La réponse mentionne une base de données ou un outil interne. L'abonné n'a pas à connaître la plomberie.",
    enfreinte: (e) => /API[- ]?Football|base de données|mes outils|les données officielles/i.test(e.reponse),
  },
  {
    cle: 'emojis',
    libelle: 'Pas d’emoji',
    explication: "Des emojis sont présents : c'est l'un des tics qui font dire « c'est une machine ».",
    enfreinte: (e) => (e.reponse.match(/\p{Extended_Pictographic}/gu) ?? []).length > 0,
  },
  {
    cle: 'titres',
    libelle: 'Pas de titre de section',
    explication: "La réponse est découpée en sections : elle ressemble à une fiche, pas à quelqu'un qui écrit.",
    enfreinte: (e) => (e.reponse.match(/^#{1,4}\s/gm) ?? []).length > 0,
  },
  {
    cle: 'puces',
    libelle: 'Pas de liste à puces pour raisonner',
    explication: "Le raisonnement est débité en puces au lieu d'être écrit en phrases.",
    enfreinte: (e) => (e.reponse.match(/^\s*[-*•]\s/gm) ?? []).length >= 4,
  },
  {
    cle: 'aide_finale',
    libelle: 'Ne termine pas par une offre d’aide',
    explication:
      "La réponse se clôt par « si tu veux, je peux… ». Un humain termine quand il a fini de parler.",
    enfreinte: (e) =>
      /(si tu veux[^.]*je peux|n'hésite pas|dis-moi si tu veux|je peux (creuser|détailler|approfondir))/i.test(
        e.reponse.slice(-320)
      ),
  },
  {
    cle: 'complete',
    libelle: 'Réponse complète',
    explication: "La réponse a été coupée avant la fin, faute de place ou de temps.",
    enfreinte: (e) => e.motif_arret === 'max_tokens',
  },
];

/** Enregistre un échange. Ne doit jamais empêcher la réponse de partir. */
export async function enregistrerEchange(donnees: {
  userId: string | null;
  question: string;
  reponse: string;
  recherchesWeb: number;
  outilsAppeles: string[];
  modele: string;
  dureeMs: number;
  jetonsEntrants: number;
  jetonsSortants: number;
  jetonsCache: number;
  motifArret: string | null;
}): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from('vip_conversations').insert({
      user_id: donnees.userId,
      question: donnees.question.slice(0, 4000),
      reponse: donnees.reponse.slice(0, 20000),
      recherches_web: donnees.recherchesWeb,
      outils_appeles: donnees.outilsAppeles,
      modele: donnees.modele,
      duree_ms: donnees.dureeMs,
      jetons_entrants: donnees.jetonsEntrants,
      jetons_sortants: donnees.jetonsSortants,
      jetons_cache: donnees.jetonsCache,
      motif_arret: donnees.motifArret,
    });
    if (error) console.warn('[AGENT VIP] Échange non enregistré :', error.message);
  } catch (erreur: any) {
    // Un échec d'enregistrement ne doit jamais priver l'abonné de sa réponse.
    console.warn('[AGENT VIP] Enregistrement impossible :', erreur?.message);
  }
}

function evaluer(e: EchangeVip, email: string | null): EchangeEvalue {
  const manquements = REGLES.filter((r) => r.enfreinte(e)).map(({ cle, libelle, explication }) => ({
    cle,
    libelle,
    explication,
  }));

  const coutUsd =
    ((e.jetons_entrants ?? 0) * PRIX_ENTREE + (e.jetons_sortants ?? 0) * PRIX_SORTIE) / 1_000_000;

  return {
    ...e,
    email,
    coutXof: Math.round(coutUsd * USD_VERS_XOF * 100) / 100,
    manquements,
    conformite: Math.round(((REGLES.length - manquements.length) / REGLES.length) * 100),
  };
}

export interface BilanAgentVip {
  total: number;
  /** Échanges sur les sept derniers jours. */
  recents: number;
  sansRecherche: number;
  rechercheMoyenne: number;
  dureeMoyenneMs: number;
  conformiteMoyenne: number | null;
  coutTotalXof: number;
  coutMoyenXof: number;
  /** Manquements les plus fréquents, du plus courant au plus rare. */
  manquementsFrequents: { libelle: string; nombre: number; part: number; explication: string }[];
  outilsFrequents: { nom: string; nombre: number }[];
  echanges: EchangeEvalue[];
}

/** Bilan complet, lu et calculé sans aucun appel extérieur. */
export async function getBilanAgentVip(limite = 200): Promise<BilanAgentVip> {
  const sb = createAdminClient();

  const vide: BilanAgentVip = {
    total: 0, recents: 0, sansRecherche: 0, rechercheMoyenne: 0, dureeMoyenneMs: 0,
    conformiteMoyenne: null, coutTotalXof: 0, coutMoyenXof: 0,
    manquementsFrequents: [], outilsFrequents: [], echanges: [],
  };

  const { data, error } = await sb
    .from('vip_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.warn('[AGENT VIP] Bilan indisponible :', error.message);
    return vide;
  }
  const lignes = (data ?? []) as EchangeVip[];
  if (!lignes.length) return vide;

  // Les adresses vivent dans l'authentification, pas dans cette table.
  const emails = new Map<string, string>();
  try {
    const { data: comptes } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of comptes?.users ?? []) if (u.email) emails.set(u.id, u.email);
  } catch {
    // Sans les adresses, le bilan reste exploitable.
  }

  const echanges = lignes.map((e) => evaluer(e, e.user_id ? emails.get(e.user_id) ?? null : null));

  const septJours = Date.now() - 7 * 24 * 3600 * 1000;
  const somme = (f: (e: EchangeEvalue) => number) => echanges.reduce((t, e) => t + f(e), 0);

  const compteManquements = new Map<string, { libelle: string; explication: string; nombre: number }>();
  for (const e of echanges) {
    for (const m of e.manquements) {
      const c = compteManquements.get(m.cle) ?? { libelle: m.libelle, explication: m.explication, nombre: 0 };
      c.nombre++;
      compteManquements.set(m.cle, c);
    }
  }

  const compteOutils = new Map<string, number>();
  for (const e of echanges) {
    for (const o of e.outils_appeles ?? []) compteOutils.set(o, (compteOutils.get(o) ?? 0) + 1);
  }

  const coutTotal = somme((e) => e.coutXof);

  return {
    total: echanges.length,
    recents: echanges.filter((e) => new Date(e.created_at).getTime() >= septJours).length,
    sansRecherche: echanges.filter((e) => e.recherches_web === 0).length,
    rechercheMoyenne: Math.round((somme((e) => e.recherches_web) / echanges.length) * 10) / 10,
    dureeMoyenneMs: Math.round(somme((e) => e.duree_ms ?? 0) / echanges.length),
    conformiteMoyenne: Math.round(somme((e) => e.conformite) / echanges.length),
    coutTotalXof: Math.round(coutTotal * 100) / 100,
    coutMoyenXof: Math.round((coutTotal / echanges.length) * 100) / 100,
    manquementsFrequents: [...compteManquements.values()]
      .map((m) => ({ ...m, part: Math.round((m.nombre / echanges.length) * 1000) / 10 }))
      .sort((a, b) => b.nombre - a.nombre),
    outilsFrequents: [...compteOutils.entries()]
      .map(([nom, nombre]) => ({ nom, nombre }))
      .sort((a, b) => b.nombre - a.nombre),
    echanges,
  };
}
