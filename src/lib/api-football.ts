// ============================================================================
// ProFoot — API-FOOTBALL CLIENT v2.0 (Centralized, Cached, Real-Time)
// ============================================================================
// Ce module centralise TOUTES les requêtes vers API-FOOTBALL.
// Cache intelligent en mémoire avec TTL configurable.
// Fallback sécurisé en cas d'erreur réseau.
// ============================================================================

const API_BASE = "https://v3.football.api-sports.io";

// ---------------------------------------------------------------------------
// In-Memory Cache with TTL
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// ---------------------------------------------------------------------------
// Cache conservé en base
// ---------------------------------------------------------------------------
//
// POURQUOI IL EXISTE
//
// Le cache ci-dessus ne vit qu'en mémoire du serveur, et cette mémoire
// disparaît à chaque démarrage à froid. Sur un hébergement sans serveur, cela
// arrive plusieurs fois par heure : chaque redémarrage redemandait au
// fournisseur des données déjà connues.
//
// Le 16 août 2026, le quota journalier a atteint 98 % — à 100 %, plus AUCUNE
// analyse ne fonctionne pour personne jusqu'au lendemain, y compris pour les
// abonnés payants.
//
// Conservé en base, le cache survit aux redémarrages. Et quand le fournisseur
// refuse de répondre — quota épuisé, panne —, une réponse périmée est servie
// plutôt qu'une erreur : une donnée d'il y a deux heures vaut infiniment mieux
// qu'un écran vide devant quelqu'un qui vient de payer.

/** Réponse conservée, même expirée : elle sert de dernier recours. */
export async function lireReserve<T>(cle: string): Promise<{ contenu: T; expiree: boolean } | null> {
  try {
    const { createAdminClient } = await import('./supabase-admin');
    const { avecDelai, DELAIS } = await import('./delai-securite');

    // ── LA RÉSERVE EST PARTAGÉE PAR SEIZE FICHIERS ──────────────────────────
    //
    // Matchs, preuves, classements, fiches de club, analyses : tous passent par
    // ici. Une seule limite de temps posée à cet endroit protège donc toutes
    // ces pages d'un coup.
    //
    // Le 25 août 2026, quand la base a saturé, cette lecture attendait sans
    // limite. /matches et /preuves dépassaient trente secondes — non parce
    // qu'elles étaient cassées, mais parce qu'elles attendaient un cache qui ne
    // répondait plus.
    //
    // Renvoyer `null` passé le délai est exactement ce que fait déjà le `catch`
    // en bas : l'appelant considère alors qu'il n'y a rien en réserve et va
    // chercher la donnée à la source. Aucun appelant n'a besoin d'être modifié.
    const { data, error } = await avecDelai<any>(
      createAdminClient()
        .from('cache_api')
        .select('contenu, expire_le')
        .eq('cle', cle)
        .maybeSingle(),
      DELAIS.secondaire,
      { data: null, error: null },
      `réserve ${cle.slice(0, 30)}`
    );

    if (error || !data) return null;
    return {
      contenu: data.contenu as T,
      expiree: new Date(data.expire_le).getTime() < Date.now(),
    };
  } catch {
    return null;
  }
}

export async function ecrireReserve(cle: string, contenu: unknown, ttlMs: number): Promise<void> {
  try {
    const { createAdminClient } = await import('./supabase-admin');
    await createAdminClient().from('cache_api').upsert(
      {
        cle,
        contenu,
        expire_le: new Date(Date.now() + ttlMs).toISOString(),
        ecrit_le: new Date().toISOString(),
      },
      { onConflict: 'cle' }
    );
  } catch {
    // Un cache qui n'a pas pu s'écrire ne doit jamais faire échouer l'appel
    // qui vient pourtant de réussir.
  }
}

// TTL Constants
const TTL = {
  FIXTURES_LIVE: 60 * 1000,           // 1 minute for live data
  FIXTURES_TODAY: 5 * 60 * 1000,      // 5 minutes for today's fixtures
  FIXTURES_UPCOMING: 30 * 60 * 1000,  // 30 minutes for upcoming fixtures
  STANDINGS: 60 * 60 * 1000,          // 1 hour for standings
  TEAM_INFO: 24 * 60 * 60 * 1000,     // 24 hours for team info
};

