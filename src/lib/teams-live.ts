import { LEAGUE_IDS, getSeason } from '@/lib/api-football';

/**
 * Équipes chargées depuis API-Football pour la saison en cours.
 *
 * Le référentiel statique (`src/lib/data.ts`) a été écrit à la main pour la
 * saison 2025-2026 : il ne contient ni les promus, ni les championnats hors
 * « big 5 », et il devient faux à chaque mercato. Ici les équipes viennent de
 * la source officielle, donc l'application suit automatiquement les montées,
 * les descentes et les changements de saison.
 */

export interface LiveTeam {
  /** Identifiant stable côté application (slug). */
  id: string;
  /** Identifiant API-Football (sert aux appels fixtures/statistiques). */
  apiId: number;
  name: string;
  logo: string;
  country: string;
  league: string;
  stadium: string;
}

/** Championnats de clubs proposés dans le sélecteur d'analyse. */
export const CLUB_LEAGUES = [
  'epl', 'laliga', 'seriea', 'bundesliga', 'ligue1',
  'eredivisie', 'ligaportugal', 'proleague', 'premiership', 'superlig',
] as const;

const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 h : les effectifs bougent rarement
let cache: { teams: LiveTeam[]; at: number; season: number } | null = null;
let inFlight: Promise<LiveTeam[]> | null = null;

/** Slug lisible et stable, dérivé du nom officiel. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);
}

async function fetchLeagueTeams(leagueKey: string, season: number): Promise<LiveTeam[]> {
  const key = process.env.API_FOOTBALL_KEY;
  const apiId = LEAGUE_IDS[leagueKey];
  if (!key || !apiId) return [];

  // Une défaillance passagère sur un seul championnat ferait disparaître toutes
  // ses équipes du sélecteur sans le moindre signal : on réessaie avant
  // d'abandonner, et on journalise l'échec.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(
        `https://v3.football.api-sports.io/teams?league=${apiId}&season=${season}`,
        { headers: { 'x-apisports-key': key }, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const teams = (data.response || []).map((entry: any) => ({
          id: slugify(entry.team.name),
          apiId: entry.team.id,
          name: entry.team.name,
          logo: entry.team.logo,
          country: entry.team.country,
          league: leagueKey,
          stadium: entry.venue?.name || '',
        }));
        if (teams.length > 0) return teams;
      }
    } catch {
      // on retente
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  console.warn(`[TEAMS] Aucune équipe récupérée pour ${leagueKey} (saison ${season}).`);
  return [];
}

/**
 * Toutes les équipes des championnats de clubs, saison en cours.
 * Les appels concurrents partagent la même requête pour ne pas multiplier
 * les allers-retours vers l'API.
 */
export async function getLiveTeams(): Promise<LiveTeam[]> {
  const season = getSeason('epl');
  if (cache && cache.season === season && Date.now() - cache.at < CACHE_TTL) {
    return cache.teams;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const lists = await Promise.all(
      CLUB_LEAGUES.map((league) => fetchLeagueTeams(league, season))
    );
    const teams = lists.flat();

    // Un échec total (clé absente, API en panne) ne doit pas écraser un cache
    // valide : mieux vaut servir des données un peu anciennes que rien.
    if (teams.length === 0 && cache) return cache.teams;

    if (teams.length > 0) cache = { teams, at: Date.now(), season };
    return teams;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Retrouve une équipe par son slug ou son identifiant API. */
export async function findLiveTeam(idOrApiId: string): Promise<LiveTeam | null> {
  const teams = await getLiveTeams();
  const asNumber = Number(idOrApiId);
  return (
    teams.find((t) => t.id === idOrApiId) ||
    (Number.isFinite(asNumber) ? teams.find((t) => t.apiId === asNumber) : undefined) ||
    null
  );
}
