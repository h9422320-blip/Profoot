"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { estAdmin } from "@/lib/admins";
import { PLANS, type PlanKey } from "@/lib/subscription";

/**
 * OUVRIR UN ACCÈS À LA MAIN, QUAND LA BOUTIQUE N'A RIEN DIT.
 *
 * ── POURQUOI CET OUTIL EXISTE ─────────────────────────────────────────────
 *
 * Chariow a encaissé 358 ventes ; 354 abonnements ont été créés. Quatre
 * personnes ont donc payé sans jamais recevoir leur accès — dont deux le
 * 13 août. La boutique a fermé le 27 août : ces ventes ne sont plus
 * consultables nulle part, et aucune réconciliation automatique ne peut les
 * retrouver.
 *
 * Jusqu'ici, la seule façon de réparer était d'écrire à la main dans la base.
 * Un client qui montre son reçu et à qui l'on répond « je ne peux rien faire »
 * est un client perdu deux fois : il a payé, et il n'est pas cru.
 *
 * ── CE QUI EST ÉCRIT, ET POURQUOI DEUX FOIS ───────────────────────────────
 *
 * L'abonnement, pour que l'accès s'ouvre. Et une trace dans `webhook_events`,
 * qui porte QUI a ouvert, POUR QUI, et POURQUOI. Un accès offert sans motif
 * enregistré devient, trois mois plus tard, un abonnement dont personne ne
 * sait s'il a été payé — et la caisse cesse d'être vérifiable.
 *
 * Le montant inscrit est zéro, jamais le prix de l'offre : cet accès n'a rien
 * encaissé. L'y compter gonflerait les recettes du mois et, avec elles, la
 * part due aux partenaires — on paierait quelqu'un sur de l'argent qui n'est
 * jamais entré.
 */

/** Le verrou, identique à celui des autres actions d'administration. */
async function administrateur(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return estAdmin(user?.email) ? String(user?.email ?? "") : null;
}

export interface RetourOuverture {
  ok: boolean;
  message: string;
}

/** Les offres proposées, telles qu'elles s'appellent pour un humain. */
export async function offresOuvrables(): Promise<
  { cle: PlanKey; libelle: string; jours: number }[]
> {
  return (Object.keys(PLANS) as PlanKey[]).map((cle) => ({
    cle,
    libelle: PLANS[cle].label,
    jours: PLANS[cle].durationDays,
  }));
}

/**
 * Ouvre un accès pour un compte, sans encaissement.
 *
 * `jours` permet de coller au cas réel : trente jours pour une mensualité
 * perdue, mais aussi le reliquat d'un abonnement entamé, ou un geste
 * commercial de quelques jours.
 */
