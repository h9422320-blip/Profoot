/**
 * L'ADRESSE OÙ PAWAPAY ANNONCE L'ISSUE D'UN ENCAISSEMENT.
 *
 * ── CETTE ADRESSE EST PUBLIQUE, DONC ELLE NE DÉCIDE DE RIEN ───────────────
 *
 * N'importe qui sur Internet peut envoyer ici un JSON disant « COMPLETED ».
 * Le message n'est donc qu'une SONNETTE : il nous apprend qu'il s'est passé
 * quelque chose sur un encaissement donné. Le statut réel est ensuite relu
 * chez PawaPay avec notre propre jeton, dans `ouvrirAccesSiPaye`.
 *
 * C'est ce qui rend l'adresse inoffensive même sans signature : un message
 * inventé déclenche une relecture qui répond « pas payé », et rien ne s'ouvre.
 *
 * ── CE QU'ON VÉRIFIE QUAND MÊME ───────────────────────────────────────────
 *
 * PawaPay peut signer ses messages (RFC-9421, ECDSA P-256). Quand l'en-tête
 * `Content-Digest` est présent, on contrôle que le corps n'a pas été modifié
 * en route. C'est peu coûteux et ça écarte les corps tronqués.
 *
 * On ne rejette PAS un message non signé : les signatures sont facultatives
 * côté PawaPay, et refuser tout ce qui n'est pas signé nous rendrait sourds si
 * le réglage venait à changer. La sécurité ne repose pas là-dessus.
 *
 * ── POURQUOI ON RÉPOND TOUJOURS 200 ───────────────────────────────────────
 *
 * Une erreur de notre côté ferait réessayer PawaPay en boucle. On accuse donc
 * réception, et on journalise ce qui s'est mal passé. Le rattrapage se fait
 * par relecture, jamais en faisant insister l'expéditeur.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase-admin';
import { STATUTS_FINAUX, type StatutDepot } from '@/lib/pawapay';
import { ouvrirAccesSiPaye, noterIssue } from '@/lib/pawapay-activation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Contrôle l'empreinte du corps quand PawaPay l'a jointe.
 *
 * Format RFC-9530 : `sha-256=:BASE64:`. On accepte l'absence d'en-tête ; on
 * refuse une empreinte qui ne correspond pas.
 */
function empreinteValide(entete: string | null, corps: string): boolean {
  if (!entete) return true; // non signé : voir l'en-tête du fichier
  const m = entete.match(/sha-256=:([^:]+):/i);
  if (!m) return true; // format inconnu : on ne bloque pas sur ce qu'on ne sait pas lire
  const calcule = crypto.createHash('sha256').update(corps, 'utf8').digest('base64');
  return calcule === m[1];
}

export async function POST(request: Request) {
  const brut = await request.text();

  if (!empreinteValide(request.headers.get('content-digest'), brut)) {
    console.error('[PAWAPAY] Rappel ignoré : empreinte du corps invalide.');
    return NextResponse.json({ recu: true, traite: false, motif: 'empreinte' });
  }

  let message: any = null;
  try {
    message = brut ? JSON.parse(brut) : null;
  } catch {
    console.error('[PAWAPAY] Rappel ignoré : corps illisible.');
    return NextResponse.json({ recu: true, traite: false, motif: 'corps illisible' });
  }

  // PawaPay envoie soit l'objet directement, soit enveloppé dans `data`.
  const depot = message?.data ?? message;
  const depositId: string | undefined = depot?.depositId;
  const statutAnnonce: StatutDepot | undefined = depot?.status;

  if (!depositId) {
    console.error('[PAWAPAY] Rappel sans depositId — ignoré.');
    return NextResponse.json({ recu: true, traite: false, motif: 'depositId absent' });
  }

  console.log(`[PAWAPAY] Rappel reçu pour ${depositId} (annoncé : ${statutAnnonce ?? '—'}).`);

  try {
    const admin = createAdminClient();

    // Un statut non final ne mérite qu'une note : rien à ouvrir, rien à fermer.
    if (statutAnnonce && !STATUTS_FINAUX.includes(statutAnnonce)) {
      await noterIssue(admin, depot?.clientReferenceId, statutAnnonce);
      return NextResponse.json({ recu: true, traite: true, statut: statutAnnonce });
    }

    // ── LE SEUL CHEMIN QUI OUVRE UN ACCÈS ────────────────────────────────
    // Il relit le statut chez PawaPay ; le message reçu n'est pas cru.
    const r = await ouvrirAccesSiPaye(admin, depositId);

    if (r.ouvert) {
      return NextResponse.json({ recu: true, traite: true, ouvert: true, plan: r.plan });
    }

    await noterIssue(
      admin,
      depot?.clientReferenceId,
      r.statut ?? statutAnnonce ?? 'inconnu',
      depot?.failureReason?.failureCode,
      depot?.failureReason?.failureMessage
    );
    console.warn(`[PAWAPAY] ${depositId} non crédité : ${r.motif}`);
    return NextResponse.json({ recu: true, traite: true, ouvert: false, motif: r.motif });
  } catch (e: any) {
    // On accuse réception malgré tout : faire réessayer PawaPay en boucle ne
    // réparerait rien de ce qui vient de casser chez nous.
    console.error('[PAWAPAY] Traitement du rappel impossible :', e?.message);
    return NextResponse.json({ recu: true, traite: false, motif: 'erreur interne' });
  }
}

/** PawaPay peut sonder l'adresse. On répond sans rien révéler. */
export async function GET() {
  return NextResponse.json({ service: 'pawapay-callback', pret: true });
}
