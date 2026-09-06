import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { construireForces } from '@/lib/forme-occasions';

// L'hébergeur coupe à soixante secondes sur ce projet — la même limite qui
// contraint l'Agent VIP. Déclarer trois cents ne changeait rien : la fonction
// était tuée en pleine lecture, toujours avant d'écrire, et cette tâche n'a
// donc jamais rien produit. La construction tient désormais en trente-cinq
// secondes et avance d'une compétition par passage. Voir `forme-occasions.ts`.
export const maxDuration = 60;
// Jamais de mise en cache : la tâche doit réellement s'exécuter à chaque appel.
export const dynamic = 'force-dynamic';

/**
 * Reconstruit la forme des équipes mesurée en OCCASIONS.
 *
 * ── POURQUOI UNE TÂCHE PLANIFIÉE, ET PAS UN CALCUL À LA DEMANDE ──────────
 *
 * Bâtir ce relevé demande de relire cent cinquante jours de calendrier des
 * cinq grands championnats et d'aller chercher les statistiques de tirs de
 * chaque rencontre. Plusieurs centaines d'appels au fournisseur la première
 * fois. Un abonné qui attend son analyse ne doit jamais payer ça.
 *
 * Les fois suivantes coûtent une poignée d'appels : les statistiques d'une
 * rencontre TERMINÉE ne changent plus jamais, elles restent un an en réserve,
 * et seules les journées nouvellement jouées sont demandées.
 *
 * ── CE QUI SE PASSE SI ELLE NE TOURNE PAS ────────────────────────────────
 *
 * Rien de visible. `lireForces` accepte un relevé périmé — la forme d'une
 * équipe ne se retourne pas en six heures — et s'il n'y en a aucun, le moteur
 * rend exactement ce qu'il rendait avant, au centième près. Cette tâche
 * améliore l'analyse ; elle ne la conditionne pas.
 *
 * Voir `forme-occasions.ts` pour la mesure qui a décidé de tout ceci.
 */
export async function GET(request: Request) {
  const verdict = autoriserCron(request, 'occasions');
  if (!verdict.autorise) {
    console.error(`[OCCASIONS] APPEL REFUSÉ : ${verdict.raison}`);
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  const debut = Date.now();
  try {
    const releve = await construireForces();

    if (!releve) {
      // Matière insuffisante : on ne remplace surtout pas le relevé précédent,
      // qui reste servi. Un relevé maigre serait pire que le relevé d'hier.
      console.warn('[OCCASIONS] Matière insuffisante — le relevé précédent est conservé.');
      return NextResponse.json({ ok: false, motif: 'matière insuffisante' });
    }

    const clubs = Object.keys(releve.clubs).length;
    console.log(
      `[OCCASIONS] Relevé construit : ${clubs} clubs, ` +
        `${releve.moyenne} occasion(s) par équipe et par match, ` +
        `avantage du terrain ${releve.avantageDomicile} / ${releve.avantageExterieur}, ` +
        `en ${Math.round((Date.now() - debut) / 1000)} s.`
    );

    return NextResponse.json({
      ok: true,
      clubs,
      moyenne: releve.moyenne,
      avantageDomicile: releve.avantageDomicile,
      avantageExterieur: releve.avantageExterieur,
      secondes: Math.round((Date.now() - debut) / 1000),
    });
  } catch (e: any) {
    console.error(`[OCCASIONS] ÉCHEC : ${e?.message}`);
    return NextResponse.json({ ok: false, erreur: e?.message ?? 'inconnu' }, { status: 500 });
  }
}
