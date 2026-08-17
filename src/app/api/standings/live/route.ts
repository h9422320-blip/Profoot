import { NextResponse } from 'next/server';
import { LEAGUE_IDS, getSeason, getSeasonLabel, apiFootball, CACHE_TTL } from '@/lib/api-football';

export const maxDuration = 60;

/** Les cinq championnats affichés d'emblée, sans que le lecteur ait à cliquer. */
const GRANDS = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];

/**
 * Les classements réels.
 *
 * LA PAGE N'EN MONTRAIT QUE CINQ
 *
 * Le moteur suit cinquante-huit championnats et connaît le classement de
 * chacun : la Suisse, la Grèce, le Danemark, la Pologne… Un abonné qui suit le
 * championnat portugais ne pouvait pas le consulter ici.
 *
 * CE QUE ÇA COÛTE, ET POURQUOI C'EST TENABLE
 *
 * Tout chercher d'un coup, ce serait cinquante-huit appels par rafraîchissement
 * — le quota a déjà atteint 98 % le 16 août, et au-delà plus aucune analyse ne
 * fonctionne pour personne. Deux choses l'évitent :
 *
 *   1. Les cinq grands seuls sont chargés à l'ouverture ; les autres à la
 *      demande, quand on déplie le championnat qu'on veut voir.
 *   2. Chaque réponse passe par la réserve conservée en base — un classement
 *      déjà lu ne coûte plus rien, même après un démarrage à froid. Le cache
 *      mémoire d'avant était propre à chaque instance : sur Vercel, il repartait
 *      de zéro à chaque réveil et repayait les cinq appels.
 *
 * LES PHASES FINALES
 *
 * La Belgique et l'Écosse coupent leur saison en deux tableaux, les coupes ont
 * des poules. Les groupes sont donc conservés et nommés, au lieu de ne garder
 * que le premier — ce qui aurait fait disparaître la moitié des clubs.
 */
async function classement(ligue: string) {
  const id = LEAGUE_IDS[ligue];
  if (id === undefined) return null;

  const json = await apiFootball<any>(
    `/standings?league=${id}&season=${getSeason(ligue)}`,
    CACHE_TTL.STANDINGS
  );
  const groupes = json?.response?.[0]?.league?.standings;
  if (!Array.isArray(groupes) || groupes.length === 0) return null;

  const lignes = groupes.flat().map((r: any) => ({
    rang: r.rank,
    equipe: r.team?.name ?? '',
    logo: r.team?.logo ?? '',
    groupe: r.group ?? null,
    joues: r.all?.played || 0,
    gagnes: r.all?.win || 0,
    nuls: r.all?.draw || 0,
    perdus: r.all?.lose || 0,
    bp: r.all?.goals?.for || 0,
    bc: r.all?.goals?.against || 0,
    diff: r.goalsDiff || 0,
    points: r.points || 0,
    forme: (r.form || '').split('').slice(-5),
  }));

  if (lignes.length === 0) return null;

  return {
    saison: getSeasonLabel(ligue),
    // Un classement où personne n'a joué n'a rien à montrer : mieux vaut le
    // dire que d'afficher vingt lignes à zéro point.
    aCommence: lignes.some((l) => l.joues > 0),
    lignes,
  };
}

export async function GET(request: Request) {
  // Lecture publique : cette route ne renvoie que des données de football
  // librement consultables — classements, leaders, matchs joués. Aucun contenu
  // payant, aucune donnée de compte. Elle alimente une page désormais indexée
  // par Google, et exiger un compte y rendait la page vide pour un visiteur.

  const demande = new URL(request.url).searchParams.get('id');

  // Un identifiant inconnu ne doit pas partir chez le fournisseur.
  if (demande && LEAGUE_IDS[demande] === undefined) {
    return NextResponse.json({ classements: {} }, { status: 400 });
  }

  const ligues = demande ? [demande] : GRANDS;

  try {
    const resultats = await Promise.all(
      ligues.map(async (l) => [l, await classement(l)] as const)
    );
    return NextResponse.json({
      classements: Object.fromEntries(resultats.filter(([, v]) => v)),
    });
  } catch (error) {
    console.error('[STANDINGS_LIVE] Erreur:', error);
    return NextResponse.json({ classements: {} });
  }
}
