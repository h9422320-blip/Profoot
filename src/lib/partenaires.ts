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
  releves: ReleveePartenaire[];
}

/** Devises affichées telles qu'elles ont été versées, sans conversion. */
export function montantPartenaire(montant: number, devise: string): string {
  const symbole: Record<string, string> = { EUR: '€', USD: '$', XOF: 'FCFA' };
  const valeur = Number(montant ?? 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const s = symbole[devise] ?? devise;
  return devise === 'XOF' ? `${valeur} ${s}` : `${valeur} ${s}`;
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
    return {
      ...p,
      accesOuvert: niveauOffert(p.email),
      inscrit: !!compte,
      inscritLe: compte?.created_at ?? null,
      derniereConnexion: compte?.last_sign_in_at ?? null,
      vuesCumulees: siens.reduce((t, r) => t + (r.views ?? 0), 0),
      publications: siens.reduce((t, r) => t + (r.posts ?? 0), 0),
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
  const totaux = new Map<string, { engage: number; verse: number }>();
  for (const p of partenaires) {
    const t = totaux.get(p.currency) ?? { engage: 0, verse: 0 };
    t.engage += Number(p.amount ?? 0);
    if (p.paid) t.verse += Number(p.amount ?? 0);
    totaux.set(p.currency, t);
  }
  return [...totaux.entries()].map(([devise, t]) => ({ devise, ...t }));
}
