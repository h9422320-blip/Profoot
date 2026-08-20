import { NextResponse } from 'next/server';
import { detecterPaysAcheteur, ipAcheteur } from '@/lib/pays-acheteur';
import { deviseDuPays } from '@/lib/devise-acheteur';

/**
 * QUEL PAYS L'APPLICATION VOIT-ELLE, ET D'OÙ LE TIENT-ELLE ?
 *
 * POURQUOI CETTE ROUTE EXISTE
 *
 * Le 21 août 2026, la page de paiement s'ouvrait en livres sterling avec Alipay
 * et Amazon Pay pour des acheteurs guinéens et ivoiriens. Aucun d'eux ne
 * possédait le moindre moyen de paiement affiché : ils abandonnaient.
 *
 * La cause n'était visible nulle part depuis le navigateur. Elle tenait à un
 * en-tête : depuis le passage par Cloudflare, `x-vercel-ip-country` ne désigne
 * plus l'acheteur mais le point de présence qui a relayé sa requête — Londres
 * pour toute l'Afrique de l'Ouest.
 *
 * Cette route montre côte à côte ce que chaque source raconte. Ouverte depuis
 * un téléphone, elle répond en une seconde à « pourquoi ce client voit-il des
 * livres sterling ». Sans elle, il faut deviner.
 *
 * Lecture seule, aucun secret exposé : uniquement des en-têtes de
 * géolocalisation et le pays qui en est déduit.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const h = req.headers;

  const cf = (h.get('cf-ipcountry') || '').toUpperCase() || null;
  const vercel = (h.get('x-vercel-ip-country') || '').toUpperCase() || null;

  const detecte = detecterPaysAcheteur(h);
  const devise = deviseDuPays(detecte.code);

  // Ce que l'ancien code aurait conclu, pour rendre la correction lisible.
  const avant = vercel && /^[A-Z]{2}$/.test(vercel) ? vercel : 'CI (défaut)';

  return NextResponse.json(
    {
      paysRetenu: detecte.code,
      source: detecte.source,
      devise,
      comparaison: {
        avantLaCorrection: avant,
        apresLaCorrection: detecte.code,
        identique: avant === detecte.code,
      },
      entetes: {
        'cf-ipcountry': cf,
        'x-vercel-ip-country': vercel,
        'cf-ray': h.get('cf-ray'),
        'passe-par-cloudflare': !!h.get('cf-ray'),
      },
      ipAcheteurTransmise: ipAcheteur(h) ?? null,
      quand: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
