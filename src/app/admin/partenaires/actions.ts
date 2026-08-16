"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { COOKIE_ADMIN, cleAdminAttendue, cleValide } from "@/lib/admin-access";

const ADMIN_EMAIL = "h9422320@gmail.com";

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
  if (!user || user.email !== ADMIN_EMAIL) return false;

  const attendue = cleAdminAttendue();
  if (attendue) {
    const jeton = (await cookies()).get(COOKIE_ADMIN)?.value;
    if (!cleValide(jeton, attendue)) return false;
  }
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
