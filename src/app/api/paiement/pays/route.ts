/**
 * D'OÙ L'ACHETEUR REGARDE-T-IL LA PAGE ?
 *
 * ── POURQUOI UNE ROUTE, PLUTÔT QU'UN CALCUL DANS LE NAVIGATEUR ────────────
 *
 * Le pays se lit dans les en-têtes posés par Cloudflare et Vercel, que seul le
 * serveur reçoit. Le navigateur, lui, ne connaît que son fuseau horaire — et
 * la base des fuseaux fait pointer Bamako, Conakry, Dakar et Ouagadougou vers
 * « Africa/Abidjan ». C'est utile en secours, insuffisant seul.
 *
 * Cette route rend donc le même verdict que celui utilisé pour construire le
 * lien de paiement, et la notice affichée à l'acheteur annonce exactement ce
 * qu'il va trouver. Deux détections différentes finiraient par se contredire,
 * et la notice promettrait Wave à quelqu'un qui verra Apple Pay.
 *
 * ── ELLE NE DIVULGUE RIEN ─────────────────────────────────────────────────
 *
 * Un code pays à deux lettres et le nom du pays. Pas d'adresse IP, pas de
 * ville, aucune donnée de compte.
 */

import { detecterPaysAcheteur } from '@/lib/pays-acheteur';
import { moyensDuPays } from '@/lib/moyens-paiement';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const fuseau = new URL(req.url).searchParams.get('fuseau') ?? undefined;
  const detecte = detecterPaysAcheteur(req.headers, fuseau);

  // Un pays que Chariow ne sert pas vaut autant qu'un pays inconnu : dans les
  // deux cas la notice doit rester générique plutôt que d'annoncer des moyens
  // de paiement qui n'existeront pas sur la page suivante.
  const fiche = moyensDuPays(detecte.code);

  return Response.json({
    pays: fiche ? detecte.code : null,
    nom: fiche?.nom ?? null,
    source: detecte.source,
  });
}
