/**
 * Partenaires influenceurs : contrats, dépenses et retombées.
 *
 * L'accès VIP d'un partenaire reste ouvert par la liste d'adresses du module
 * d'abonnement — une panne de base ne doit jamais lui retirer son accès. Ce
 * module porte l'autre moitié : qui est la personne, ce qui a été convenu,
 * combien elle a coûté, ce qu'elle a rapporté.
 */

import { createAdminClient } from './supabase-admin';
import { niveauOffert } from './subscription';

export interface Partenaire {
  id: string;
  email: string;
  name: string;
  handle: string | null;
  platform: string | null;
  country: string | null;
  audience: string | null;
  amount: number;
  currency: string;
  paid: boolean;
  paid_at: string | null;
  terms: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface ReleveePartenaire {
  id: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  views: number;
  posts: number;
  signups: number;
  notes: string | null;
}

/** Ce que l'administration affiche pour chaque partenaire. */
export interface PartenaireEnrichi extends Partenaire {
  /** Niveau d'accès réellement ouvert par le code, ou null si aucun. */
  accesOuvert: 'VIP' | 'PRO' | null;
  /** Le partenaire a-t-il créé son compte sur l'application ? */
  inscrit: boolean;
  inscritLe: string | null;
  derniereConnexion: string | null;
  /** Cumul des vues relevées, toutes semaines confondues. */
  vuesCumulees: number;
  publications: number;
  /** Ce que ses vues valent au tarif convenu, en dollars. */
  duPourVuesUsd: number;
  releves: ReleveePartenaire[];
}

/**
 * Tarif convenu avec les influenceurs : 1 dollar pour mille vues.
 *
 * Identique pour tous les partenaires. Ce n'est donc pas une valeur calculée à
 * partir de ce qui a été versé, mais le prix du contrat : ce que rapportent
 * mille vues à celui qui les apporte.
 */
export const TAUX_POUR_MILLE_USD = 1;

/**
 * Taux de conversion vers le franc CFA.
 *
 * L'euro est arrimé au franc CFA à une parité fixe et officielle. Le dollar
 * flotte : sa valeur est une approximation, affichée comme telle partout où
 * elle sert. Ces taux ne servent qu'à rapprocher dépenses et recettes ; les
 * montants des contrats restent toujours présentés dans leur devise d'origine.
 */
export const TAUX_XOF: Record<string, number> = {
  XOF: 1,
  EUR: 655.957, // parité fixe
  USD: 600, // approximation
};

export function versXof(montant: number, devise: string): number {
  return Number(montant ?? 0) * (TAUX_XOF[devise] ?? 0);
}

/** Devises affichées telles qu'elles ont été versées, sans conversion. */
export function montantPartenaire(montant: number, devise: string): string {
  const symbole: Record<string, string> = { EUR: '€', USD: '$', XOF: 'FCFA' };
  const valeur = Number(montant ?? 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(Number(montant)) ? 0 : 2,
  });
  return `${valeur} ${symbole[devise] ?? devise}`;
}

/** Ce que les vues relevées valent au tarif convenu, en dollars. */
export function montantDuPourVues(vues: number): number {
  return (Number(vues ?? 0) / 1000) * TAUX_POUR_MILLE_USD;
}

/**
 * Liste des partenaires, enrichie de ce qui vit ailleurs : l'accès réellement
 * ouvert, l'existence du compte, et le cumul des relevés.
 */
