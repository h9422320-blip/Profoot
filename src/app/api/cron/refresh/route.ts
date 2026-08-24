import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
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
  // Le repli qui acceptait un simple user-agent « vercel-cron » a disparu :
  // c'était une chaîne que n'importe qui écrit en trois secondes, et cette
  // route consomme le quota du fournisseur de données football — la ressource
  // la plus rare du projet. Voir `garde-cron.ts`.
  const verdict = autoriserCron(request, 'refresh');
  if (!verdict.autorise) {
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  const debut = Date.now();
  try {
    // `force` ignore les caches : c'est tout l'intérêt d'une tâche planifiée.
    const [statuses, teams] = await Promise.all([
      getAllCompetitionStatuses(Object.keys(LEAGUE_IDS), true),
      // `true` : on relit chez le fournisseur au lieu de servir la réserve.
      // C'est ce passage qui la rafraîchit — sans lui, elle vieillirait jusqu'à
      // expiration et le premier visiteur du jour paierait l'attente.
      getLiveTeams(true),
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
    // ── POURQUOI DIX MILLE, ET PLUS TROIS CENTS ───────────────────────────
    //
    // Le lot de trois cents comptait des ANALYSES, et les prenait de la plus
    // récente à la plus ancienne. Comme dix-sept analyses portent en moyenne
    // sur la même rencontre, un passage n'examinait qu'une vingtaine de
    // matchs — pendant que la boutique en produisait deux mille par jour.
    //
    // Pire, l'arriéré était AFFAMÉ : les nouvelles analyses passant devant,
    // les anciennes n'étaient jamais atteintes. Mesuré le 24 août 2026,
    // 1 871 analyses attendaient depuis plus de trois jours sans aucune
    // chance d'être vues un jour.
    //
    // Le coût ne dépend plus du nombre d'analyses mais du nombre de
    // RENCONTRES distinctes, lues vingt par appel : les 7 046 analyses en
    // attente ce jour-là tenaient dans 21 appels au fournisseur, et 4 530
    // d'entre elles ont été vérifiées d'un coup. Le reste portait sur des
    // matchs pas encore joués.
    //
    // Dix mille couvre donc plusieurs jours de production. Mesuré : 2 653
    // analyses examinées en 6,6 secondes, sur les 300 que la plateforme
    // accorde.
    const precision = await verifierPronostics(10000);

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

    // ── LES VENTES PAYÉES DONT L'ACCÈS NE S'EST PAS OUVERT ───────────────────
    //
    // Le 18 août 2026, deux clients ont payé deux mille francs et n'ont rien
    // reçu : la notification de la boutique s'est perdue. Quatorze sur seize
    // sont passées. L'un des deux a écrit le lendemain matin pour se plaindre,
    // et personne ne savait encore que c'était arrivé.
    //
    // Le filet qui existait exigeait que l'acheteur REVIENNE et que son
    // navigateur déclenche la vérification. Celui qui paie, ne voit rien et
    // s'en va n'était jamais rattrapé — c'est pourtant le client le plus en
    // colère.
    //
    // La réconciliation est branchée sur les DEUX tâches quotidiennes, à des
    // heures différentes : un paiement perdu est repris en quelques heures au
    // lieu de vingt-quatre, et si l'une échoue l'autre rattrape.
    let ventes = null;
    try {
      const { reconcilierVentes } = await import('@/lib/reconciliation-ventes');
      ventes = await reconcilierVentes(7);
      if (ventes.reparees.length > 0) {
        console.warn(
          `[CRON] ${ventes.reparees.length} vente(s) payée(s) sans accès, réparée(s) : ` +
            ventes.reparees.map((v) => v.email ?? v.saleId).join(', ')
        );
      }
      if (ventes.sansTrace.length > 0) {
        console.warn(
          `[CRON] ${ventes.sansTrace.length} vente(s) encaissée(s) sans trace — à regarder à la main : ` +
            ventes.sansTrace.map((v) => v.email ?? v.saleId).join(', ')
        );
      }
    } catch (e: any) {
      console.warn('[CRON] Réconciliation des ventes impossible :', e?.message);
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
      ventesReparees: ventes?.reparees ?? [],
      ventesSansTrace: ventes?.sansTrace ?? [],
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
