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
 * commerciales en appelant l'action directement.
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
 * Saisie d'un relevé hebdomadaire de vues.
 *
 * Les réseaux sociaux ne permettent pas de lire ces chiffres automatiquement
 * sans une intégration par plateforme et une autorisation de l'influenceur. Le
 * relevé est donc saisi à la main, chaque lundi, comme convenu avec le
 * partenaire.
 */
export async function enregistrerReleve(formData: FormData) {
  if (!(await verifierAdmin())) {
    return { ok: false, message: "Accès refusé." };
  }

  const partnerId = String(formData.get("partner_id") ?? "");
  const debut = String(formData.get("period_start") ?? "");
  const fin = String(formData.get("period_end") ?? "");
  const vues = Number(formData.get("views") ?? 0);
  const publications = Number(formData.get("posts") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!partnerId || !debut || !fin) {
    return { ok: false, message: "Période incomplète." };
  }
  if (new Date(fin) < new Date(debut)) {
    return { ok: false, message: "La fin de période précède son début." };
  }

  const sb = createAdminClient();
  // `upsert` sur (partenaire, début de période) : ressaisir une semaine déjà
  // enregistrée la corrige au lieu de la compter deux fois.
  const { error } = await sb.from("partner_reports").upsert(
    {
      partner_id: partnerId,
      period_start: debut,
      period_end: fin,
      views: Number.isFinite(vues) ? Math.max(0, Math.round(vues)) : 0,
      posts: Number.isFinite(publications) ? Math.max(0, Math.round(publications)) : 0,
      notes,
    },
    { onConflict: "partner_id,period_start" }
  );

  if (error) {
    console.error("[PARTENAIRES] Relevé non enregistré :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
  return { ok: true, message: "Relevé enregistré." };
}

/** Supprime un relevé saisi par erreur. */
export async function supprimerReleve(formData: FormData) {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès refusé." };

  const releveId = String(formData.get("releve_id") ?? "");
  const partnerId = String(formData.get("partner_id") ?? "");
  if (!releveId) return { ok: false, message: "Relevé inconnu." };

  const sb = createAdminClient();
  const { error } = await sb.from("partner_reports").delete().eq("id", releveId);

  if (error) {
    console.error("[PARTENAIRES] Suppression impossible :", error.message);
    return { ok: false, message: "Suppression impossible." };
  }

  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
  return { ok: true, message: "Relevé supprimé." };
}

/**
 * Modifie un relevé existant, identifié par son identifiant.
 *
 * Distinct de l'enregistrement : celui-ci reconnaît une semaine à sa date de
 * début, ce qui ne permet pas de corriger la période elle-même. Ici l'on sait
 * exactement quelle ligne modifier, y compris ses dates.
 */
export async function modifierReleve(formData: FormData) {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès refusé." };

  const releveId = String(formData.get("releve_id") ?? "");
  const partnerId = String(formData.get("partner_id") ?? "");
  const debut = String(formData.get("period_start") ?? "");
  const fin = String(formData.get("period_end") ?? "");
  const vues = Number(formData.get("views") ?? 0);
  const publications = Number(formData.get("posts") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!releveId || !debut || !fin) return { ok: false, message: "Période incomplète." };
  if (new Date(fin) < new Date(debut)) {
    return { ok: false, message: "La fin de période précède son début." };
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from("partner_reports")
    .update({
      period_start: debut,
      period_end: fin,
      views: Number.isFinite(vues) ? Math.max(0, Math.round(vues)) : 0,
      posts: Number.isFinite(publications) ? Math.max(0, Math.round(publications)) : 0,
      notes,
    })
    .eq("id", releveId);

  if (error) {
    console.error("[PARTENAIRES] Modification impossible :", error.message);
    return { ok: false, message: "Modification impossible." };
  }

  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
  return { ok: true, message: "Relevé modifié." };
}

/** Marque le versement comme effectué, à la date du jour. */
export async function marquerVerse(formData: FormData) {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès refusé." };

  const partnerId = String(formData.get("partner_id") ?? "");
  if (!partnerId) return { ok: false, message: "Partenaire inconnu." };

  const sb = createAdminClient();
  const { error } = await sb
    .from("partners")
    .update({ paid: true, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", partnerId);

  if (error) {
    console.error("[PARTENAIRES] Versement non enregistré :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  revalidatePath(`/admin/partenaires/${partnerId}`);
  revalidatePath("/admin/partenaires");
  return { ok: true, message: "Versement enregistré." };
}
