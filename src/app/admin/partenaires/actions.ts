"use server";

import { refresh, revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { estAdmin, estFondateur } from "@/lib/admins";
import {
  inscrireDepense,
  retirerDepense,
  lireTauxUsdXof,
  definirTauxUsdXof,
  type Fournisseur,
} from "@/lib/depenses";
import { poulsMaketou } from "@/lib/recettes-boutique";


/**
 * Double verrou, identique à celui du gabarit d'administration.
 *
 * Une action serveur est un point d'entrée à part entière : elle ne traverse
 * pas le gabarit et n'hérite donc d'aucune de ses protections. Sans ce
 * contrôle, n'importe quel compte connecté pourrait écrire dans les données
 * commerciales en appelant l'action directement — ici, s'attribuer une part du
 * chiffre d'affaires.
 */
async function verifierAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Comparaison insensible a la casse : une majuscule a l inscription ne
  // doit pas fermer la porte a quelqu un d autorise.
  if (!estAdmin(user?.email)) return false;

  // LE VERROU PAR LIEN PERSONNEL A ÉTÉ RETIRÉ le 16/08/2026, sur demande.
  //
  // Il exigeait, en plus du compte, un cookie déposé par un lien secret
  // (/a/<clé>). Il protégeait contre une session volée : la voler ne suffisait
  // pas, il fallait aussi connaître le lien. Il rendait en revanche l'arrivée
  // d'un nouvel administrateur incompréhensible — connecté, autorisé, et
  // pourtant renvoyé vers l'accueil sans un mot d'explication.
  //
  // Le contrôle du compte ci-dessus reste entier : il est désormais seul.
  // Pour le rétablir, remettre ici la vérification du cookie et renseigner
  // ADMIN_ACCESS_KEY ; le module admin-access et la route /a/<clé> sont
  // conservés intacts à cette fin.
  return true;
}

/**
 * Règle la part du chiffre d'affaires d'un partenaire.
 *
 * Le pourcentage se modifie ici et nulle part ailleurs : c'est le seul chiffre
 * qui décide de ce qu'on doit à quelqu'un. Écrit en dur dans le code, il aurait
 * demandé un déploiement à chaque renégociation.
 */
