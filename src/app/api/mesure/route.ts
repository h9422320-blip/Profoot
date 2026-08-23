/**
 * OÙ ARRIVENT LES SIGNAUX DE LA MESURE MAISON.
 *
 * ── ELLE NE DOIT JAMAIS GÊNER UN VISITEUR ─────────────────────────────────
 *
 * Cette route est appelée à chaque page ouverte et à chaque page quittée, sur
 * un téléphone en 3G. Elle répond donc immédiatement, sans rien attendre, et
 * ne renvoie jamais d'erreur : une statistique perdue n'a aucune conséquence,
 * une page ralentie en a une.
 *
 * ── CE QU'ELLE ACCEPTE, ET RIEN D'AUTRE ───────────────────────────────────
 *
 * Le corps vient du navigateur : il ne mérite aucune confiance. Chaque champ
 * est borné avant d'atteindre la base — un chemin de deux cents caractères,
 * une durée plafonnée à quatre heures, un identifiant réduit à sa longueur
 * utile. Sans ces bornes, n'importe qui pourrait remplir la table.
 *
 * ── LE PAYS VIENT DE L'EN-TÊTE, PAS DU CLIENT ─────────────────────────────
 *
 * Comme pour le paiement : une valeur envoyée par le navigateur se falsifie en
 * trois secondes. Cloudflare pose le vrai pays dans `CF-IPCountry`.
 */

import { createAdminClient } from '@/lib/supabase-admin';
import { createClient as createServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/** Au-delà, ce n'est plus une visite : c'est un onglet oublié ouvert. */
const DUREE_MAX_MS = 4 * 60 * 60 * 1000;

const borner = (v: unknown, max: number): string =>
  String(v ?? '').trim().slice(0, max);

export async function POST(req: Request) {
  // Répondre « reçu » quoi qu'il arrive : le navigateur n'attend pas, et un
  // code d'erreur ne servirait qu'à salir la console du visiteur.
  const recu = () => new Response(null, { status: 204 });

  try {
    const corps = await req.json().catch(() => null);
    if (!corps || typeof corps !== 'object') return recu();

    const vueId = borner(corps.vueId, 40);
    if (!vueId) return recu();

    const admin = createAdminClient();

    // ── LE DÉPART : on complète la ligne posée à l'arrivée ──────────────────
    if (corps.type === 'depart') {
      const duree = Number(corps.dureeMs);
      if (!Number.isFinite(duree) || duree < 0) return recu();

      await admin
        .from('visites_pages')
        .update({ duree_ms: Math.round(Math.min(duree, DUREE_MAX_MS)) })
        .eq('vue_id', vueId);

      return recu();
    }

    // ── L'ARRIVÉE ──────────────────────────────────────────────────────────
    const chemin = borner(corps.chemin, 200);
    if (!chemin.startsWith('/')) return recu();

    // L'administration ne se mesure pas elle-même. Le contrôle est répété ici :
    // le navigateur pourrait envoyer n'importe quoi.
    if (chemin.startsWith('/admin')) return recu();

    const ordre = Math.min(200, Math.max(1, Number(corps.ordre) || 1));

    // Le compte, s'il y en a un. Une visite anonyme reste parfaitement valable :
    // c'est même la majorité, et c'est celle qu'on cherche à convertir.
    let compteId: string | null = null;
    try {
      const sb = await createServerClient();
      const { data: { user } } = await sb.auth.getUser();
      compteId = user?.id ?? null;
    } catch {
      compteId = null;
    }

    const pays =
      (req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || '')
        .trim()
        .toUpperCase()
        .slice(0, 2) || null;

    await admin.from('visites_pages').insert({
      vue_id: vueId,
      visite_id: borner(corps.visiteId, 40) || vueId,
      chemin,
      ordre,
      pays: pays === 'XX' || pays === 'T1' ? null : pays,
      mobile: corps.mobile === true,
      compte_id: compteId,
    });

    return recu();
  } catch {
    // Une table absente, une base injoignable : la visite continue comme si de
    // rien n'était. C'est le seul comportement acceptable pour une mesure.
    return new Response(null, { status: 204 });
  }
}
