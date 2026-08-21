import { NextResponse } from 'next/server';
import { executerAudit } from '@/lib/audit';
import { verifierPronostics } from '@/lib/precision-reelle';
import { rafraichirStatutsPaiement } from '@/lib/echecs-paiement';
import { construirePreuves } from '@/lib/preuves';
import { enregistrerPrecisionDuJour } from '@/lib/precision-quotidienne';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 120;
// Jamais de mise en cache : la tâche doit réellement s'exécuter à chaque appel.
export const dynamic = 'force-dynamic';

/**
 * Audit de santé, déclenché par la planification Vercel toutes les demi-heures.
 *
 * Il tourne sans personne devant l'écran, ce qui est tout l'intérêt : les
 * pannes de cette application n'ont jamais provoqué d'erreur, elles ont produit
 * des résultats faux pendant des jours, et n'ont été découvertes qu'en
 * regardant un tableau par hasard.
 *
 * Le verdict est enregistré. Un audit qui ne laisse pas de trace ne sert à
 * rien : une anomalie détectée à trois heures du matin doit pouvoir être lue le
 * lendemain.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const estVercelCron = request.headers.get('user-agent')?.includes('vercel-cron');

  // ── UN REFUS NE DOIT PLUS ÊTRE SILENCIEUX ─────────────────────────────────
  //
  // Cette route rendait 401 sans rien écrire nulle part. Résultat : une seule
  // exécution enregistrée en base depuis la mise en place, et un mur de preuves
  // figé qu'il fallait reconstruire à la main chaque jour. Rien ne plantait,
  // rien n'alertait — la tâche refusait simplement de partir.
  //
  // Le refus est désormais tracé, avec ce qui l'a causé. La prochaine fois, la
  // réponse est dans les journaux au lieu d'être à deviner.
  const refuser = (motif: string) => {
    console.error(
      `[AUDIT] APPEL REFUSÉ (${motif}) — user-agent="${request.headers.get('user-agent') ?? 'absent'}" ` +
        `authorization=${auth ? 'présent' : 'absent'} secret=${secret ? 'configuré' : 'absent'}`
    );
    return NextResponse.json({ error: 'Non autorisé', motif }, { status: 401 });
  };

  if (secret) {
    if (auth !== `Bearer ${secret}`) return refuser('secret attendu, reçu différent');
  } else if (!estVercelCron) {
    return refuser("aucun secret configuré et l'appel ne vient pas de la planification");
  }

  try {
    // La vérification des pronostics tourne AVEC l'audit, et non une seule fois
    // par nuit.
    //
    // À raison d'un passage quotidien de soixante analyses, l'arriéré ne se
    // résorbait jamais : 271 analyses attendaient pendant qu'une seule était
    // vérifiée. Un match joué à 21 h n'était confronté à son résultat que le
    // lendemain, alors que c'est le jour même qu'il intéresse — c'est ce qui
    // rend le diagnostic utilisable pour parler du produit.
    let verification: { examinees: number; verifiees: number; enAttente: number } | null = null;
    try {
      // Le lot est large parce que le coût ne dépend plus du nombre d'analyses
      // mais du nombre de RENCONTRES distinctes : 300 analyses ne représentent
      // qu'une soixantaine d'appels. Avec un lot de 150, l'arriéré ne se
      // résorbait jamais — il grossissait plus vite qu'il n'était traité.
      verification = await verifierPronostics(300);
    } catch (e: any) {
      console.warn('[AUDIT] Vérification des pronostics impossible :', e?.message);
    }

    // Le sort des demandes de paiement se releve aussi ici : sans lui, on voit
    // que l argent ne rentre pas sans jamais savoir pourquoi.
    try {
      await rafraichirStatutsPaiement(40);
    } catch (e: any) {
      console.warn('[AUDIT] Releve des paiements impossible :', e?.message);
    }

    // Les preuves publiques se reconstruisent apres la verification des
    // pronostics : elles n en sont que l agregation par match.
    try {
      await construirePreuves();
      await enregistrerPrecisionDuJour();
    } catch (e: any) {
      console.warn('[AUDIT] Construction des preuves impossible :', e?.message);
    }

    // ── LE MOTEUR RELIT SES PROPRES PRONOSTICS ────────────────────────────
    //
    // C'est ce qui rend la boucle CONTINUE plutôt que ponctuelle : sans ce
    // passage quotidien, les facteurs resteraient figés au jour où ils ont été
    // calculés à la main, et le moteur n'apprendrait plus rien de ce qui s'est
    // joué depuis.
    //
    // Placé après la vérification des pronostics, qui vient d'écrire les
    // résultats réels dont ce calcul se nourrit. L'ordre n'est pas indifférent :
    // l'inverse ferait apprendre sur les données de la veille.
    try {
      const { jugerRencontresTerminees, recalculerCalibrages } = await import('@/lib/calibrage');

      // ── JUGER D'ABORD, APPRENDRE ENSUITE ────────────────────────────────
      //
      // Le recalcul ne fait qu'agréger ce qui a déjà été jugé. Sans ce premier
      // temps, la tâche relisait chaque nuit les mêmes rencontres et
      // n'apprenait plus rien de ce qui s'était joué depuis — une boucle qui
      // tourne à vide a toutes les apparences d'une boucle qui fonctionne.
      const j = await jugerRencontresTerminees();
      if (j.jugees) console.log(`[AUDIT] ${j.jugees} nouvelle(s) rencontre(s) jugée(s).`);

      const c = await recalculerCalibrages();
      console.log(`[AUDIT] Calibrage : ${c.ligues} championnat(s), ${c.matchs} rencontre(s).`);
    } catch (e: any) {
      // Tables absentes ou base muette : l'audit continue. Un apprentissage
      // manqué se rattrape le lendemain ; un audit manqué, non.
      console.warn('[AUDIT] Calibrage impossible :', e?.message);
    }

    const resultat = await executerAudit();

    // L'enregistrement ne doit pas faire échouer l'audit : mieux vaut un verdict
    // rendu sans trace qu'aucun verdict du tout.
    const { error } = await createAdminClient().from('audits').insert({
      anomalies: resultat.anomalies,
      avertissements: resultat.avertissements,
      points: resultat.points,
      duree_ms: resultat.duree_ms,
    });
    if (error) console.warn('[AUDIT] Verdict non enregistré :', error.message);

    // Les anomalies sortent aussi dans les journaux : elles y sont lisibles
    // immédiatement, sans attendre l'ouverture de l'administration.
    for (const p of resultat.points.filter((x) => x.gravite === 'anomalie')) {
      console.error(`[AUDIT] ANOMALIE — ${p.domaine} : ${p.message}`);
    }
    for (const p of resultat.points.filter((x) => x.gravite === 'attention')) {
      console.warn(`[AUDIT] À surveiller — ${p.domaine} : ${p.message}`);
    }
    console.log(
      `[AUDIT] Terminé en ${resultat.duree_ms} ms — ${resultat.anomalies} anomalie(s), ` +
        `${resultat.avertissements} à surveiller.` +
        (verification ? ` Pronostics : ${verification.verifiees} vérifié(s), ${verification.enAttente} en attente.` : '')
    );

    // ── SECOND PASSAGE SUR LES VENTES PAYÉES SANS ACCÈS ──────────────────────
    //
    // Le même travail que la tâche de minuit, cinq heures plus tard. Un client
    // qui paie le matin n'attend donc pas le lendemain, et si l'un des deux
    // passages échoue l'autre rattrape. Une vente déjà honorée est ignorée :
    // repasser dessus ne peut pas offrir deux abonnements.
    let ventes = null;
    try {
      const { reconcilierVentes } = await import('@/lib/reconciliation-ventes');
      ventes = await reconcilierVentes(7);
      if (ventes.reparees.length > 0) {
        console.error(
          `[AUDIT] ANOMALIE — paiements : ${ventes.reparees.length} vente(s) payée(s) sans accès, ` +
            `réparée(s) : ${ventes.reparees.map((v) => v.email ?? v.saleId).join(', ')}`
        );
      }
      if (ventes.sansTrace.length > 0) {
        console.error(
          `[AUDIT] ANOMALIE — paiements : ${ventes.sansTrace.length} vente(s) encaissée(s) sans trace, ` +
            `impossible de savoir à qui ouvrir l'accès : ${ventes.sansTrace.map((v) => v.email ?? v.saleId).join(', ')}`
        );
      }
    } catch (e: any) {
      console.warn('[AUDIT] Réconciliation des ventes impossible :', e?.message);
    }

    return NextResponse.json({ ...resultat, verification, ventes });
  } catch (erreur: any) {
    console.error('[AUDIT] Exécution impossible :', erreur?.message);
    return NextResponse.json({ error: erreur?.message ?? 'Audit impossible' }, { status: 500 });
  }
}
