/**
 * LE RELEVÉ DES COTES, DANS SON PROPRE PASSAGE.
 *
 * ── CE QU'IL CORRIGE, CONSTATÉ LE 22 SEPTEMBRE 2026 ───────────────────────
 *
 * L'avis du marché est la couche la plus précise du moteur : mesuré sur
 * 6 034 rencontres, il vaut +137 vainqueurs justes, et sur les 37 autres
 * championnats relevés par la production, 188 bons vainqueurs contre 165 pour
 * le moteur seul. Il ne manquait que les cotes.
 *
 * Or le relevé vivait à l'intérieur de la tâche de minuit, qui doit AUSSI
 * juger les pronostics, refaire la hiérarchie des championnats et reconstruire
 * le mur des preuves en trois cents secondes. Il n'y recevait que quatre-vingt
 * dix secondes et ne passait donc qu'un tiers des quatre-vingts compétitions
 * par nuit : une ligue manquée attendait trois jours. Une rencontre analysée
 * entre-temps était calculée sans le marché — et un pronostic figé sans lui ne
 * se rattrape qu'au rafraîchissement.
 *
 * Ce passage-ci ne fait QUE cela, avec les trois cents secondes de la
 * plateforme. Toute la liste passe chaque jour.
 *
 * La tâche de minuit garde son propre relevé : deux passages valent mieux
 * qu'un, les cotes d'un match se précisant jusqu'à la veille, et un relevé
 * COMPLÈTE toujours l'autre — il ne l'écrase jamais (voir `cotes-marche.ts`).
 */
import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { releverCotes } from '@/lib/cotes-marche';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const verdict = autoriserCron(request, 'cotes');
  if (!verdict.autorise) {
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  const debut = Date.now();
  try {
    // Deux cent quarante secondes sur les trois cents : le reste couvre la
    // lecture des fiches de match, qui sert à rattacher chaque cote à ses deux
    // équipes, et la marge de la plateforme.
    const r = await releverCotes(new Date(), 240_000);
    console.log(
      `[CRON COTES] ${r.matchs} rencontres sur ${r.jours} journées, ${r.ligues} compétitions, ` +
        `en ${Math.round((Date.now() - debut) / 1000)} s`
    );
    return NextResponse.json({ ok: true, ...r, duree: Date.now() - debut });
  } catch (e: any) {
    console.warn('[CRON COTES] Relevé impossible :', e?.message);
    return NextResponse.json({ ok: false, erreur: e?.message ?? 'inconnue' }, { status: 200 });
  }
}
