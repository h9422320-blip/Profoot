import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { bilanDuSoir, messageBilanDuSoir, jourDuBilan } from '@/lib/bilan-du-soir';
import { courrielDisponible, envoyerCourriel } from '@/lib/courriel';
import { ALERTE_A } from '@/lib/maketou-courriels';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * LE CHIFFRE DE LA JOURNÉE, TOUS LES SOIRS À 23 H 59.
 *
 * Demandé par le propriétaire le 10 septembre 2026, après avoir découvert
 * lui-même, sur le tableau de bord de MakeTou, un écart que l'application
 * n'avait pas signalé.
 *
 * ── POURQUOI 23 H 59, ET POURQUOI CETTE MINUTE-LÀ ────────────────────────
 *
 * Toutes les journées du projet se découpent sur le temps universel —
 * `toISOString().slice(0, 10)` partout, du pré-calcul au mur public. Les pays
 * du franc CFA sont à cette même heure. Une tâche à 23 h 59 relève donc une
 * journée complète, dans le repère exact où elle a été comptée.
 *
 * ── ON N'ENVOIE PAS UN BILAN VIDE ────────────────────────────────────────
 *
 * Une journée sans vente n'a rien à raconter, et un message quotidien qu'on
 * apprend à ignorer ne sert plus à rien le jour où il compte. Sauf si la
 * boutique, elle, a annoncé des ventes : dans ce cas le silence des comptes
 * est précisément l'information.
 */
export async function GET(request: Request) {
  const verdict = autoriserCron(request, 'bilan-du-soir');
  if (!verdict.autorise) {
    console.error(`[BILAN] APPEL REFUSÉ : ${verdict.raison}`);
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  try {
    const jour = new URL(request.url).searchParams.get('jour') ?? jourDuBilan();
    const bilan = await bilanDuSoir(jour);
    const message = messageBilanDuSoir(bilan);

    console.log(`[BILAN] ${JSON.stringify(bilan)}`);

    const rienADire = bilan.ventes === 0 && bilan.manquantes === 0;
    if (rienADire) {
      return NextResponse.json({ ok: true, envoye: false, motif: 'aucune vente', bilan });
    }

    if (!courrielDisponible()) {
      console.warn('[BILAN] RESEND_API_KEY absente : le bilan n’a pas pu partir.');
      return NextResponse.json({ ok: true, envoye: false, motif: 'courriel indisponible', bilan });
    }

    const envoye = await envoyerCourriel({ a: ALERTE_A, ...message });
    if (!envoye) console.warn('[BILAN] Le bilan du soir n’est pas parti.');

    return NextResponse.json({ ok: true, envoye, bilan });
  } catch (e: any) {
    console.error('[BILAN] Bilan impossible :', e?.message);
    return NextResponse.json({ ok: false, erreur: e?.message ?? 'inconnue' }, { status: 500 });
  }
}
