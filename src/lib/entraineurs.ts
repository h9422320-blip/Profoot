/**
 * DEPUIS QUAND L'ENTRAÎNEUR EST-IL LÀ ?
 *
 * ── CE QUI A ÉTÉ MESURÉ, LE 20 SEPTEMBRE 2026 ───────────────────────────
 *
 * Sur 5 679 côtés d'équipe des cinq grands championnats, en comparant ce que
 * le moteur ANNONÇAIT — marché compris — à ce qui est arrivé :
 *
 *     entraîneur en place depuis moins de 30 jours   annoncé 32,8 %  →  réel 26,0 %
 *     entre 31 et 90 jours                          annoncé 33,5 %  →  réel 31,5 %
 *     entre 91 et 365 jours                         annoncé 35,4 %  →  réel 34,5 %
 *     depuis plus d'un an                           annoncé 40,4 %  →  réel 41,6 %
 *
 * Autrement dit : le moteur SURESTIME une équipe qui vient de changer
 * d'entraîneur. C'est logique — il la juge sur les chiffres de l'équipe
 * d'avant, celle d'un autre entraîneur, et les bookmakers ne corrigent pas
 * tout non plus.
 *
 * ── CE QUE ÇA RAPPORTE ──────────────────────────────────────────────────
 *
 * Avec la couche des absents, sur 3 553 rencontres : 1 892 → 1 919 bons
 * vainqueurs (+27), positif sur les DEUX moitiés (+16, +11) et sur les trois
 * périodes de contrôle (+9, +12, +6), dans quatre championnats sur cinq
 * (Italie +11, France +8, Angleterre +6, Allemagne +3, Espagne −1), et sans
 * perdre un seul score exact.
 *
 * ── POURQUOI L'ENTRAÎNEUR ET PAS LA COMPOSITION ─────────────────────────
 *
 * Le onze de départ tombe une heure avant le coup d'envoi ; un pronostic est
 * figé vingt-quatre heures avant. La composition ne servirait donc presque
 * jamais. Un changement d'entraîneur, lui, se sait des semaines à l'avance.
 */

import { apiFootball, CACHE_TTL, lireReserve, ecrireReserve } from './api-football';
import { CINQ_GRANDS } from './forces-absences';

/** La part retenue par la mesure : l'équipe compte comme amputée d'un cinquième. */
export const PART_ENTRAINEUR_NEUF = 0.2;
/** Au-delà, l'effet disparaît — mesuré à 30, 45, 60, 90 et 180 jours. */
export const JOURS_ENTRAINEUR_NEUF = 60;

const CLE = 'entraineurs:v1';
const CONSERVATION_MS = 30 * 24 * 60 * 60 * 1000;
const FRAIS_MS = 7 * 24 * 60 * 60 * 1000;

export interface Entraineurs {
  calculeLe: string;
  /** Par club : « début|fin,début|fin… », une date vide valant « en cours ». */
  clubs: Record<string, string>;
}

let enMemoire: { quand: number; valeur: Entraineurs | null } | null = null;
const MEMOIRE_MS = 10 * 60 * 1000;

export async function lireEntraineurs(): Promise<Entraineurs | null> {
  if (enMemoire && Date.now() - enMemoire.quand < MEMOIRE_MS) return enMemoire.valeur;
  try {
    const r = await lireReserve<Entraineurs>(CLE);
    if (r?.contenu) {
      enMemoire = { quand: Date.now(), valeur: r.contenu };
      return r.contenu;
    }
  } catch {
    // La lecture rapide a renoncé : on insiste ci-dessous.
  }
  try {
    const { createAdminClient } = await import('./supabase-admin');
    const lecture = createAdminClient().from('cache_api').select('contenu').eq('cle', CLE).maybeSingle();
    const limite = new Promise<'delai'>((r) => setTimeout(() => r('delai'), 8_000));
    const r: any = await Promise.race([lecture, limite]);
    const contenu = r === 'delai' || r?.error ? null : ((r?.data?.contenu as Entraineurs) ?? null);
    if (contenu) enMemoire = { quand: Date.now(), valeur: contenu };
    return contenu;
  } catch {
    return null;
  }
}

