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

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Les derniers messages reçus, gardés pour comprendre et diagnostiquer. */
const CLE_JOURNAL = 'maketou:pulse:recus';
const MAX_GARDES = 10;

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
    return NextResponse.json({ recu: true, traite: false, motif: 'non authentifié' });
  }

  try {
    const r = await ouvrirAccesMaketou(createAdminClient(), vente ?? {});
    await journaliser({ ...trace, resultat: r });

    if (r.ouvert) {
      return NextResponse.json({ recu: true, traite: true, ouvert: true, plan: r.plan });
    }
    console.warn(`[MAKETOU] Accès non ouvert : ${r.motif}`);
    return NextResponse.json({ recu: true, traite: true, ouvert: false, motif: r.motif });
  } catch (e: any) {
    console.error('[MAKETOU] Traitement impossible :', e?.message);
    await journaliser({ ...trace, erreur: e?.message });
    return NextResponse.json({ recu: true, traite: false, motif: 'erreur interne' });
  }
}

/** MakeTou peut sonder l'adresse avant de l'accepter. On répond présent. */
export async function GET() {
  return NextResponse.json({ service: 'maketou-pulse', pret: true, protege: !!secretAttendu() });
}
