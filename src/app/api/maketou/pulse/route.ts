/**
 * L'ADRESSE QUE MAKETOU PRÉVIENT QUAND UNE VENTE RÉUSSIT.
 *
 * ── CETTE ADRESSE EST PUBLIQUE, ET MAKETOU NE SIGNE RIEN ──────────────────
 *
 * Relevé le 27 août 2026 sur un message de test réel : MakeTou n'envoie
 * AUCUNE signature. Le seul marqueur d'origine est un `user-agent` valant
 * « MaketouPulse/1.0 » — que n'importe qui écrit en trois secondes.
 *
 * L'authenticité repose donc entièrement sur un SECRET partagé, placé dans
 * l'adresse du pulse :
 *
 *     https://profootai.com/api/maketou/pulse?cle=<MAKETOU_PULSE_SECRET>
 *
 * Sans ce secret, cette route enregistre le message et n'ouvre RIEN. Ce n'est
 * pas une précaution théorique : une adresse qui ouvre un accès payant sur
 * simple demande rend le produit entier gratuit pour qui sait envoyer une
 * requête.
 *
 * ── POURQUOI ON RÉPOND TOUJOURS 200 ───────────────────────────────────────
 *
 * Une erreur ferait réessayer MakeTou en boucle sans rien réparer. On accuse
 * réception, on journalise, et le rattrapage se fait par relecture.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { ecrireReserve, lireReserve } from '@/lib/api-football';
import { secretAttendu, secretValide, ouvrirAccesMaketou, type VenteMaketou } from '@/lib/maketou';
import { envoyerCourriel, type Courriel } from '@/lib/courriel';
import {
  ALERTE_A,
  messageBienvenue,
  messageCompteAcreer,
  messageAlerteVenteNonHonoree,
} from '@/lib/maketou-courriels';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Les derniers messages reçus, gardés pour comprendre et diagnostiquer. */
const CLE_JOURNAL = 'maketou:pulse:recus';
const MAX_GARDES = 10;

/**
 * Prévenir quelqu'un, sans jamais mettre l'accès en péril pour autant.
 *
 * Un service de courriel injoignable ne doit pas faire échouer l'ouverture
 * d'un accès déjà payé : l'essentiel est fait, le message est accessoire.
 */
async function prevenir(
  a: string | null | undefined,
  message: Omit<Courriel, 'a'>
): Promise<boolean> {
  if (!a) return false;
  try {
    const parti = await envoyerCourriel({ a, ...message });
    if (!parti) console.error(`[MAKETOU] Message NON parti à ${a} — « ${message.sujet} ».`);
    return parti;
  } catch (e: any) {
    console.error(`[MAKETOU] Envoi impossible à ${a} :`, e?.message);
    return false;
  }
}

/** Une alerte au plus par heure, pour que le bruit ne noie pas le signal. */
const CLE_DERNIERE_ALERTE = 'maketou:pulse:derniere-alerte-non-authentifiee';

async function alerterUneFoisParHeure(details: Parameters<typeof messageAlerteVenteNonHonoree>[0]) {
  try {
    const derniere = (await lireReserve<number>(CLE_DERNIERE_ALERTE))?.contenu;
    if (typeof derniere === 'number' && Date.now() - derniere < 3600_000) return;
    await ecrireReserve(CLE_DERNIERE_ALERTE, Date.now(), 24 * 3600_000);
  } catch {
    // Réserve injoignable : mieux vaut une alerte de trop qu'aucune.
  }
  await prevenir(ALERTE_A, messageAlerteVenteNonHonoree(details));
}

async function journaliser(entree: unknown) {
  try {
    const journal = (await lireReserve<any[]>(CLE_JOURNAL))?.contenu ?? [];
    const suivant = [entree, ...(Array.isArray(journal) ? journal : [])].slice(0, MAX_GARDES);
    await ecrireReserve(CLE_JOURNAL, suivant, 7 * 24 * 3600_000);
  } catch (e: any) {
    console.warn('[MAKETOU] Journal impossible :', e?.message);
  }
}