// ---------------------------------------------------------------------------
// Core Fetch Function
// ---------------------------------------------------------------------------
async function apiFootballFetch<T = any>(endpoint: string, ttl: number = TTL.FIXTURES_TODAY): Promise<T | null> {
  const API_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_KEY || API_KEY === "MA_CLE_API" || API_KEY === "") {
    console.error("[API-FOOTBALL] Clé API manquante");
    return null;
  }

  const cacheKey = `apifb:${endpoint}`;
  const cached = getCached<T>(cacheKey);
  if (cached) {
    return cached;
  }

  // Le cache conservé en base, avant d'aller chez le fournisseur. C'est ce qui
  // rend un démarrage à froid gratuit.
  const enBase = await lireReserve<T>(cacheKey);
  if (enBase && !enBase.expiree) {
    setCache(cacheKey, enBase.contenu, ttl);
    return enBase.contenu;
  }

  /** Dernier recours : une réponse périmée vaut mieux qu'un écran vide. */
  const secours = (raison: string): T | null => {
    if (!enBase) return null;
    console.warn(`[API-FOOTBALL] ${raison} sur ${endpoint} — réponse conservée servie.`);
    // Remise en mémoire brièvement : inutile de réinterroger la base à chaque
    // appel pendant une panne.
    setCache(cacheKey, enBase.contenu, 5 * 60 * 1000);
    return enBase.contenu;
  };

  const url = `${API_BASE}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[API-FOOTBALL] HTTP ${res.status} on ${endpoint}`);
      // 429 : quota journalier épuisé. C'est LE cas où il ne faut surtout pas
      // renvoyer un vide — l'abonné a payé, il doit voir quelque chose.
      return secours(`HTTP ${res.status}`);
    }

    const json = await res.json();

    // Le fournisseur répond parfois 200 avec une erreur de quota dans le corps.
    // Sans ce contrôle, une réponse vide était mise en cache comme si elle
    // était valide, et la panne devenait durable.
    const erreurs = (json as any)?.errors;
    const enErreur = Array.isArray(erreurs) ? erreurs.length > 0 : !!erreurs && Object.keys(erreurs).length > 0;
    if (enErreur) {
      console.error(`[API-FOOTBALL] Erreur du fournisseur sur ${endpoint} :`, JSON.stringify(erreurs).slice(0, 200));
      return secours('erreur du fournisseur');
    }

    setCache(cacheKey, json, ttl);
    void ecrireReserve(cacheKey, json, ttl);
    return json as T;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error(`[API-FOOTBALL] Timeout on ${endpoint}`);
      return secours('délai dépassé');
    }
    console.error(`[API-FOOTBALL] Network error on ${endpoint}:`, err.message);
    return secours('erreur réseau');
  }
}

/**
 * Accès brut à l'API, avec le cache partagé.
 *
 * Les fonctions ci-dessous couvrent les besoins de l'interface. L'Agent VIP,
 * lui, compose ses propres requêtes selon la question posée : il lui faut donc
 * ce point d'entrée générique plutôt qu'une fonction par écran.
 */
export async function apiFootball<T = any>(endpoint: string, ttlMs?: number): Promise<T | null> {
  return apiFootballFetch<T>(endpoint, ttlMs ?? TTL.FIXTURES_TODAY);
}

/** Durées de cache réutilisables par les appelants externes. */
export const CACHE_TTL = TTL;

// ---------------------------------------------------------------------------
// Major League IDs (API-Football)
// ---------------------------------------------------------------------------
export const LEAGUE_IDS: Record<string, number> = {
  epl: 39,
  laliga: 140,
  seriea: 135,
  bundesliga: 78,
  ligue1: 61,
  ucl: 2,
  uel: 3,
  uecl: 848,
  eredivisie: 88,
  ligaportugal: 94,
  proleague: 144,
  premiership: 179,
  superlig: 203,
  can: 6,
  // ── TOUTES LES PREMIÈRES DIVISIONS D'EUROPE ────────────────────────────────
  //
  // Ajoutées le 16/08/2026. Le sélecteur ignorait la Suisse le jour de
  // Bâle–Barcelone : l'abonné cherchait son match et repartait bredouille.
  //
  // Chaque identifiant est relevé un par un, jamais déduit. Classer les
  // championnats d'un pays par identifiant croissant DONNE LA MAUVAISE LIGUE
  // dans au moins six pays — en Azerbaïdjan, en Estonie, aux Îles Féroé, en
  // Géorgie, en Israël, à Malte et en Irlande du Nord, le plus petit numéro
  // désigne la DEUXIÈME division. On aurait chargé des clubs de deuxième
  // division en croyant charger l'élite.
  albanie: 310,
  andorre: 312,
  armenie: 342,
  autriche: 218,
  azerbaidjan: 419,
  bielorussie: 116,
  bosnie: 315,
  bulgarie: 172,
  croatie: 210,
  chypre: 318,
  tchequie: 345,
  danemark: 119,
  estonie: 329,
  feroe: 367,
  finlande: 244,
  georgie: 327,
  gibraltar: 758,
  grece: 197,
  hongrie: 271,
  islande: 164,
  irlande: 357,
  israel: 383,
  kazakhstan: 389,
  kosovo: 664,
  lettonie: 365,
  lituanie: 362,
  luxembourg: 261,
  malte: 393,
  moldavie: 394,
  montenegro: 355,
  irlandedunord: 408,
  norvege: 103,
  pologne: 106,
  roumanie: 283,
  russie: 235,
  sanmarin: 404,
  serbie: 286,
  slovaquie: 332,
  slovenie: 373,
  suede: 113,
  suisse: 207,
  ukraine: 333,
  paysdegalles: 110,
  // Deuxièmes divisions dont les clubs sont connus du grand public.
  championship: 40,
  ligue2: 62,
  segunda: 141,
  serieb: 136,
  bundesliga2: 79,
};

