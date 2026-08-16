/**
 * La fiche d'une rencontre précise, en données réelles.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Les fiches de rencontre lisaient la liste écrite à la main : une vingtaine
 * de matchs d'avril et mai 2026, avec des scores et des « pronostics » inventés.
 * Toute autre rencontre renvoyait une page introuvable — y compris celles que
 * la page publique des matchs venait d'afficher.
 *
 * Elles sont maintenant lues chez le fournisseur, par identifiant de rencontre,
 * et mises en réserve : une rencontre terminée ne change plus, donc un seul
 * appel suffit pour toujours.
 *
 * CE QU'ON N'AFFICHE PAS
 *
 * Aucun pronostic. La prédiction d'un match est le produit payant : elle vit
 * dans l'analyse. Ici, on montre ce qui s'est passé — ou ce qui va se jouer.
 */

import { apiFootball, CACHE_TTL } from './api-football';

export interface ButMarque {
  minute: number | null;
  joueur: string | null;
  equipe: string | null;
  type: string | null;
}

export interface FicheMatch {
  id: number;
  equipe1: string;
  logo1: string | null;
  equipe2: string | null;
  logo2: string | null;
  competition: string | null;
  logoCompetition: string | null;
  date: string;
  stade: string | null;
  ville: string | null;
  arbitre: string | null;
  termine: boolean;
  enCours: boolean;
  minute: number | null;
  buts1: number | null;
  buts2: number | null;
  buteurs: ButMarque[];
}

const TERMINE = ['FT', 'AET', 'PEN'];
const EN_COURS = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];

export async function lireFicheMatch(id: string | number): Promise<FicheMatch | null> {
  const numero = Number(id);
  if (!Number.isFinite(numero) || numero <= 0) return null;

  try {
    // Réserve longue : une rencontre passée est définitive. Pour celles du
    // jour, la page elle-même se régénère régulièrement.
    const data = await apiFootball<any>(`/fixtures?id=${numero}`, CACHE_TTL.STANDINGS);
    const f = data?.response?.[0];
    if (!f) return null;

    const code = String(f.fixture?.status?.short ?? '');

    const buteurs: ButMarque[] = (f.events ?? [])
      .filter((e: any) => e?.type === 'Goal')
      .map((e: any) => ({
        minute: e?.time?.elapsed ?? null,
        joueur: e?.player?.name ?? null,
        equipe: e?.team?.name ?? null,
        type: e?.detail ?? null,
      }));

    return {
      id: f.fixture.id,
      equipe1: f.teams?.home?.name ?? '',
      logo1: f.teams?.home?.logo ?? null,
      equipe2: f.teams?.away?.name ?? null,
      logo2: f.teams?.away?.logo ?? null,
      competition: f.league?.name ?? null,
      logoCompetition: f.league?.logo ?? null,
      date: String(f.fixture?.date ?? ''),
      stade: f.fixture?.venue?.name ?? null,
      ville: f.fixture?.venue?.city ?? null,
      arbitre: f.fixture?.referee ?? null,
      termine: TERMINE.includes(code),
      enCours: EN_COURS.includes(code),
      minute: EN_COURS.includes(code) ? (f.fixture?.status?.elapsed ?? null) : null,
      buts1: f.goals?.home ?? null,
      buts2: f.goals?.away ?? null,
      buteurs,
    };
  } catch {
    return null;
  }
}
