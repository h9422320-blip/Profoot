/**
 * L'ADRESSE QUE MAKETOU PRÉVIENT QUAND UNE VENTE RÉUSSIT.
 *
 * ── PREMIÈRE VERSION : ELLE ÉCOUTE, ELLE N'OUVRE RIEN ─────────────────────
 *
 * Le format des messages de MakeTou n'est pas documenté publiquement. Quels
 * champs, quel nom pour l'adresse du client, comment le produit est désigné :
 * on ne le sait pas encore.
 *
 * Construire l'ouverture d'accès contre un format supposé, c'est se garantir
 * un défaut — et ici un défaut se traduit par un client qui paie sans rien
 * recevoir. C'est exactement ce qui est arrivé le 26 août 2026 : treize
 * personnes avaient payé, l'accès ne s'est jamais ouvert, et personne ne l'a
 * su avant qu'un client écrive.
 *
 * Cette version enregistre donc TOUT ce que MakeTou envoie, telle quelle, et
 * n'accorde aucun droit. Une fois le message réel observé — via le bouton
 * « Envoyez un test » du tableau de bord — l'ouverture d'accès sera écrite sur
 * ce qu'on a vu, pas sur ce qu'on a deviné.
 *
 * ── CE QU'IL FAUDRA AJOUTER AVANT D'OUVRIR QUOI QUE CE SOIT ───────────────
 *
 * Un secret partagé. Cette adresse est publique : sans secret, n'importe qui
 * pourrait annoncer une vente et obtenir un accès. Le webhook de l'autre
 * boutique en emploie déjà un (`CHARIOW_WEBHOOK_SECRET`), et celui-ci suivra
 * le même principe — probablement une clé dans l'adresse du pulse, puisque
 * MakeTou n'expose pas de champ dédié.
 *
 * Tant que ce secret n'est pas en place, ce fichier ne doit RIEN ouvrir.
 */

import { NextResponse } from 'next/server';
import { ecrireReserve, lireReserve } from '@/lib/api-football';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Les derniers messages reçus, gardés pour être lus et compris. */
const CLE_JOURNAL = 'maketou:pulse:recus';

/** On en garde dix : assez pour comparer, trop peu pour encombrer. */
const MAX_GARDES = 10;

export async function POST(request: Request) {
  const brut = await request.text();

  // Les en-têtes disent souvent ce que le corps ne dit pas : signature,
  // horodatage, identifiant d'événement. On les garde tous sauf ceux qui
  // pourraient porter un secret.
  const entetes: Record<string, string> = {};
  request.headers.forEach((valeur, nom) => {
    if (/authorization|cookie/i.test(nom)) return;
    entetes[nom] = valeur;
  });

  let corps: unknown = null;
  try {
    corps = brut ? JSON.parse(brut) : null;
  } catch {
    corps = { nonJson: brut.slice(0, 2000) };
  }

  const recu = {
    recuLe: new Date().toISOString(),
    methode: 'POST',
    url: request.url,
    entetes,
    corps,
  };

  console.log('[MAKETOU] Pulse reçu :', JSON.stringify(recu).slice(0, 2000));

  try {
    const journal = (await lireReserve<any[]>(CLE_JOURNAL))?.contenu ?? [];
    const suivant = [recu, ...(Array.isArray(journal) ? journal : [])].slice(0, MAX_GARDES);
    // Sept jours : le temps de comprendre le format et d'écrire la suite.
    await ecrireReserve(CLE_JOURNAL, suivant, 7 * 24 * 3600_000);
  } catch (e: any) {
    // Ne jamais faire échouer la réponse pour un problème d'enregistrement :
    // MakeTou réessaierait en boucle sans que ça répare quoi que ce soit.
    console.warn('[MAKETOU] Journal impossible :', e?.message);
  }

  // On accuse réception. « recu » et non « traité » : le message est bien
  // arrivé, mais aucun accès n'a été ouvert — et c'est volontaire à ce stade.
  return NextResponse.json({
    recu: true,
    traite: false,
    note: "Enregistré pour analyse du format. Aucun accès n'est ouvert par cette version.",
  });
}

/** MakeTou peut sonder l'adresse avant de l'accepter. On répond présent. */
export async function GET() {
  return NextResponse.json({ service: 'maketou-pulse', pret: true });
}