/**
 * Saison en cours, calculée et non écrite en dur.
 *
 * Chez API-Football, une saison de club est désignée par son année de début :
 * « 2026 » = saison 2026-2027, qui démarre à la mi-août. À partir du 1er août
 * on bascule donc sur la nouvelle saison. Ce calcul évite d'avoir à réécrire
 * ce fichier chaque été — c'est ce qui avait laissé toute l'application sur
 * la saison 2025-2026.
 */
export function getClubSeason(now: Date = new Date()): number {
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Année de la prochaine édition d'un tournoi qui ne se joue pas chaque année.
 * Entre deux éditions, on annonce la suivante plutôt que d'afficher le vainqueur
 * de la précédente comme si la compétition était d'actualité.
 */
export function getNextEdition(leagueKey: string, now: Date = new Date()): number | null {
  if (leagueKey !== 'can') return null;
  return getSeason('can', now) + 2; // la CAN se joue tous les deux ans
}

/** Compétitions internationales : leur millésime ne suit pas le cycle des clubs. */
const INTERNATIONAL_SEASONS: Record<string, (y: number) => number> = {
  // CAN : années impaires depuis 2025
  can: (y) => (y % 2 === 1 ? y : y - 1),
  // Ligue des nations : cycle bisannuel depuis 2024
};

/**
 * Libellé de saison affiché à l'écran : « 2026-27 » pour un championnat de
 * clubs, l'année seule pour une compétition internationale. Les libellés
 * étaient écrits en dur dans le référentiel et affichaient encore 2025-26.
 */
export function getSeasonLabel(leagueKey: string, now: Date = new Date()): string {
  const year = getSeason(leagueKey, now);
  if (INTERNATIONAL_SEASONS[leagueKey]) return String(year);
  return `${year}-${String(year + 1).slice(2)}`;
}

/** Saison à interroger pour une compétition donnée. */
export function getSeason(leagueKey: string, now: Date = new Date()): number {
  const special = INTERNATIONAL_SEASONS[leagueKey];
  if (special) return special(now.getFullYear());
  return getClubSeason(now);
}

/**
 * Conservé pour compatibilité : se comporte comme un objet mais renvoie
 * désormais une valeur calculée au lieu d'une constante périmée.
 */
export const CURRENT_SEASON: Record<string, number> = new Proxy(
  {},
  { get: (_t, key: string) => getSeason(key) }
) as Record<string, number>;

// ---------------------------------------------------------------------------
// Public API Functions
// ---------------------------------------------------------------------------

/**
 * Get today's fixtures across all major leagues
 */
export async function getTodayFixtures() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const data = await apiFootballFetch<any>(`/fixtures?date=${today}`, TTL.FIXTURES_TODAY);
  return data?.response || [];
}

/**
 * Get upcoming fixtures for a date range (next N days)
 */
export async function getUpcomingFixtures(days: number = 7) {
  const today = new Date();
  const from = today.toISOString().split("T")[0];
  const to = new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  // Fetch from major leagues to avoid too many results
  const majorLeagues = [39, 140, 135, 78, 61, 2, 3, 1, 6]; // EPL, Liga, SerieA, Bund, L1, UCL, UEL, WC, CAN
  
  const allFixtures: any[] = [];
  
  // Batch requests — max 3 parallel to respect rate limits
  for (let i = 0; i < majorLeagues.length; i += 3) {
    const batch = majorLeagues.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(leagueId => 
        apiFootballFetch<any>(`/fixtures?league=${leagueId}&season=${getSeasonForLeague(leagueId)}&from=${from}&to=${to}`, TTL.FIXTURES_UPCOMING)
      )
    );
    results.forEach(r => {
      if (r?.response) allFixtures.push(...r.response);
    });
  }

  // Sort by date
  allFixtures.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
  return allFixtures;
}

