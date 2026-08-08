import { LEAGUE_IDS, getSeason, getSeasonLabel } from '@/lib/api-football';

/**
 * État réel d'une compétition, calculé depuis API-Football.
 *
 * Le référentiel affichait des statuts écrits à la main datant de la saison
 * passée — « Terminé — PSG Champion », « J36/38 — Arsenal leader ». Un visiteur
 * y lisait donc de faux résultats. Ces libellés sont désormais dérivés du
 * calendrier et du classement officiels.
 */

export interface CompetitionStatus {
  id: string;
  /** Phrase affichée : « Débute le 15 août », « Journée 3/38 — Real Madrid en tête »… */
  status: string;
  season: string;
  played: number;
  total: number;
  /** Date du prochain match, au format ISO. */
  nextMatch: string | null;
  leader: string | null;
  updatedAt: string;
}

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 h
const cache = new Map<string, { data: CompetitionStatus; at: number }>();

const FINISHED = ['FT', 'AET', 'PEN'];
const NOT_PLAYED = ['NS', 'TBD', 'PST'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

async function apiGet(path: string): Promise<any | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  // Une défaillance passagère ferait disparaître une compétition entière de la
  // page : on réessaie avant de renoncer.
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`https://v3.football.api-sports.io${path}`, {
        headers: { 'x-apisports-key': key },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return await res.json();
    } catch {
      // on retente
    }
    if (essai < 3) await new Promise((r) => setTimeout(r, 400 * essai));
  }
  console.warn(`[COMPETITION_STATUS] Échec API après 3 tentatives : ${path}`);
  return null;
}

/** Calcule l'état d'une compétition, avec cache. */
export async function getCompetitionStatus(
  leagueKey: string,
  force = false
): Promise<CompetitionStatus | null> {
  const cached = cache.get(leagueKey);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const apiId = LEAGUE_IDS[leagueKey];
  if (!apiId) return null;

  const season = getSeason(leagueKey);
  const [fixtures, standings] = await Promise.all([
    apiGet(`/fixtures?league=${apiId}&season=${season}`),
    apiGet(`/standings?league=${apiId}&season=${season}`),
  ]);

  const all: any[] = fixtures?.response || [];
  if (all.length === 0) {
    // Aucun calendrier : soit la compétition n'en a pas encore, soit l'appel a
    // échoué. Dans le doute on NE MET RIEN EN CACHE — mémoriser un échec le
    // figerait plusieurs heures et afficherait « calendrier à paraître » sur
    // une compétition qui a pourtant 380 matchs programmés.
    if (cached) return cached.data;
    return {
      id: leagueKey,
      status: `Saison ${getSeasonLabel(leagueKey)} — calendrier à paraître`,
      season: getSeasonLabel(leagueKey),
      played: 0,
      total: 0,
      nextMatch: null,
      leader: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const played = all.filter((f) => FINISHED.includes(f.fixture.status.short)).length;
  const upcoming = all
    .filter((f) => NOT_PLAYED.includes(f.fixture.status.short))
    .sort((a, b) => +new Date(a.fixture.date) - +new Date(b.fixture.date));

  const table = standings?.response?.[0]?.league?.standings?.[0];
  const top = Array.isArray(table) ? table[0] : null;
  // Un classement à 0 point ne désigne aucun leader : la saison n'a pas commencé.
  const leader = top && top.points > 0 ? top.team.name : null;

  // Les coupes d'Europe commencent par des tours préliminaires en juillet-août.
  // Annoncer « En cours » ferait croire que la compétition proprement dite a
  // démarré, alors que la phase de ligue n'a pas encore eu lieu.
  const estQualif = (f: any) => /qualifying|preliminary|play-?off/i.test(f?.league?.round || '');
  const joues = all.filter((f) => FINISHED.includes(f.fixture.status.short));
  const uniquementQualifs = joues.length > 0 && joues.every(estQualif);
  const premierMatchPrincipal = upcoming.find((f) => !estQualif(f));

  let status: string;
  if (played === 0 && upcoming.length > 0) {
    status = `Débute le ${formatDate(upcoming[0].fixture.date)}`;
  } else if (upcoming.length === 0) {
    status = leader ? `Terminé — ${leader} champion` : 'Saison terminée';
  } else if (uniquementQualifs) {
    status = premierMatchPrincipal
      ? `Qualifications en cours — phase principale le ${formatDate(premierMatchPrincipal.fixture.date)}`
      : 'Qualifications en cours';
  } else if (leader) {
    status = `En cours — ${leader} en tête`;
  } else {
    status = `En cours — ${played}/${all.length} matchs joués`;
  }

  const data: CompetitionStatus = {
    id: leagueKey,
    status,
    season: getSeasonLabel(leagueKey),
    played,
    total: all.length,
    nextMatch: upcoming[0]?.fixture?.date || null,
    leader,
    updatedAt: new Date().toISOString(),
  };
  cache.set(leagueKey, { data, at: Date.now() });
  return data;
}

/**
 * État de plusieurs compétitions.
 *
 * Traité par petits lots : lancer les 17 compétitions d'un coup faisait
 * 34 requêtes simultanées vers API-Football, dont une partie était refusée.
 * Des championnats affichaient alors « calendrier à paraître » alors qu'ils
 * ont bien un calendrier.
 */
export async function getAllCompetitionStatuses(
  keys: string[],
  force = false
): Promise<Record<string, CompetitionStatus>> {
  const TAILLE_LOT = 3;
  const map: Record<string, CompetitionStatus> = {};

  for (let i = 0; i < keys.length; i += TAILLE_LOT) {
    const lot = keys.slice(i, i + TAILLE_LOT);
    const results = await Promise.all(lot.map((k) => getCompetitionStatus(k, force)));
    results.forEach((r) => {
      if (r) map[r.id] = r;
    });
    if (i + TAILLE_LOT < keys.length) await new Promise((r) => setTimeout(r, 250));
  }

  return map;
}
