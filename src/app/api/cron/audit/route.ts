import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
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
  // Le refus reste tracé — c'est ce qui manquait quand la tâche ne partait
  // pas sans que rien ne l'explique — mais le repli par user-agent a disparu :
  // il suffisait d'écrire « vercel-cron » pour entrer. Voir `garde-cron.ts`.
  const verdict = autoriserCron(request, 'audit');
  if (!verdict.autorise) {
    console.error(`[AUDIT] APPEL REFUSÉ : ${verdict.raison}`);
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
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
      // mais du nombre de RENCONTRES distinctes, lues vingt par appel : les
      // 7 046 analyses en attente du 24 août 2026 tenaient dans 21 appels.
      //
      // Six mille et non dix mille comme la tâche de minuit : celle-ci ne
      // dispose que de cent vingt secondes, contre trois cents. Ce passage de
      // 5 h 37 rattrape ce que la nuit a manqué — deux filets valent mieux
      // qu'un, et ils n'ont pas besoin d'avoir la même maille.
      verification = await verifierPronostics(6000);
    } catch (e: any) {
      console.warn('[AUDIT] Vérification des pronostics impossible :', e?.message);
    }

    // Le sort des demandes de paiement se releve aussi ici : sans lui, on voit
    // que l argent ne rentre pas sans jamais savoir pourquoi.
    // ── UN RENONCEMENT SILENCIEUX N'EN EST PAS UN ─────────────────────────
    //
    // `rafraichirStatutsPaiement` rend `{ releves: 0, erreur: … }` — sans lever
    // d'exception — quand la clé de la boutique manque sur le serveur. La
    // valeur de retour était jetée : la fonction pouvait donc ne rien faire
    // tous les jours sans qu'une seule ligne ne l'indique.
    //
    // Constaté le 26 août 2026 : les 2 106 intentions de paiement avaient
    // TOUTES leurs colonnes de diagnostic vides. Quand un client écrivait
    // « je n'arrive pas à payer », il n'y avait rien à regarder. Le relevé
    // lancé à la main a rendu la réponse en une minute — première cause
    // d'échec : un portefeuille pas assez approvisionné.
    //
    // Même principe que `garde-cron.ts` : ce qui ne se fait pas doit se dire.
    try {
      const r = await rafraichirStatutsPaiement(40);
      if (r.erreur) {
        console.error(
          `[AUDIT] Relevé des paiements NON EFFECTUÉ : ${r.erreur} ` +
            `Tant que ce message revient, aucune cause d'échec de paiement n'est enregistrée.`
        );
      } else {
        console.log(`[AUDIT] Paiements relevés : ${r.releves}, dont ${r.echecs} en échec.`);
      }
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

    // ── CEUX QUI ONT PAYÉ ET QUI SONT RESTÉS DEHORS ──────────────────────
    //
    // La réconciliation ci-dessus vérifie que l'accès est OUVERT. Elle ne dit
    // rien de celui qui n'arrive pas à s'en servir — et c'est exactement ce
    // qui s'est produit le 29 août 2026 : trois personnes avaient un
    // abonnement actif et n'étaient jamais entrées, faute de mot de passe.
    //
    // Le second passage de la journée, cinq heures après celui de minuit : une
    // personne bloquée depuis la veille au soir ne doit pas attendre un jour
    // entier pour être vue.
    let bloques = null;
    try {
      const { signalerAbonnesJamaisEntres } = await import('@/lib/abonnes-jamais-entres');
      bloques = await signalerAbonnesJamaisEntres();
      if (bloques.bloques.length > 0) {
        console.error(
          `[AUDIT] ANOMALIE — accès : ${bloques.bloques.length} abonné(s) actif(s) ne se sont ` +
            `jamais connectés : ${bloques.bloques.map((b) => b.email).join(', ')}`
        );
      }
    } catch (e: any) {
      console.warn('[AUDIT] Relevé des abonnés jamais entrés impossible :', e?.message);
    }

    // Et on leur écrit. Le second passage de la journée : quelqu'un qui a
    // franchi les vingt-quatre heures dans la nuit ne doit pas attendre
    // l'entretien du lendemain pour recevoir son lien.
    try {
      const { relancerAbonnesJamaisEntres } = await import('@/lib/relance-jamais-entres');
      const r = await relancerAbonnesJamaisEntres();
      if (r.relances) console.log(`[AUDIT] ${r.relances} abonné(s) relancé(s) : ${r.details.join(' ; ')}`);
    } catch (e: any) {
      console.warn('[AUDIT] Relance des abonnés impossible :', e?.message);
    }

    return NextResponse.json({ ...resultat, verification, ventes, bloques });
  } catch (erreur: any) {
    console.error('[AUDIT] Exécution impossible :', erreur?.message);
    return NextResponse.json({ error: erreur?.message ?? 'Audit impossible' }, { status: 500 });
  }
}