/**
 * Get live fixtures
 */
export async function getLiveFixtures() {
  const data = await apiFootballFetch<any>(`/fixtures?live=all`, TTL.FIXTURES_LIVE);
  return data?.response || [];
}

/**
 * Get recently finished fixtures (last 3 days)
 */
export async function getRecentResults(days: number = 3) {
  const today = new Date();
  const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  const majorLeagues = [39, 140, 135, 78, 61, 2, 3];
  const allFixtures: any[] = [];

  for (let i = 0; i < majorLeagues.length; i += 3) {
    const batch = majorLeagues.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(leagueId =>
        apiFootballFetch<any>(`/fixtures?league=${leagueId}&season=${getSeasonForLeague(leagueId)}&from=${from}&to=${to}`, TTL.FIXTURES_UPCOMING)
      )
    );
    results.forEach(r => {
      if (r?.response) allFixtures.push(...r.response);
    });
  }

  // Filter only finished matches and sort by most recent
  const finished = allFixtures.filter(f => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
  finished.sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
  return finished;
}

/**
 * Get standings for a specific league
 */
export async function getStandings(leagueId: string) {
  const apiId = LEAGUE_IDS[leagueId];
  const season = CURRENT_SEASON[leagueId] || 2025;
  if (!apiId) return null;

  const data = await apiFootballFetch<any>(`/standings?league=${apiId}&season=${season}`, TTL.STANDINGS);
  if (!data?.response?.[0]?.league?.standings) return null;

  return data.response[0].league.standings;
}

/**
 * Position réelle d'un club dans son championnat, aujourd'hui.
 *
 * Le référentiel statique fige un rang, un total de points et une série de
 * résultats pour 98 clubs. Ces valeurs datent de leur saisie et ne bougent
 * plus jamais.
 *
 * Renvoie `null` quand le club n'est pas trouvé, et `joues: 0` quand la saison
 * n'a pas encore démarré — l'appelant doit alors annoncer une saison à venir
 * plutôt qu'afficher un rang et des points à zéro.
 */
export async function getClassementClub(
  leagueKey: string,
  nomClub: string
): Promise<{
  rang: number;
  points: number;
  joues: number;
  victoires: number;
  nuls: number;
  defaites: number;
  butsMarques: number;
  butsEncaisses: number;
  forme: ('W' | 'D' | 'L')[];
} | null> {
  const ligue = LEAGUE_IDS[leagueKey];
  if (!ligue) return null;

  const data = await apiFootballFetch<any>(
    `/standings?league=${ligue}&season=${getSeason(leagueKey)}`,
    TTL.STANDINGS
  );
  const lignes = (data?.response?.[0]?.league?.standings ?? []).flat();
  if (!lignes.length) return null;

  const cible = nomClub.toLowerCase();
  const ligne =
    lignes.find((r: any) => r.team?.name?.toLowerCase() === cible) ??
    lignes.find((r: any) => {
      const n = r.team?.name?.toLowerCase() ?? '';
      return n.includes(cible) || cible.includes(n);
    });
  if (!ligne) return null;

  return {
    rang: ligne.rank ?? 0,
    points: ligne.points ?? 0,
    joues: ligne.all?.played ?? 0,
    victoires: ligne.all?.win ?? 0,
    nuls: ligne.all?.draw ?? 0,
    defaites: ligne.all?.lose ?? 0,
    butsMarques: ligne.all?.goals?.for ?? 0,
    butsEncaisses: ligne.all?.goals?.against ?? 0,
    forme: (ligne.form ?? '').split('').slice(-5) as ('W' | 'D' | 'L')[],
  };
}

/**
 * Meilleurs buteurs réels d'un championnat sur la saison en cours.
 *
 * Remplace une liste écrite à la main, figée sur une saison passée : elle
 * annonçait des totaux de buts comme s'ils étaient ceux du moment.
 *
 * Renvoie un tableau vide tant que la saison n'a pas produit de statistiques —
 * un classement vide est honnête, un classement périmé ne l'est pas.
 */
