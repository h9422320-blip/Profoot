import { NextResponse } from 'next/server';
import { LEAGUE_IDS, getSeason, getSeasonLabel } from '@/lib/api-football';

export const maxDuration = 60;

const CACHE_TTL = 30 * 60 * 1000; // 30 min
const cache = new Map<string, { data: any; at: number }>();

const LIGUES = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];

/**
 * Classements réels des cinq grands championnats.
 *
 * La page affichait un classement ENTIÈREMENT écrit à la main, figé sur la
 * saison passée (Arsenal 79 pts, Barcelone 91 pts…). Un visiteur y lisait donc
 * des résultats faux. Ces données viennent désormais d'API-Football, et restent
 * vides tant que la saison n'a pas commencé — plutôt qu'inventées.
 */
export async function GET() {
  // Lecture publique : cette route ne renvoie que des données de football
  // librement consultables — classements, leaders, matchs joués. Aucun contenu
  // payant, aucune donnée de compte. Elle alimente une page désormais indexée
  // par Google, et exiger un compte y rendait la page vide pour un visiteur.

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return NextResponse.json({ classements: {} });

  const now = Date.now();
  const cached = cache.get('all');
  if (cached && now - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const resultats = await Promise.all(
      LIGUES.map(async (ligue) => {
        const season = getSeason(ligue);
        const res = await fetch(
          `https://v3.football.api-sports.io/standings?league=${LEAGUE_IDS[ligue]}&season=${season}`,
          { headers: { 'x-apisports-key': key } }
        );
        if (!res.ok) return [ligue, null] as const;

        const json = await res.json();
        const table = json?.response?.[0]?.league?.standings?.[0];
        if (!Array.isArray(table)) return [ligue, null] as const;

        // Un classement où personne n'a joué n'a rien à montrer.
        const aCommence = table.some((r: any) => (r.all?.played || 0) > 0);

        return [
          ligue,
          {
            saison: getSeasonLabel(ligue),
            aCommence,
            lignes: table.map((r: any) => ({
              rang: r.rank,
              equipe: r.team.name,
              logo: r.team.logo,
              joues: r.all?.played || 0,
              gagnes: r.all?.win || 0,
              nuls: r.all?.draw || 0,
              perdus: r.all?.lose || 0,
              bp: r.all?.goals?.for || 0,
              bc: r.all?.goals?.against || 0,
              diff: r.goalsDiff || 0,
              points: r.points || 0,
              forme: (r.form || '').split('').slice(-5),
            })),
          },
        ] as const;
      })
    );

    const data = { classements: Object.fromEntries(resultats.filter(([, v]) => v)) };
    // Ne jamais mémoriser un résultat vide : un appel raté resterait figé
    // trente minutes et la page afficherait « saison non commencée » à tort.
    if (Object.keys(data.classements).length > 0) {
      cache.set('all', { data, at: now });
    } else if (cached) {
      return NextResponse.json(cached.data);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[STANDINGS_LIVE] Erreur:', error);
    return NextResponse.json({ classements: {} });
  }
}
