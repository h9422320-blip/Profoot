/**
 * Les vraies rencontres, pour la page publique des matchs.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * La page `/matches` affichait une liste ÉCRITE À LA MAIN : des rencontres
 * datées d'avril et mai 2026, avec des scores et des « pronostics » inventés,
 * confiance comprise — « PSG 5-4 Bayern, prédiction 3-2, confiance 52 % ».
 * C'est resté invisible tant que la page était fermée au public ; l'ouvrir à
 * Google aurait publié ces chiffres sous le nom du site.
 *
 * COMBIEN ÇA COÛTE
 *
 * Une seule requête par JOUR affiché, et non une par championnat : le
 * fournisseur sait rendre toutes les rencontres d'une date en un appel. Quatre
 * jours affichés valent donc quatre appels, mis en réserve ensuite. Le quota a
 * atteint 98 % le 16 août 2026 — au-delà, plus aucune analyse ne fonctionne
 * pour personne.
 *
 * CE QU'ON N'AFFICHE PAS
 *
 * Aucun pronostic. Cette page montre le calendrier et les résultats ; les
 * prédictions vivent dans l'analyse, qui est le produit payant, et sur le mur
 * de preuves, qui ne montre que du vérifié.
 */

import { apiFootball, LEAGUE_IDS, CACHE_TTL } from './api-football';

export interface MatchReel {
  id: number;
  equipe1: string;
  logo1: string | null;
  equipe2: string;
  logo2: string | null;
  competition: string;
  logoCompetition: string | null;
  /** Date ISO du coup d'envoi. */
  date: string;
  stade: string | null;
  statut: 'aujourdhui' | 'a_venir' | 'termine';
  /** Minute en cours, pour une rencontre commencée. */
  minute: number | null;
  buts1: number | null;
  buts2: number | null;
}

/** Les championnats que l'application suit — les autres sont ignorés. */
const LIGUES_SUIVIES = new Set(Object.values(LEAGUE_IDS));

const TERMINE = ['FT', 'AET', 'PEN'];
const EN_COURS = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];

function jourISO(decalage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function convertir(f: any, jourDuJour: string): MatchReel | null {
  if (!LIGUES_SUIVIES.has(f?.league?.id)) return null;

  const code = String(f?.fixture?.status?.short ?? '');
  const dateMatch = String(f?.fixture?.date ?? '');

  const statut: MatchReel['statut'] = TERMINE.includes(code)
    ? 'termine'
    : dateMatch.slice(0, 10) === jourDuJour || EN_COURS.includes(code)
      ? 'aujourdhui'
      : 'a_venir';

  return {
    id: f.fixture.id,
    equipe1: f.teams?.home?.name ?? '',
    logo1: f.teams?.home?.logo ?? null,
    equipe2: f.teams?.away?.name ?? '',
    logo2: f.teams?.away?.logo ?? null,
    competition: f.league?.name ?? '',
    logoCompetition: f.league?.logo ?? null,
    date: dateMatch,
    stade: f.fixture?.venue?.name ?? null,
    statut,
    minute: EN_COURS.includes(code) ? (f.fixture?.status?.elapsed ?? null) : null,
    buts1: f.goals?.home ?? null,
    buts2: f.goals?.away ?? null,
  };
}

/**
 * Les rencontres d'hier à après-demain, dans les championnats suivis.
 *
 * Renvoie une liste vide plutôt qu'une erreur : la page doit s'afficher même
 * quand le fournisseur ne répond pas, et une section vide se dit franchement.
 */
export async function lireMatchsReels(): Promise<MatchReel[]> {
  const jourDuJour = jourISO(0);
  const jours = [jourISO(-1), jourDuJour, jourISO(1), jourISO(2)];

  const listes = await Promise.all(
    jours.map(async (j) => {
      try {
        // Une rencontre passée ne change plus ; celles du jour bougent encore.
        const ttl = j < jourDuJour ? CACHE_TTL.TEAM_INFO : 10 * 60 * 1000;
        const data = await apiFootball<any>(`/fixtures?date=${j}`, ttl);
        return (data?.response ?? []) as any[];
      } catch {
        return [];
      }
    })
  );

  const matchs = listes
    .flat()
    .map((f) => convertir(f, jourDuJour))
    .filter((m): m is MatchReel => m !== null);

  // Doublons possibles quand une rencontre apparaît sur deux dates selon le
  // fuseau du fournisseur.
  const parId = new Map<number, MatchReel>();
  for (const m of matchs) if (!parId.has(m.id)) parId.set(m.id, m);

  return [...parId.values()].sort((a, b) => a.date.localeCompare(b.date));
}
