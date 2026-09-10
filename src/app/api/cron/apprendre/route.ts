import { NextResponse } from 'next/server';
import { autoriserCron } from '@/lib/garde-cron';
import { jugerRencontresTerminees, recalculerCalibrages } from '@/lib/calibrage';
import { createAdminClient } from '@/lib/supabase-admin';

// L'hébergeur coupe à soixante secondes sur ce projet, quoi qu'on déclare —
// la même limite qui contraint `occasions` et l'Agent VIP. Le budget interne
// ci-dessous est donc calé pour finir AVANT la coupure, jamais dessus.
export const maxDuration = 60;
// Jamais de mise en cache : la tâche doit réellement s'exécuter à chaque appel.
export const dynamic = 'force-dynamic';

/**
 * LE MOTEUR APPREND DE SES PROPRES PRONOSTICS, TOUS LES JOURS.
 *
 * ── POURQUOI CETTE TÂCHE EXISTE À PART ────────────────────────────────────
 *
 * L'apprentissage était déjà branché — en dernière position de la tâche
 * d'audit, après la vérification des analyses, le relevé des paiements et la
 * reconstruction du mur des preuves.
 *
 * Il n'était jamais atteint.
 *
 * Mesuré le 10 septembre 2026 sur la table `audits` : la tâche demandait
 * entre 106 et 218 secondes de travail, pour une coupure à soixante. Le
 * dernier match appris datait du 2 septembre, et 757 rencontres
 * pronostiquées n'avaient jamais été confrontées à leur résultat — dont la
 * soirée de Ligue des champions du 9 septembre, cinq pronostics justes sur
 * six, dont le moteur n'a rien tiré.
 *
 * Rien ne le signalait. Une tâche coupée ne lève pas d'erreur, et
 * « 0 rencontre jugée » n'est pas une panne : c'est une phrase.
 *
 * ── CE QU'ELLE FAIT, DANS CET ORDRE ───────────────────────────────────────
 *
 *   1. JUGER      chaque rencontre terminée est confrontée à son pronostic
 *                 figé, et le verdict est écrit dans `jugements_moteur`.
 *   2. APPRENDRE  les verdicts d'un même championnat deviennent des facteurs
 *                 de correction — le moteur sous-estimait les buts de 33 %
 *                 en Eredivisie, il le sait maintenant.
 *   3. OUVRIR     le relevé de fiabilité est retiré de la réserve pour être
 *                 recalculé sur la matière fraîche, au lieu d'attendre six
 *                 heures de plus.
 *
 * ── CE QUI SE PASSE SI ELLE NE TOURNE PAS ─────────────────────────────────
 *
 * Rien de visible, et c'est bien le problème : le moteur continue d'analyser
 * avec ce qu'il savait la dernière fois. Le compte rendu rendu par cette
 * route est donc volontairement bavard — c'est lui qui permet de voir, d'un
 * coup d'œil, que la boucle avance encore.
 *
 * La tâche d'audit garde son propre bloc d'apprentissage : deux filets valent
 * mieux qu'un, et rien n'y a été retiré.
 */

/** Ce qu'on s'autorise à passer à juger, coupure de l'hébergeur déduite. */
const BUDGET_JUGEMENT_MS = 38_000;

/** En deçà, on ne lance plus l'agrégation : elle serait coupée en chemin. */
const RESERVE_CALIBRAGE_MS = 12_000;

/** Le relevé qui doit repartir de la matière fraîche. */
const CLE_FIABILITE = 'fiabilite:apprise-v6';

export async function GET(request: Request) {
  const verdict = autoriserCron(request, 'apprendre');
  if (!verdict.autorise) {
    console.error(`[APPRENDRE] APPEL REFUSÉ : ${verdict.raison}`);
    return NextResponse.json({ error: 'Non autorisé', motif: verdict.raison }, { status: 401 });
  }

  const debut = Date.now();
  const restant = () => 60_000 - (Date.now() - debut);

  const compte = { jugees: 0, examinees: 0, deja: 0, ligues: 0, matchs: 0, pourquoi: '' };
  const soucis: string[] = [];

  // ── 1. JUGER ────────────────────────────────────────────────────────────
  try {
    const j = await jugerRencontresTerminees(40, BUDGET_JUGEMENT_MS);
    compte.jugees = j.jugees;
    compte.examinees = j.examinees;
    compte.deja = j.deja;
    compte.pourquoi = j.pourquoi;
  } catch (e: any) {
    soucis.push(`jugement : ${e?.message ?? 'inconnu'}`);
    console.warn('[APPRENDRE] Jugement impossible :', e?.message);
  }

  // ── 2. APPRENDRE ────────────────────────────────────────────────────────
  //
  // Cette agrégation relit TOUS les jugements. Elle n'a de sens qu'entière :
  // interrompue, elle écrirait des facteurs calculés sur une moitié de la
  // matière, ce qui est pire que de ne rien écrire. On ne la lance donc que
  // s'il reste de quoi la finir.
  if (restant() > RESERVE_CALIBRAGE_MS) {
    try {
      const c = await recalculerCalibrages();
      compte.ligues = c.ligues;
      compte.matchs = c.matchs;
    } catch (e: any) {
      soucis.push(`calibrage : ${e?.message ?? 'inconnu'}`);
      console.warn('[APPRENDRE] Calibrage impossible :', e?.message);
    }
  } else {
    soucis.push('calibrage remis au passage suivant, faute de temps');
  }

  // ── 3. OUVRIR ───────────────────────────────────────────────────────────
  //
  // Le relevé de fiabilité tient six heures en réserve. Sans ce retrait, ce
  // qu'on vient d'apprendre ne serait servi aux abonnés qu'au prochain
  // recalcul — jusqu'à six heures pendant lesquelles l'écran annonce des
  // taux mesurés sur la matière d'avant.
  //
  // Le retrait ne détruit rien : `lireReleve` rebâtit le relevé à la
  // première lecture, et retombe sur son propre secours s'il échoue.
  if (compte.jugees > 0) {
    try {
      await createAdminClient().from('cache_api').delete().eq('cle', CLE_FIABILITE);
    } catch (e: any) {
      soucis.push(`relevé non rouvert : ${e?.message ?? 'inconnu'}`);
    }
  }

  const secondes = Math.round((Date.now() - debut) / 1000);
  console.log(
    `[APPRENDRE] ${compte.jugees} nouvelle(s) rencontre(s) apprise(s) sur ` +
      `${compte.examinees} examinée(s) — ${compte.deja} déjà connues — ` +
      `${compte.pourquoi} — ` +
      `calibrage sur ${compte.ligues} championnat(s) et ${compte.matchs} rencontre(s), ` +
      `en ${secondes} s.` +
      (soucis.length ? ` Réserves : ${soucis.join(' ; ')}` : '')
  );

  return NextResponse.json({ ok: true, ...compte, secondes, soucis });
}
