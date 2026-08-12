import { NextResponse } from 'next/server';
import { executerAudit } from '@/lib/audit';
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
        `${resultat.avertissements} à surveiller.`
    );

    return NextResponse.json(resultat);
  } catch (erreur: any) {
    console.error('[AUDIT] Exécution impossible :', erreur?.message);
    return NextResponse.json({ error: erreur?.message ?? 'Audit impossible' }, { status: 500 });
  }
}