/**
 * Depuis combien de jours l'entraîneur de ce club est-il en poste, à cette date ?
 *
 * `null` quand on ne sait pas : la couche se tait alors, plutôt que d'inventer
 * une arrivée récente et d'affaiblir une équipe sans raison.
 */
export function joursDepuisLArrivee(
  entraineurs: Entraineurs | null,
  club: number | string | null | undefined,
  dateISO: string | null | undefined
): number | null {
  const brut = entraineurs?.clubs?.[String(club)];
  const quand = Date.parse(String(dateISO ?? ''));
  if (!brut || !Number.isFinite(quand)) return null;

  let dernierDebut: number | null = null;
  for (const passage of brut.split(',')) {
    const [debut, fin] = passage.split('|');
    const d = Date.parse(`${debut}T00:00:00Z`);
    if (!Number.isFinite(d) || d > quand) continue;
    const f = fin ? Date.parse(`${fin}T00:00:00Z`) : Infinity;
    if (quand > f) continue;
    if (dernierDebut === null || d > dernierDebut) dernierDebut = d;
  }
  return dernierDebut === null ? null : Math.round((quand - dernierDebut) / 86_400_000);
}

/** Ce que pèse un entraîneur fraîchement arrivé, pour ce club à cette date. */
export function partDeLEntraineurNeuf(
  entraineurs: Entraineurs | null,
  ligue: number | string | null | undefined,
  club: number | string | null | undefined,
  dateISO: string | null | undefined
): number {
  if (!CINQ_GRANDS.has(Number(ligue))) return 0;
  const jours = joursDepuisLArrivee(entraineurs, club, dateISO);
  if (jours === null || jours > JOURS_ENTRAINEUR_NEUF) return 0;
  return PART_ENTRAINEUR_NEUF;
}

/**
 * Relève les passages d'entraîneurs des clubs des cinq grands championnats.
 *
 * Cinq appels pour les effectifs, un par club ensuite — cent vingt environ.
 * Une fois par semaine suffit : un entraîneur ne change pas deux fois par jour.
 */
export async function recalculerEntraineurs(
  saison = saisonCourante(),
  options: { forcer?: boolean } = {}
): Promise<Entraineurs | null> {
  if (!options.forcer) {
    const existant = await lireEntraineurs();
    const age = existant ? Date.now() - Date.parse(existant.calculeLe) : Infinity;
    if (existant && Number.isFinite(age) && age < FRAIS_MS) return existant;
  }

  const existant = await lireEntraineurs();
  const clubs: Record<string, string> = { ...(existant?.clubs ?? {}) };

  const identifiants = new Set<number>();
  for (const ligue of CINQ_GRANDS) {
    const r = await apiFootball<any>(`/teams?league=${ligue}&season=${saison}`, CACHE_TTL.TEAM_INFO);
    for (const x of r?.response ?? []) {
      const id = Number(x?.team?.id ?? 0);
      if (id) identifiants.add(id);
    }
  }
  if (!identifiants.size) return existant;

  for (const club of identifiants) {
    const r = await apiFootball<any>(`/coachs?team=${club}`, CACHE_TTL.TEAM_INFO);
    const passages: string[] = [];
    for (const c of r?.response ?? []) {
      for (const x of c?.career ?? []) {
        if (Number(x?.team?.id) !== club || !x?.start) continue;
        passages.push(`${String(x.start)}|${x?.end ? String(x.end) : ''}`);
      }
    }
    // Un club sans réponse garde ce qu'on savait de lui.
    if (passages.length) clubs[String(club)] = passages.sort().join(',');
  }

  if (!Object.keys(clubs).length) return null;
  const contenu: Entraineurs = { calculeLe: new Date().toISOString(), clubs };
  try {
    await ecrireReserve(CLE, contenu, CONSERVATION_MS);
    enMemoire = { quand: Date.now(), valeur: contenu };
  } catch {
    // Une écriture impossible n'empêche pas de servir le calcul en cours.
  }
  return contenu;
}

function saisonCourante(maintenant = new Date()): number {
  const an = maintenant.getUTCFullYear();
  return maintenant.getUTCMonth() >= 6 ? an : an - 1;
}