export async function POST(request: Request) {
  const brut = await request.text();

  let vente: VenteMaketou | null = null;
  try {
    vente = brut ? JSON.parse(brut) : null;
  } catch {
    console.error('[MAKETOU] Corps illisible.');
    await journaliser({ recuLe: new Date().toISOString(), erreur: 'corps illisible', brut: brut.slice(0, 500) });
    return NextResponse.json({ recu: true, traite: false, motif: 'corps illisible' });
  }

  const cle = new URL(request.url).searchParams.get('cle');
  const identifie = secretValide(cle);

  const trace = {
    recuLe: new Date().toISOString(),
    evenement: vente?.eventType ?? null,
    vente: vente?.sale?.id ?? null,
    email: vente?.customer?.email ?? null,
    produit: vente?.products?.[0]?.name ?? null,
    montant: vente?.sale?.amount ?? null,
    prix: vente?.products?.[0]?.price ?? null,
    pays: vente?.originCountry?.code ?? null,
    moyen: vente?.paymentMethod?.name ?? null,
    identifie,
  };
  console.log('[MAKETOU] Pulse reçu :', JSON.stringify(trace));

  // ── SANS SECRET, ON N'OUVRE RIEN ────────────────────────────────────────
  if (!identifie) {
    const raison = secretAttendu()
      ? 'clé absente ou incorrecte dans l’adresse du pulse'
      : 'MAKETOU_PULSE_SECRET n’est pas configurée sur le serveur';
    console.error(
      `[MAKETOU] Message NON authentifié — aucun accès ouvert (${raison}). ` +
        `L'adresse du pulse doit se terminer par « ?cle=<secret> ».`
    );
    await journaliser({ ...trace, refuse: raison, corps: vente });

    // ── LE SCÉNARIO LE PLUS COÛTEUX ─────────────────────────────────────────
    //
    // Si l'adresse du pulse perdait sa clé — un pulse recréé sans « ?cle= »,
    // un secret changé côté serveur —, CHAQUE vente serait refusée, en
    // silence, exactement comme ce matin. Une vente authentique arrivant sans
    // clé doit donc alerter.
    //
    // Mais l'adresse est publique : n'importe qui peut la marteler. On alerte
    // donc au plus une fois par heure, pour qu'un inconnu ne puisse pas noyer
    // la boîte du propriétaire — et surtout pas y noyer une vraie alerte.
    if (vente?.eventType === 'SUCCESSFUL_SALE' && vente?.customer?.email) {
      await alerterUneFoisParHeure({
        email: trace.email,
        venteId: trace.vente,
        produit: trace.produit,
        motif:
          `Message NON AUTHENTIFIÉ (${raison}). Si des ventes réelles arrivent ainsi, ` +
          `l'adresse du pulse dans MakeTou doit être corrigée : elle doit finir par « ?cle=… ». ` +
          `Tant que ce n'est pas fait, AUCUNE vente n'ouvrira d'accès.`,
        pays: trace.pays,
        moyen: trace.moyen,
      });
    }
    return NextResponse.json({ recu: true, traite: false, motif: 'non authentifié' });
  }

  try {
    const r = await ouvrirAccesMaketou(createAdminClient(), vente ?? {});
    await journaliser({ ...trace, resultat: r });

    if (r.ouvert) {
      // Son chemin de retour. Il n'est pas forcément parti de profootai.com :
      // la boutique est publique et son lien circule sur WhatsApp. Sans ce
      // message, il a payé et ne sait pas où aller.
      const prevenu = await prevenir(r.email, messageBienvenue(r.expireLe));
      // `prevenu` figure dans la réponse à dessein : sans lui, un service de
      // courriel muet resterait invisible jusqu'au jour où il devait servir.
      return NextResponse.json({ recu: true, traite: true, ouvert: true, plan: r.plan, prevenu });
    }

    // ── UNE VENTE QUI N'OUVRE RIEN NE PEUT PLUS PASSER INAPERÇUE ──────────
    //
    // Le 28 août 2026, dix refus ont dormi trois heures dans le journal
    // pendant que les clients écrivaient sur WhatsApp. Le serveur savait ;
    // personne ne lisait. Un autre défaut viendra un jour, différent — ce qui
    // doit changer, c'est le délai avant qu'on l'apprenne.
    console.warn(`[MAKETOU] Accès non ouvert : ${r.motif}`);

    const ignoree = /Événement ignoré/i.test(r.motif);
    let alerte = false;
    if (!ignoree) {
      if (/Aucun compte/i.test(r.motif) && r.email) {
        await prevenir(r.email, messageCompteAcreer(r.email));
      }
      alerte = await prevenir(
        ALERTE_A,
        messageAlerteVenteNonHonoree({
          email: r.email ?? trace.email,
          venteId: trace.vente,
          produit: trace.produit,
          motif: r.motif,
          pays: trace.pays,
          moyen: trace.moyen,
        })
      );
    }
    return NextResponse.json({ recu: true, traite: true, ouvert: false, motif: r.motif, alerte });
  } catch (e: any) {
    console.error('[MAKETOU] Traitement impossible :', e?.message);
    await journaliser({ ...trace, erreur: e?.message });
    // Une exception est le pire des cas : on ne sait même pas où le traitement
    // s'est arrêté. Elle doit alerter comme les autres.
    await prevenir(
      ALERTE_A,
      messageAlerteVenteNonHonoree({
        email: trace.email,
        venteId: trace.vente,
        produit: trace.produit,
        motif: `Erreur interne : ${e?.message ?? 'inconnue'}`,
        pays: trace.pays,
        moyen: trace.moyen,
      })
    );
    return NextResponse.json({ recu: true, traite: false, motif: 'erreur interne' });
  }
}

/** MakeTou peut sonder l'adresse avant de l'accepter. On répond présent. */
export async function GET() {
  return NextResponse.json({ service: 'maketou-pulse', pret: true, protege: !!secretAttendu() });
}
