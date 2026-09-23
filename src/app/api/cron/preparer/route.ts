/**
 * PRÉPARER LES PRONOSTICS, DANS SON PROPRE PASSAGE.
 *
 * ── CE QU'IL CORRIGE, CONSTATÉ LE 23 SEPTEMBRE 2026 ───────────────────────
 *
 * La préparation vivait au milieu de l'entretien quotidien, coupé à soixante
 * secondes par l'hébergeur : elle y recevait VINGT secondes et soixante
 * rencontres au plus, une fois par jour. Tout ce qui dépassait attendait le
 * lendemain — et « les matchs les mieux cernés » comme le message du matin ne
 * peuvent proposer qu'une rencontre déjà calculée.
 *
 * Le 22 septembre, les sélections sont entrées dans la préparation (CAN,
 * Ligues des nations, éliminatoires, amicaux entre sélections A) : un jour de
 * trêve compte à lui seul une centaine de rencontres, sans compter les
 * championnats. Soixante par jour ne suffit plus.
 *
 * ── ET LE QUOTA LE PERMET LARGEMENT ──────────────────────────────────────
 *
 * Relevé le 23 septembre 2026 chez le fournisseur : 5 452 requêtes utilisées
 * sur les 150 000 accordées PAR JOUR, soit 3,6 %. Une rencontre préparée coûte
 * quatre à cinq appels, les classements et les forces étant partagés par tout
 * un championnat : deux cents rencontres reviennent à un millier d'appels.
 *
 * Deux passages plutôt qu'un : le second, après le relevé des cotes de 13 h 15,
 * rattrape les rencontres dont la cote n'existait pas le matin — un pronostic
 * figé sans le marché est privé de sa couche la plus précise.
 *
 * L'entretien quotidien garde le sien : il ne coûte rien quand tout est déjà
 * préparé, et il reste le filet si cette tâche-ci ne part pas.
 */
import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { precalculerGrandsMatchs } from '@/lib/precalcul-selection';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const verdict = autoriserCron(request, 'preparer');
  if (!verdict.autorise) {
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  const debut = Date.now();
  try {
    // 240 s sur les 300 de la plateforme : la lecture des pronostics déjà
    // connus et du programme prend à elle seule une vingtaine de secondes.
    const r = await precalculerGrandsMatchs(240_000, { maxParPassage: 200 });
    console.log(
      `[CRON PRÉPARER] ${r.calculees} calculée(s), ${r.dejaConnues} déjà connue(s) sur ${r.examinees} ` +
        `examinée(s)${r.echecs ? `, ${r.echecs} échec(s)` : ''} en ${Math.round((Date.now() - debut) / 1000)} s`
    );
    return NextResponse.json({ ok: true, ...r, duree: Date.now() - debut });
  } catch (e: any) {
    console.warn('[CRON PRÉPARER] Préparation impossible :', e?.message);
    return NextResponse.json({ ok: false, erreur: e?.message ?? 'inconnue' }, { status: 200 });
  }
}
