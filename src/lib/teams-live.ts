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

/**
 * Championnats de clubs préchargés dans le sélecteur.
 *
 * L'ancienne liste s'arrêtait à dix championnats. Un utilisateur cherchant le
 * FC Bâle un jour de Bâle–Barcelone ne trouvait rien : la Suisse n'était pas
 * chargée. Payer puis ne pas trouver son club est la pire chose qui puisse
 * arriver ici, et ça n'émet aucune erreur — personne ne l'aurait vu.
 *
 * Ces championnats sont ceux qu'on charge D'AVANCE, pour la navigation par
 * pays. Ils ne bornent pas ce qui est analysable : `chercherEquipes` va
 * chercher n'importe quel club du monde à la demande, et `findLiveTeam` sait
 * résoudre un identifiant absent de cette liste.
 */
export const CLUB_LEAGUES = [
  // Les cinq grands
  'epl', 'laliga', 'seriea', 'bundesliga', 'ligue1',
  // Reste de l'Europe de l'Ouest
  'eredivisie', 'ligaportugal', 'proleague', 'premiership', 'superlig',
  'suisse', 'autriche', 'grece', 'danemark', 'norvege', 'suede',
  // Europe centrale et de l'Est
  'pologne', 'tchequie', 'croatie', 'serbie', 'ukraine', 'roumanie',
  // Deuxièmes divisions dont les clubs sont connus du public
  'championship', 'ligue2', 'segunda', 'serieb', 'bundesliga2',
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
    // Par paquets, et non tous d'un coup : vingt-cinq requêtes simultanées font
    // dépasser la minute allouée à la fonction, et le sélecteur revient vide —
    // exactement le défaut qu'on cherche à corriger.
    const teams: LiveTeam[] = [];
    const PAR_PAQUET = 8;
    for (let i = 0; i < CLUB_LEAGUES.length; i += PAR_PAQUET) {
      const paquet = CLUB_LEAGUES.slice(i, i + PAR_PAQUET);
      const lists = await Promise.all(paquet.map((l) => fetchLeagueTeams(l, season)));
      teams.push(...lists.flat());
    }

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

/**
 * Écarte ce qui n'est pas une équipe première masculine.
 *
 * La recherche d'API-Football renvoie pêle-mêle « FC Basel 1893 », « Basel
 * U19 », « Basel II » et « Basel W ». Proposer une réserve ou une équipe de
 * jeunes produirait une analyse sur les mauvais joueurs — un pronostic faux que
 * rien ne signalerait. Ce filtre a déjà évité de confondre Lyon et Lyon II.
 */
function estEquipePremiere(nom: string): boolean {
  return !/\b(U\s?1[5-9]|U\s?2[0-3]|W|Women|Feminin|Féminin|II|III|B|Reserves?|Youth|Academy|Sub-?2[0-3])\b/i.test(
    nom
  );
}

/** Retire les accents et la ponctuation pour comparer « Bâle » et « bale ». */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const cacheRecherche = new Map<string, LiveTeam[]>();

/**
 * Cherche un club PARTOUT, pas seulement dans les championnats préchargés.
 *
 * C'est ce qui garantit qu'un abonné trouve toujours son club : les
 * championnats chargés d'avance servent à naviguer, celui-ci sert à trouver.
 * Une recherche infructueuse coûte un appel d'API, mis en cache ensuite.
 */
export async function chercherEquipes(requete: string): Promise<LiveTeam[]> {
  const q = normaliser(requete);
  if (q.length < 3) return [];
  if (cacheRecherche.has(q)) return cacheRecherche.get(q)!;

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(q)}`,
      { headers: { 'x-apisports-key': key }, signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = await res.json();
    const trouvees: LiveTeam[] = (data.response || [])
      .filter((e: any) => e.team?.name && estEquipePremiere(e.team.name))
      .map((e: any) => ({
        id: slugify(e.team.name),
        apiId: e.team.id,
        name: e.team.name,
        logo: e.team.logo,
        country: e.team.country ?? '',
        league: '',
        stadium: e.venue?.name || '',
      }));

    cacheRecherche.set(q, trouvees);
    return trouvees;
  } catch {
    return [];
  }
}

/** Une équipe précise, par identifiant API-Football. */
async function equipeParApiId(apiId: number): Promise<LiveTeam | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://v3.football.api-sports.io/teams?id=${apiId}`, {
      headers: { 'x-apisports-key': key },
    });
    if (!res.ok) return null;
    const e = (await res.json()).response?.[0];
    if (!e?.team?.name) return null;
    return {
      id: slugify(e.team.name),
      apiId: e.team.id,
      name: e.team.name,
      logo: e.team.logo,
      country: e.team.country ?? '',
      league: '',
      stadium: e.venue?.name || '',
    };
  } catch {
    return null;
  }
}

/**
 * Retrouve une équipe par son slug ou son identifiant API.
 *
 * Le repli sur l'API est indispensable : un club trouvé par la recherche
 * n'appartient pas forcément à un championnat préchargé. Sans lui, l'analyse
 * répondrait « Équipe inconnue » sur un club que l'application venait pourtant
 * de proposer — trouvé puis refusé, ce qui est pire qu'introuvable.
 */
export async function findLiveTeam(idOrApiId: string): Promise<LiveTeam | null> {
  const teams = await getLiveTeams();
  const asNumber = Number(idOrApiId);
  const connue =
    teams.find((t) => t.id === idOrApiId) ||
    (Number.isFinite(asNumber) ? teams.find((t) => t.apiId === asNumber) : undefined);
  if (connue) return connue;

  if (Number.isFinite(asNumber) && asNumber > 0) return equipeParApiId(asNumber);

  // Slug d'un club hors championnats préchargés : on le retrouve par son nom.
  const parNom = await chercherEquipes(idOrApiId.replace(/([a-z])([A-Z])/g, '$1 $2'));
  return parNom.find((t) => t.id === idOrApiId) ?? null;
}
