/**
 * DÉPLACER UN ACCÈS PAYÉ VERS LE COMPTE QUI EST VRAIMENT CELUI DE L'ACHETEUR.
 *
 * ── POURQUOI CETTE OPÉRATION EXISTE ───────────────────────────────────────
 *
 * Le 29 août 2026 à 18 h 34, AMON crée son compte : essanamon231@gmail.com. À
 * 18 h 46 il paie 2 000 FCFA, en retapant son adresse dans le formulaire de la
 * boutique — et il perd deux lettres : essanon231@gmail.com. À 19 h 02 il
 * revient se connecter sur son vrai compte : il n'y a rien. À 19 h 28, un avis
 * d'une étoile arrive.
 *
 * L'adresse qu'il avait tapée n'existe pas. Gmail répond « 550 5.1.1 Address
 * not found » : ni le message de l'application, ni celui du fondateur ne
 * pouvaient lui parvenir. Son accès l'attendait sur un compte dont il ne
 * recevra jamais le mot de passe.
 *
 * `adresses-jumelles.ts` empêche désormais que cela se reproduise, en posant
 * l'accès sur le bon compte dès la livraison. Restait à réparer les cas déjà
 * survenus, ceux dont l'abonnement est déjà ouvert au mauvais endroit.
 *
 * ── POURQUOI CE N'EST PAS AUTOMATIQUE ─────────────────────────────────────
 *
 * Déplacer un accès déjà ouvert n'est pas une décision qu'une tâche de nuit
 * doit prendre seule. Si elle se trompait de compte, elle donnerait un
 * abonnement payé à un inconnu et le retirerait à celui qui l'a payé — deux
 * fautes d'un coup, pour réparer une faute de frappe.
 *
 * L'opération est donc explicite : on nomme la vente et on nomme le compte.
 * Les vérifications, elles, ne sont jamais facultatives.
 */

import { createAdminClient } from './supabase-admin';

export interface BilanRattachement {
  ok: boolean;
  message: string;
}

/**
 * Déplace l'abonnement d'une vente vers un autre compte.
 *
 * Ne supprime rien : le compte d'origine reste, simplement sans accès.
 */
export async function rattacherVente(
  vente: string,
  versEmail: string
): Promise<BilanRattachement> {
  const sale = String(vente ?? '').trim();
  const cible = String(versEmail ?? '').trim().toLowerCase();
  if (!sale || !cible) return { ok: false, message: 'Vente ou adresse manquante.' };

  const sb = createAdminClient();

  // ── L'ABONNEMENT À DÉPLACER ─────────────────────────────────────────────
  const { data: abos, error: erreurAbo } = await sb
    .from('subscriptions')
    .select('id, user_id, plan, status, expires_at, amount')
    .eq('chariow_sale_id', sale);

  if (erreurAbo) return { ok: false, message: `Lecture impossible : ${erreurAbo.message}` };
  if (!abos?.length) return { ok: false, message: `Aucun abonnement ne porte la vente ${sale}.` };
  if (abos.length > 1)
    return { ok: false, message: `${abos.length} abonnements portent cette vente : à traiter à la main.` };

  const abo = abos[0];

  // ── LE COMPTE D'ARRIVÉE ─────────────────────────────────────────────────
  let arrivee: { id: string; email: string; derniereEntree: string | null } | null = null;
  for (let page = 1; page <= 60 && !arrivee; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    const trouve = data.users.find((u) => String(u.email ?? '').toLowerCase() === cible);
    if (trouve)
      arrivee = { id: trouve.id, email: cible, derniereEntree: trouve.last_sign_in_at ?? null };
    if (data.users.length < 200) break;
  }

  if (!arrivee) return { ok: false, message: `Aucun compte à l'adresse ${cible}.` };
  if (arrivee.id === abo.user_id)
    return { ok: false, message: "L'abonnement est déjà sur ce compte." };

  // ── LE COMPTE D'ARRIVÉE NE DOIT PAS DÉJÀ AVOIR UN ACCÈS ─────────────────
  //
  // Sinon on ne répare pas une erreur, on offre un second abonnement — et on
  // le retire à quelqu'un d'autre pour le faire.
  const { data: dejaLa } = await sb
    .from('subscriptions')
    .select('id, expires_at')
    .eq('user_id', arrivee.id)
    .eq('status', 'active');

  const encoreValide = (dejaLa ?? []).some(
    (s) => s.expires_at && new Date(s.expires_at).getTime() > Date.now()
  );
  if (encoreValide)
    return { ok: false, message: `${cible} possède déjà un accès actif : rien n'est déplacé.` };

  // ── LE COMPTE DE DÉPART NE DOIT PAS ÊTRE UTILISÉ ────────────────────────
  //
  // Quelqu'un qui s'est déjà connecté sur le compte de départ s'en sert : lui
  // retirer son accès sous les pieds serait pire que le laisser où il est.
  const { data: depart } = await sb.auth.admin.getUserById(String(abo.user_id));
  if (depart?.user?.last_sign_in_at) {
    return {
      ok: false,
      message:
        `Le compte de départ (${depart.user.email}) s'est déjà connecté le ` +
        `${String(depart.user.last_sign_in_at).slice(0, 10)} : on ne lui retire pas son accès.`,
    };
  }

  // ── LE DÉPLACEMENT ──────────────────────────────────────────────────────
  const { error: erreurMaj } = await sb
    .from('subscriptions')
    .update({ user_id: arrivee.id })
    .eq('id', abo.id);

  if (erreurMaj) return { ok: false, message: `Déplacement refusé : ${erreurMaj.message}` };

  await sb.from('payment_intents').update({ user_id: arrivee.id }).eq('sale_id', sale);

  await sb.from('webhook_events').insert({
    provider: 'rattachement',
    delivery_id: `rattachement-${abo.id}`,
    event: 'acces_deplace_vers_le_vrai_compte',
    payload: {
      vente: sale,
      de: depart?.user?.email ?? abo.user_id,
      vers: cible,
      plan: abo.plan,
      expire_le: abo.expires_at,
      motif:
        "Adresse tapée au paiement différente de celle du compte. L'accès est posé " +
        'là où la personne se connecte, pas là où elle a payé.',
    },
  });

  console.log(`[RATTACHEMENT] Vente ${sale} : accès déplacé vers ${cible}.`);

  return {
    ok: true,
    message:
      `Accès ${abo.plan} de la vente ${sale} déplacé de ${depart?.user?.email ?? '?'} ` +
      `vers ${cible}, jusqu'au ${String(abo.expires_at).slice(0, 10)}.`,
  };
}
