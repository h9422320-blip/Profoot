import { NextResponse } from 'next/server';
import { executerAudit } from '@/lib/audit';
import { verifierPronostics } from '@/lib/precision-reelle';
import { rafraichirStatutsPaiement } from '@/lib/echecs-paiement';
import { construirePreuves } from '@/lib/preuves';
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

  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  } else if (!estVercelCron) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
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
      verification = await verifierPronostics(150);
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
    } catch (e: any) {
      console.warn('[AUDIT] Construction des preuves impossible :', e?.message);
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

    return NextResponse.json({ ...resultat, verification });
  } catch (erreur: any) {
    console.error('[AUDIT] Exécution impossible :', erreur?.message);
    return NextResponse.json({ error: erreur?.message ?? 'Audit impossible' }, { status: 500 });
  }
}