export async function ouvrirAccesManuel(
  userId: string,
  plan: PlanKey,
  jours: number,
  motif: string
): Promise<RetourOuverture> {
  const par = await administrateur();
  if (!par) return { ok: false, message: "Action réservée à l'administration." };

  if (!PLANS[plan]) return { ok: false, message: "Offre inconnue." };

  const duree = Math.round(Number(jours));
  if (!Number.isFinite(duree) || duree < 1 || duree > 400) {
    return { ok: false, message: "La durée doit être comprise entre 1 et 400 jours." };
  }

  // ── LE MOTIF EST OBLIGATOIRE ────────────────────────────────────────────
  //
  // C'est la seule chose qui, dans six mois, distinguera un accès réparé d'un
  // accès offert par erreur. Le rendre facultatif reviendrait à ne jamais
  // l'écrire.
  const raison = String(motif ?? "").trim().slice(0, 300);
  if (raison.length < 5) {
    return { ok: false, message: "Indiquez pourquoi cet accès est ouvert (au moins quelques mots)." };
  }

  const sb = createAdminClient();

  const { data: compte } = await sb.auth.admin.getUserById(userId);
  if (!compte?.user) return { ok: false, message: "Ce compte n'existe pas." };

  const maintenant = new Date();
  const fin = new Date(maintenant.getTime() + duree * 24 * 3600 * 1000);

  // ── ON PROLONGE, ON N'ÉCRASE PAS ────────────────────────────────────────
  //
  // Quelqu'un qui a déjà un accès valide et à qui l'on en ouvre un autre ne
  // doit pas y perdre les jours qui lui restaient.
  const { data: existants } = await sb
    .from("subscriptions")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("status", "active");

  const finLaPlusLoin = (existants ?? [])
    .map((a) => a.expires_at)
    .filter(Boolean)
    .sort()
    .pop();
  if (finLaPlusLoin && new Date(finLaPlusLoin) > fin) {
    return {
      ok: false,
      message: `Ce compte a déjà un accès jusqu'au ${String(finLaPlusLoin).slice(0, 10)} — plus long que celui-ci.`,
    };
  }

  const reference = `manuel-${maintenant.toISOString().slice(0, 19).replace(/[:T-]/g, "")}-${Math.round(
    maintenant.getTime() % 100000
  )}`;

  const { error } = await sb.from("subscriptions").insert({
    user_id: userId,
    plan,
    status: "active",
    amount: 0,
    currency: "XOF",
    provider: "manuel",
    chariow_sale_id: reference,
    expires_at: fin.toISOString(),
  });

  if (error) {
    console.error("[ACCES MANUEL] Écriture refusée :", error.message);
    return { ok: false, message: `L'accès n'a pas pu être ouvert : ${error.message}` };
  }

  // La trace vit ailleurs que l'abonnement, et elle survit à sa suppression.
  await sb
    .from("webhook_events")
    .insert({
      provider: "manuel",
      delivery_id: reference,
      event: "acces_ouvert_a_la_main",
      payload: {
        par,
        pour: compte.user.email,
        user_id: userId,
        plan,
        jours: duree,
        expire_le: fin.toISOString(),
        motif: raison,
      },
    })
    .then(({ error: e }) => {
      // Une trace manquante ne doit pas priver quelqu'un de son accès : il est
      // déjà ouvert. On le signale, on ne revient pas en arrière.
      if (e) console.warn("[ACCES MANUEL] Trace non écrite :", e.message);
    });

  console.log(
    `[ACCES MANUEL] ${par} a ouvert ${plan} (${duree} j) pour ${compte.user.email} — ${raison}`
  );

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");

  return {
    ok: true,
    message: `Accès ${PLANS[plan].label} ouvert jusqu'au ${fin.toISOString().slice(0, 10)}.`,
  };
}

/**
 * LIVRER MAINTENANT, SANS ATTENDRE L'ENTRETIEN DE LA NUIT.
 *
 * ── POURQUOI CETTE PORTE MANUELLE EXISTE ──────────────────────────────────
 *
 * L'entretien quotidien ne repasse qu'une fois par vingt heures. Quelqu'un qui
 * paie à 18 h 46 sans avoir de compte attendrait donc le lendemain matin — et
 * c'est exactement ce qui s'est produit le 29 août 2026, deux fois de suite.
 *
 * Une alerte arrive pourtant dans la boîte de l'administrateur à la seconde où
 * la vente tombe, et elle dit « il faut agir maintenant ». Il fallait un
 * endroit où agir maintenant.
 *
 * ── POURQUOI ELLE NE PEUT PAS FAIRE DE DÉGÂTS ─────────────────────────────
 *
 * Elle appelle exactement la même fonction que l'entretien. Chaque vente
 * livrée laisse sa trace, et une vente déjà livrée est sautée : cliquer dix
 * fois de suite ne crée pas dix comptes, n'ouvre pas dix abonnements, et
 * n'envoie pas dix courriels.
 */
export async function livrerVentesSansCompteMaintenant(): Promise<string> {
  const par = await administrateur();
  if (!par) return "Action réservée à l'administration.";

  const { livrerVentesSansCompte } = await import('@/lib/livraison-sans-compte');
  const r = await livrerVentesSansCompte();

  revalidatePath('/admin/logs');
  revalidatePath('/admin/users');

  if (!r.examinees) return 'Aucune vente en attente : tout le monde a son accès.';

  const lignes = [
    `${r.livrees} accès ouvert(s) et ${r.invitations} invitation(s) sur ${r.examinees} vente(s) examinée(s).`,
    r.dejaLivrees ? `${r.dejaLivrees} déjà livrée(s) auparavant.` : '',
    r.comptesExistants ? `${r.comptesExistants} avai(en)t déjà un compte.` : '',
    r.echecs ? `${r.echecs} échec(s).` : '',
    ...r.details,
  ].filter(Boolean);

  console.log(`[LIVRAISON] Déclenchée à la main par ${par} : ${r.livrees} livraison(s).`);
  return lignes.join('\n');
}