export async function getPartenaires(): Promise<PartenaireEnrichi[]> {
  const sb = createAdminClient();

  const [{ data: partenaires, error }, { data: releves }] = await Promise.all([
    sb.from('partners').select('*').order('created_at', { ascending: true }),
    sb.from('partner_reports').select('*').order('period_start', { ascending: false }),
  ]);

  if (error) {
    console.warn('[PARTENAIRES] Table absente ou illisible :', error.message);
    return [];
  }
  if (!partenaires?.length) return [];

  // Les comptes vivent dans l'authentification, pas dans une table métier.
  const comptes = new Map<string, { created_at: string; last_sign_in_at: string | null }>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) {
      if (u.email) {
        comptes.set(u.email.toLowerCase(), {
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
    }
  } catch (erreur: any) {
    console.warn('[PARTENAIRES] Comptes illisibles :', erreur?.message);
  }

  return (partenaires as Partenaire[]).map((p) => {
    const compte = comptes.get(p.email.toLowerCase());
    const siens = ((releves ?? []) as ReleveePartenaire[]).filter((r) => r.partner_id === p.id);
    const vuesCumulees = siens.reduce((t, r) => t + (r.views ?? 0), 0);
    return {
      ...p,
      accesOuvert: niveauOffert(p.email),
      inscrit: !!compte,
      inscritLe: compte?.created_at ?? null,
      derniereConnexion: compte?.last_sign_in_at ?? null,
      vuesCumulees,
      publications: siens.reduce((t, r) => t + (r.posts ?? 0), 0),
      duPourVuesUsd: montantDuPourVues(vuesCumulees),
      releves: siens,
    };
  });
}

/** Un partenaire précis, avec tout son suivi. */
export async function getPartenaire(id: string): Promise<PartenaireEnrichi | null> {
  const tous = await getPartenaires();
  return tous.find((p) => p.id === id) ?? null;
}

/** Totaux du budget engagé, par devise — sans conversion arbitraire. */
export function totauxParDevise(partenaires: PartenaireEnrichi[]) {
  const totaux = new Map<string, { engage: number; verse: number; nombre: number }>();
  for (const p of partenaires) {
    const t = totaux.get(p.currency) ?? { engage: 0, verse: 0, nombre: 0 };
    t.engage += Number(p.amount ?? 0);
    if (p.paid) t.verse += Number(p.amount ?? 0);
    t.nombre += 1;
    totaux.set(p.currency, t);
  }
  return [...totaux.entries()]
    .map(([devise, t]) => ({ devise, ...t }))
    .sort((a, b) => b.engage - a.engage);
}

/**
 * Le tableau de bord économique : ce que les partenaires coûtent, ce que
 * l'application encaisse, et ce qu'il reste.
 *
 * Tout est rapporté au franc CFA pour être comparable — c'est le seul moyen de
 * répondre à la question « est-ce que ça vaut le coup ». Les taux employés sont
 * affichés à l'écran pour que le chiffre reste vérifiable.
 */
export interface EconomiePartenaires {
  vuesTotales: number;
  publicationsTotales: number;
  /** Dû au tarif convenu, en dollars, pour l'ensemble des vues relevées. */
  duPourVuesUsd: number;
  /** Forfaits déjà versés, converti. */
  verseXof: number;
  /** Forfaits engagés mais pas encore versés, converti. */
  resteAVerserXof: number;
  /** Dû pour les vues, converti. */
  duPourVuesXof: number;
  /** Total de ce que la campagne coûte : forfaits engagés + dû sur les vues. */
  coutTotalXof: number;
  /** Recettes encaissées depuis le début, lues dans les abonnements. */
  recettesXof: number;
  /** Recettes moins coût total. Négatif tant que la campagne n'a pas payé. */
  resultatXof: number;
  /** Recettes rapportées au coût. `null` si rien n'a encore été dépensé. */
  retourSurInvestissement: number | null;
  /** Recettes nécessaires pour couvrir le coût, exprimées en abonnements VIP. */
  abonnementsPourRentabiliser: number;
}

export function calculerEconomie(
  partenaires: PartenaireEnrichi[],
  recettesXof: number,
  prixAbonnementXof: number
): EconomiePartenaires {
  const vuesTotales = partenaires.reduce((t, p) => t + p.vuesCumulees, 0);
  const publicationsTotales = partenaires.reduce((t, p) => t + p.publications, 0);

  const duPourVuesUsd = montantDuPourVues(vuesTotales);
  const duPourVuesXof = versXof(duPourVuesUsd, 'USD');

  let verseXof = 0;
  let engageXof = 0;
  for (const p of partenaires) {
    const converti = versXof(Number(p.amount ?? 0), p.currency);
    engageXof += converti;
    if (p.paid) verseXof += converti;
  }

  const coutTotalXof = engageXof + duPourVuesXof;
  const resultatXof = recettesXof - coutTotalXof;

  return {
    vuesTotales,
    publicationsTotales,
    duPourVuesUsd,
    verseXof,
    resteAVerserXof: engageXof - verseXof,
    duPourVuesXof,
    coutTotalXof,
    recettesXof,
    resultatXof,
    retourSurInvestissement: coutTotalXof > 0 ? recettesXof / coutTotalXof : null,
    abonnementsPourRentabiliser:
      prixAbonnementXof > 0 ? Math.ceil(coutTotalXof / prixAbonnementXof) : 0,
  };
}
