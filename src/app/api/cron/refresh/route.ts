import { NextResponse } from 'next/server';
import { LEAGUE_IDS } from '@/lib/api-football';
import { getAllCompetitionStatuses } from '@/lib/competition-status';
import { getLiveTeams } from '@/lib/teams-live';
import { verifierPronostics } from '@/lib/precision-reelle';
import { construirePreuves } from '@/lib/preuves';
import { enregistrerPrecisionDuJour } from '@/lib/precision-quotidienne';

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

    // Confronte les pronostics passés aux résultats réels. C'est ce passage
    // quotidien qui alimente la précision affichée : sans lui, aucun taux ne
    // pourrait être mesuré et il faudrait en inventer un.
    //
    // Le lot est large parce que le coût ne dépend plus du nombre d'analyses
    // mais du nombre de RENCONTRES distinctes : les cinquante-deux analyses de
    // FC Barcelone — Elche ne coûtent qu'un seul appel.
    const precision = await verifierPronostics(300);

    // ── LE MUR SE RECONSTRUIT ICI AUSSI ───────────────────────────────────────
    //
    // Vérifier les pronostics sans reconstruire les preuves laissait le mur en
    // retard d'un passage : un match joué le 15 août au soir était confronté à
    // son résultat à minuit, mais n'apparaissait publiquement qu'à 5 h 37. Les
    // deux tâches quotidiennes font désormais le travail complet, à des heures
    // différentes — si l'une échoue, l'autre rattrape dans la journée.
    try {
      await construirePreuves();
      await enregistrerPrecisionDuJour();
    } catch (e: any) {
      console.warn('[CRON] Construction des preuves impossible :', e?.message);
    }

    console.log(
      `[CRON] Rafraîchissement terminé en ${Date.now() - debut}ms — ` +
      `${Object.keys(statuses).length} compétitions, ${teams.length} équipes, ` +
      `${precision.verifiees} pronostic(s) vérifié(s).`
    );

    return NextResponse.json({
      ok: true,
      dureeMs: Date.now() - debut,
      competitions: Object.keys(statuses).length,
      equipes: teams.length,
      pronostics: precision,
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
