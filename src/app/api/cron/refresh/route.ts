import { NextResponse } from 'next/server';
import { LEAGUE_IDS } from '@/lib/api-football';
import { getAllCompetitionStatuses } from '@/lib/competition-status';
import { getLiveTeams } from '@/lib/teams-live';

export const maxDuration = 300;
// Jamais de mise en cache : la tâche doit réellement s'exécuter à chaque appel.
export const dynamic = 'force-dynamic';

/**
 * Rafraîchissement quotidien, déclenché par la planification Vercel à 00h00 UTC.
 *
 * Recalcule l'état de toutes les compétitions (matchs joués, prochains matchs,
 * leader, champion) et recharge les effectifs. Sans cela, les données ne se
 * mettraient à jour qu'à l'expiration des caches, au gré des visites.
 */
export async function GET(request: Request) {
  // Vercel signe ses appels planifiés ; en l'absence de secret configuré on
  // accepte l'en-tête officiel pour ne pas bloquer la mise en place.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const estVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');

  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  } else if (!estVercelCron) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const debut = Date.now();
  try {
    // `force` ignore les caches : c'est tout l'intérêt d'une tâche planifiée.
    const [statuses, teams] = await Promise.all([
      getAllCompetitionStatuses(Object.keys(LEAGUE_IDS), true),
      getLiveTeams(),
    ]);

    const resume = Object.values(statuses).map((s) => ({
      competition: s.id,
      etat: s.status,
      joues: `${s.played}/${s.total}`,
    }));

    console.log(
      `[CRON] Rafraîchissement terminé en ${Date.now() - debut}ms — ` +
      `${Object.keys(statuses).length} compétitions, ${teams.length} équipes.`
    );

    return NextResponse.json({
      ok: true,
      dureeMs: Date.now() - debut,
      competitions: Object.keys(statuses).length,
      equipes: teams.length,
      resume,
      horodatage: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Échec du rafraîchissement:', error);
    return NextResponse.json(
      { ok: false, erreur: error?.message || 'inconnue' },
      { status: 500 }
    );
  }
}
