import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { LEAGUE_IDS } from '@/lib/api-football';
import { getAllCompetitionStatuses } from '@/lib/competition-status';
import { getLiveTeams } from '@/lib/teams-live';
import { verifierPronostics } from '@/lib/precision-reelle';
import { recalculerForcesChampionnats } from '@/lib/forces-championnats';
import { releverCotes } from '@/lib/cotes-marche';
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

  // ── L'ORDRE DE CETTE TÂCHE EST SA PROTECTION ────────────────────────────
  //
  // La plateforme coupe la fonction à `maxDuration`. Ce qui s'exécute en
  // dernier est donc ce qu'on accepte de perdre — et l'ordre d'origine plaçait
  // le plus cher en tête et le plus précieux derrière.
  //
  // Mesuré le 26 août 2026 sur `precision_quotidienne`, écrite près de la fin :
  // sur douze jours, la tâche n'est allée au bout que CINQ fois. Le 25 août est
  // le cas parlant — la vérification a bien tourné (1 214 écritures à minuit)
  // et l'enregistrement final manque. La tâche démarre, travaille, se fait
  // couper.
  //
  // Un seul défaut expliquait trois symptômes qu'on croyait distincts :
  // des journées sans vérification, les 2 106 ventes sans diagnostic de
  // paiement, et les trous du journal quotidien.
  //
  // L'ordre suit désormais la valeur divisée par le coût :
  //
  //   1. vérifier les pronostics ....... 6,6 s, et tout le reste en dépend
  //   2. mur de preuves + journal ...... ce que le public voit
  //   3. ventes et accès ............... quelqu'un a payé et n'a rien reçu
  //   4. hiérarchie des championnats ... améliore le moteur, peut attendre
  //   5. relevé des cotes .............. matière pour dans trois semaines
  //   6. compétitions et effectifs ..... le plus lourd, et le moins urgent :
  //                                      les caches le refont d'eux-mêmes à
  //                                      la première visite.
  //
  // Et le budget ci-dessous s'arrête AVANT la coupure, en disant ce qu'il
  // renonce à faire. Une tâche tuée en plein vol ne laisse aucune trace ; une
  // tâche qui s'arrête d'elle-même écrit ce qu'elle n'a pas fait.
  const BUDGET_MS = 240_000; // 300 s accordées, on garde une marge de sécurité.
  const ecoule = () => Date.now() - debut;
  const ignores: string[] = [];
  const encoreLeTemps = (etape: string, coutMs: number) => {
    if (ecoule() + coutMs <= BUDGET_MS) return true;
    ignores.push(etape);
    console.warn(`[CRON] ${etape} ignoré : ${Math.round(ecoule() / 1000)} s déjà écoulées.`);
    return false;
  };

  try {
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

    // ── ET ON PRÉVIENT CELUI QUI A PAYÉ SANS RIEN RECEVOIR ────────────────
    //
    // La réconciliation ci-dessus ROUVRE l'accès, mais elle ne dit rien au
    // client. L'e-mail qui le prévient partait d'un seul endroit :
    // `entretien-quotidien.ts`, appelé par la page publique du mur de
    // preuves. Autrement dit, il ne partait que si un visiteur ouvrait cette
    // page — et personne ne l'ouvre un mardi matin.
    //
    // Quelqu'un pouvait donc payer, voir son accès rouvert par la tâche de
    // minuit, et ne jamais l'apprendre. Le 22 août 2026, trois personnes
    // étaient dans ce cas, l'une depuis deux jours ; la seule alerte a été un
    // client assez patient pour écrire.
    //
    // Le rattrapage est désormais branché ici, sur le serveur, sans dépendre
    // de la visite de qui que ce soit.
    let accesRattrapes: { repares: number; prevenus: number } | null = null;
    try {
      const { rattraperAccesManquants } = await import('@/lib/acces-manquants');
      const bilan = await rattraperAccesManquants(true);
      accesRattrapes = { repares: bilan.repares, prevenus: bilan.prevenus };
      if (bilan.repares || bilan.prevenus) {
        console.warn(
          `[CRON] Accès rattrapés : ${bilan.repares} rouvert(s), ${bilan.prevenus} client(s) prévenu(s) par courriel.`
        );
      }
    } catch (e: any) {
      console.warn('[CRON] Rattrapage des accès impossible :', e?.message);
    }

    // ── LA HIÉRARCHIE DES CHAMPIONNATS SE REFAIT ICI ──────────────────────
    //
    // Elle sert à comparer une équipe belge et une équipe kazakhe, dont les
    // notes sont calculées dans deux championnats différents et ne veulent
    // rien dire l'une contre l'autre. Mesuré : les rencontres entre
    // championnats passent de 42,5 % à 50,1 % de réussite, les coupes
    // européennes de 48,6 % à 55,9 %.
    //
    // Elle bouge lentement — un championnat ne change pas de niveau en une
    // nuit — et la réserve la garde huit jours. Le recalcul quotidien coûte
    // donc surtout des lectures en réserve, et se refait proprement quand
    // elle expire.
    //
    // Un échec ne fait rien tomber : sans hiérarchie, le rapport vaut 1 et le
    // moteur se comporte exactement comme avant qu'elle existe.
    let championnats: { compétitions: number; confrontations: number } | null = null;
    try {
      const forces = encoreLeTemps('hiérarchie des championnats', 45_000)
        ? await recalculerForcesChampionnats()
        : null;
      if (forces) {
        championnats = {
          compétitions: Object.keys(forces.coefficients).length,
          confrontations: forces.confrontations,
        };
        console.log(
          `[CRON] Hiérarchie des championnats refaite : ${championnats.compétitions} compétitions, ` +
            `${forces.confrontations} confrontations, ${forces.matchsUtilises} matchs lus.`
        );
      }
    } catch (e: any) {
      console.warn('[CRON] Hiérarchie des championnats non refaite :', e?.message);
    }

    // ── LE RELEVÉ DES COTES DU MARCHÉ ─────────────────────────────────────
    //
    // Il ne sert à RIEN aujourd'hui, et c'est assumé : il constitue la matière
    // qui manquera dans trois semaines.
    //
    // Les cotes des bookmakers sont le meilleur prédicteur public du football.
    // Le 24 août 2026, elles ont dû être écartées de la mise au point du
    // moteur parce que le fournisseur ne les garde pas : celles du 23 août
    // rendaient dix matchs, celles du 16 août plus rien. Rien n'était donc
    // validable sur l'historique.
    //
    // Chaque jour sans relevé est un jour de mesure perdu pour toujours.
    let cotes: { jours: number; matchs: number } | null = null;
    try {
      if (!encoreLeTemps('relevé des cotes', 45_000)) throw new Error('budget épuisé');
      const r = await releverCotes();
      cotes = { jours: r.jours, matchs: r.matchs };
      console.log(
        `[CRON] Cotes relevées : ${r.matchs} rencontres sur ${r.jours} journées — ` +
          r.detail.map((d) => `${d.jour.slice(5)} ${d.matchs}`).join(', ')
      );
    } catch (e: any) {
      console.warn('[CRON] Relevé des cotes impossible :', e?.message);
    }

    // ── ET SEULEMENT MAINTENANT, LE PLUS LOURD ────────────────────────────
    //
    // Recharger toutes les compétitions et tous les effectifs chez le
    // fournisseur est de loin le passage le plus coûteux de cette tâche. Il
    // ouvrait le travail ; il le referme désormais.
    //
    // C'est aussi le moins urgent : ces données ont leur propre réserve, qui
    // se refait toute seule à la première visite du jour. Les sauter coûte une
    // attente à un visiteur ; les faire passer devant coûtait la vérification
    // des pronostics, le mur, et les accès de ceux qui avaient payé.
    let statuses: Record<string, any> = {};
    let teams: any[] = [];
    if (encoreLeTemps('rafraîchissement des compétitions et effectifs', 60_000)) {
      try {
        [statuses, teams] = await Promise.all([
          getAllCompetitionStatuses(Object.keys(LEAGUE_IDS), true),
          getLiveTeams(true),
        ]);
      } catch (e: any) {
        console.warn('[CRON] Rafraîchissement des compétitions impossible :', e?.message);
      }
    }

    const resume = Object.values(statuses).map((s: any) => ({
      competition: s.id,
      etat: s.status,
      joues: `${s.played}/${s.total}`,
    }));
    // ── CE QU'ON N'A PAS FAIT SE DIT ────────────────────────────────────
    //
    // Une tâche coupée par la plateforme ne laisse rien derrière elle : c'est
    // ce qui a permis à huit journées de disparaître sans que personne ne
    // s'en aperçoive. Une tâche qui renonce d'elle-même l'écrit, et le rend
    // dans sa réponse.
    console.log(
      `[CRON] Rafraîchissement terminé en ${Date.now() - debut}ms — ` +
      `${Object.keys(statuses).length} compétitions, ${teams.length} équipes, ` +
      `${precision.verifiees} pronostic(s) vérifié(s).` +
      (ignores.length ? ` ÉTAPES IGNORÉES faute de temps : ${ignores.join(', ')}.` : '')
    );

    return NextResponse.json({
      ok: true,
      dureeMs: Date.now() - debut,
      /** Les étapes abandonnées faute de temps — vide quand tout est passé. */
      ignores,
      competitions: Object.keys(statuses).length,
      equipes: teams.length,
      pronostics: precision,
      // `null` signale que la hiérarchie n'a pas pu être refaite ce jour-là :
      // le moteur retombe alors sur son comportement d'avant, sans rien casser.
      championnats,
      cotes,
      accesRattrapes,
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