export async function reglerPartCa(formData: FormData) {
  if (!(await verifierAdmin())) {
    return { ok: false, message: "Accès refusé." };
  }

  const partnerId = String(formData.get("partner_id") ?? "");
  const part = Number(formData.get("part_ca_pct"));
  const depuis = String(formData.get("remuneration_depuis") ?? "").trim() || null;

  if (!partnerId) return { ok: false, message: "Partenaire inconnu." };

  // Cent pour cent est déjà la limite du raisonnable : au-delà, le projet
  // reverserait plus qu'il n'encaisse. Un zéro reste permis — il suspend la
  // rémunération sans effacer le partenaire.
  if (!Number.isFinite(part) || part < 0 || part > 100) {
    return { ok: false, message: "La part doit être comprise entre 0 et 100 %." };
  }
  if (depuis && isNaN(new Date(depuis).getTime())) {
    return { ok: false, message: "Date de départ invalide." };
  }

  const { error } = await createAdminClient()
    .from("partners")
    .update({ part_ca_pct: part, remuneration_depuis: depuis })
    .eq("id", partnerId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/partenaires");
  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin");
  return { ok: true, message: `Part réglée à ${part} % du chiffre d'affaires mensuel.` };
}

/**
 * Marque le forfait d'un partenaire comme versé.
 *
 * Hérité des anciens contrats à forfait. Conservé parce que ces montants ont
 * réellement été engagés et doivent continuer d'apparaître au bilan : les
 * effacer ferait mentir l'historique.
 */
export async function marquerVerse(formData: FormData) {
  if (!(await verifierAdmin())) {
    return { ok: false, message: "Accès refusé." };
  }

  const partnerId = String(formData.get("partner_id") ?? "");
  const verse = String(formData.get("paid") ?? "") === "true";
  if (!partnerId) return { ok: false, message: "Partenaire inconnu." };

  const { error } = await createAdminClient()
    .from("partners")
    .update({ paid: verse, paid_at: verse ? new Date().toISOString() : null })
    .eq("id", partnerId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/partenaires");
  revalidatePath(`/admin/partenaires/${partnerId}`);
  return { ok: true, message: verse ? "Forfait marqué comme versé." : "Versement annulé." };
}

/**
 * LA BOUTIQUE, EN DIRECT.
 *
 * ── POURQUOI CETTE ACTION EXISTE ──────────────────────────────────────────
 *
 * Les ventes arrivent pendant qu'on regarde la page. Le 28 août 2026, deux
 * sont tombées entre une capture d'écran et la vérification faite dessus —
 * un VIP à 21 h 11, un Pro à 21 h 16 — et la page, rendue une fois pour
 * toutes, continuait d'afficher l'état d'avant. On croyait lire la caisse ;
 * on lisait une photographie.
 *
 * Ce n'est pas seulement gênant : c'est sur ces chiffres qu'on paie
 * quelqu'un. Un montant figé qui a l'air vivant est pire qu'un montant
 * manifestement daté.
 *
 * ── CE QU'ELLE FAIT, ET CE QU'ELLE ÉVITE DE FAIRE ─────────────────────────
 *
 * Elle ne renvoie AUCUNE donnée à l'écran. Elle relit deux nombres — combien
 * de ventes, pour combien — et les compare à ceux que la page affiche déjà.
 * Tant qu'ils sont identiques, elle ne fait rien du tout. Dès qu'ils
 * diffèrent, `refresh()` fait rejouer le rendu serveur et toute la page se
 * remet à jour d'elle-même, encadré du partage compris.
 *
 * Le calcul reste donc entièrement au serveur : rien de ce qui touche aux
 * acheteurs ne descend dans le navigateur pour être rafraîchi.
 *
 * ── LE VERROU EST LE MÊME QUE PARTOUT ─────────────────────────────────────
 *
 * Une action serveur est un point d'entrée à part entière. Sans le contrôle
 * d'administration, n'importe quel compte connecté pourrait interroger le
 * rythme des ventes en boucle. En cas de refus, elle rend la signature reçue :
 * pas d'erreur, pas d'indice, et aucune reconstruction déclenchée.
 */
export async function verifierPoulsBoutique(signatureVue: string): Promise<string> {
  if (!(await verifierAdmin())) return signatureVue;

  const { ventes, xof } = await poulsMaketou();
  const signature = `${ventes}:${xof}`;

  if (signature !== signatureVue) refresh();

  return signature;
}

/**
 * ── LA COMPTABILITÉ DES DÉPENSES : LE FONDATEUR ÉCRIT, L'AUTRE LIT ────────
 *
 * Demande du propriétaire, le 26 septembre 2026. Les dépenses se retirent du
 * chiffre d'affaires AVANT le partage : chaque ligne ajoutée diminue donc la
 * part du partenaire. Qui écrit ici décide de ce que l'autre touche.
 *
 * Le contrôle `verifierAdmin` ne suffit pas : le partenaire EST administrateur
 * (c'est le principe de ce partenariat, il voit tout). La garde est donc
 * `estFondateur` — et elle vit dans l'action elle-même, jamais seulement dans
 * la page : une action serveur est une adresse appelable directement.
 */
async function verifierFondateur(): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return estFondateur(user?.email);
}

/** Inscrit une dépense. Le montant est lu tel qu'il a été réglé, jamais estimé. */
export async function ajouterDepense(formData: FormData) {
  if (!(await verifierFondateur())) return;

  const jour = String(formData.get("jour") ?? "").slice(0, 10);
  const fournisseur = String(formData.get("fournisseur") ?? "autre") as Fournisseur;
  const libelle = String(formData.get("libelle") ?? "").trim().slice(0, 120);
  const montant = Number(formData.get("montant"));
  const devise = String(formData.get("devise") ?? "USD") as "USD" | "EUR" | "XOF";

  // Une date absente ou illisible imputerait la dépense au mauvais mois.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !Number.isFinite(montant) || montant <= 0) return;

  await inscrireDepense({
    jour,
    fournisseur,
    libelle: libelle || "dépense",
    montant,
    devise,
    taux: await lireTauxUsdXof(),
    recurrente: formData.get("recurrente") === "on",
    source: "saisie administration",
    reference: String(formData.get("reference") ?? "").trim() || null,
  });

  revalidatePath("/admin/partenaires");
  revalidatePath("/admin/partenaires/[id]", "page");
}

/** Retire une dépense inscrite par erreur, ou imputée au mauvais projet. */
export async function supprimerDepense(formData: FormData) {
  if (!(await verifierFondateur())) return;

  await retirerDepense(String(formData.get("cle") ?? ""));

  revalidatePath("/admin/partenaires");
  revalidatePath("/admin/partenaires/[id]", "page");
}

/**
 * Change le taux du dollar. Les dépenses déjà inscrites gardent le leur : une
 * comptabilité qui se réécrit quand le dollar bouge n'est pas une
 * comptabilité.
 */
export async function reglerTauxDollar(formData: FormData) {
  if (!(await verifierFondateur())) return;

  const taux = Number(formData.get("taux"));
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await definirTauxUsdXof(taux, String(user?.email ?? "fondateur"));

  revalidatePath("/admin/partenaires");
  revalidatePath("/admin/partenaires/[id]", "page");
}