export async function getTopScorers(leagueKey: string): Promise<
  { nom: string; club: string; logoClub: string | null; buts: number; passes: number }[]
> {
  const ligue = LEAGUE_IDS[leagueKey];
  if (!ligue) return [];

  const data = await apiFootballFetch<any>(
    `/players/topscorers?league=${ligue}&season=${getSeason(leagueKey)}`,
    TTL.STANDINGS
  );

  return (data?.response ?? []).slice(0, 5).map((p: any) => {
    const stat = p.statistics?.[0];
    return {
      nom: p.player?.name ?? '—',
      club: stat?.team?.name ?? '—',
      logoClub: stat?.team?.logo ?? null,
      buts: stat?.goals?.total ?? 0,
      passes: stat?.goals?.assists ?? 0,
    };
  });
}

/**
 * Get fixture details by fixture ID
 */
export async function getFixtureById(fixtureId: number) {
  const data = await apiFootballFetch<any>(`/fixtures?id=${fixtureId}`, TTL.FIXTURES_TODAY);
  return data?.response?.[0] || null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function getSeasonForLeague(apiLeagueId: number): number {
  // Retrouve la clé de compétition à partir de son identifiant API pour
  // réutiliser le calcul de saison commun — plus aucune année en dur.
  const key = Object.keys(LEAGUE_IDS).find((k) => LEAGUE_IDS[k] === apiLeagueId);
  return getSeason(key || 'epl');
}

/**
 * Normalize an API-Football fixture into a simplified format for the frontend
 */
export function normalizeFixture(fixture: any) {
  const f = fixture.fixture;
  const teams = fixture.teams;
  const goals = fixture.goals;
  const league = fixture.league;

  const matchDate = new Date(f.date);
  const status = f.status.short;

  let matchStatus: "live" | "finished" | "future" | "today" = "future";
  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT"].includes(status)) {
    matchStatus = "live";
  } else if (["FT", "AET", "PEN"].includes(status)) {
    matchStatus = "finished";
  } else {
    // Check if the match is today
    const today = new Date();
    if (
      matchDate.getFullYear() === today.getFullYear() &&
      matchDate.getMonth() === today.getMonth() &&
      matchDate.getDate() === today.getDate()
    ) {
      matchStatus = "today";
    }
  }

  return {
    id: `api-${f.id}`,
    fixtureId: f.id,
    homeTeam: {
      id: teams.home.id,
      name: teams.home.name,
      logo: teams.home.logo,
      winner: teams.home.winner,
    },
    awayTeam: {
      id: teams.away.id,
      name: teams.away.name,
      logo: teams.away.logo,
      winner: teams.away.winner,
    },
    competition: {
      id: league.id,
      name: league.name,
      country: league.country,
      logo: league.logo,
      round: league.round,
    },
    // ── L'INSTANT DU COUP D'ENVOI, MIS EN FORME PAR LE NAVIGATEUR ──────────
    //
    // `kickoffISO` est la seule valeur qui compte désormais : elle porte
    // l'instant exact, et l'écran la met en forme dans le fuseau de celui qui
    // lit (voir `heure-locale.ts`). L'heure était auparavant figée en
    // « Europe/Paris » ici même — un abonné à Conakry lisait 21:00 pour un
    // match qui commençait à 19:00 chez lui, et le ratait.
    //
    // Les trois chaînes ci-dessous RESTENT, et c'est délibéré : elles servent
    // de repli aux analyses déjà en réserve, qui ne portent pas encore
    // `kickoffISO`. Elles ne doivent plus être affichées quand l'instant est
    // disponible.
    kickoffISO: f.date,
    date: matchDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    fullDate: matchDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
    time: matchDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    timestamp: matchDate.getTime(),
    venue: f.venue?.name || "TBD",
    city: f.venue?.city || "",
    status: matchStatus,
    statusDetail: f.status.long,
    minute: f.status.elapsed,
    score: goals ? { home: goals.home, away: goals.away } : null,
    referee: f.referee,
  };
}

/**
 * Normalize an API-Football standing row
 */
export function normalizeStandingRow(row: any) {
  return {
    rank: row.rank,
    team: {
      id: row.team.id,
      name: row.team.name,
      logo: row.team.logo,
    },
    points: row.points,
    goalsDiff: row.goalsDiff,
    played: row.all.played,
    wins: row.all.win,
    draws: row.all.draw,
    losses: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    form: row.form ? row.form.split("").slice(-5) : [],
    description: row.description,
    status: row.status,
  };
}
