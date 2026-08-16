"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { estAdmin } from "@/lib/admins";

const TAILLE_MAX = 5 * 1024 * 1024;
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Double verrou, identique au reste de l'administration.
 *
 * Une action serveur est un point d'entrée à part entière. Sans ce contrôle,
 * n'importe quel compte connecté pourrait publier une image et un texte sur la
 * page d'accueil du site.
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

function rafraichir() {
  // La page d'accueil est régénérée par intervalles : sans cet appel, une photo
  // remplacée mettrait cinq minutes à apparaître.
  revalidatePath("/");
  revalidatePath("/admin/ambassadeurs");
}

/** Crée ou met à jour un ambassadeur, photo comprise. */
export async function enregistrerAmbassadeur(formData: FormData) {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès refusé." };

  const id = String(formData.get("id") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || "Ambassadeur ProFoot";
  const citation = String(formData.get("citation") ?? "").trim();
  const actif = formData.get("actif") === "on";
  const ordre = Number(formData.get("ordre") ?? 0);
  const photo = formData.get("photo") as File | null;

  if (!nom) return { ok: false, message: "Le nom est obligatoire." };
  if (!citation) return { ok: false, message: "La citation est obligatoire." };

  const sb = createAdminClient();
  let photoUrl: string | null = null;

  if (photo && photo.size > 0) {
    // Le type est contrôlé ici et pas seulement dans le formulaire : l'attribut
    // `accept` du navigateur est un confort, pas une sécurité.
    if (!TYPES_ACCEPTES.includes(photo.type))
      return { ok: false, message: "La photo doit être au format JPG, PNG ou WEBP." };
    if (photo.size > TAILLE_MAX)
      return { ok: false, message: "La photo dépasse 5 Mo. Réduisez-la avant de l'envoyer." };

    // Un nom de fichier unique à chaque envoi : réutiliser le même laisserait
    // l'ancienne image dans les caches des navigateurs et des serveurs, et la
    // nouvelle photo ne se verrait pas.
    const extension = photo.type.split("/")[1].replace("jpeg", "jpg");
    const chemin = `${Date.now()}-${nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`;

    const { error } = await sb.storage
      .from("ambassadeurs")
      .upload(chemin, await photo.arrayBuffer(), { contentType: photo.type, upsert: false });

    if (error) return { ok: false, message: `Envoi de la photo impossible : ${error.message}` };

    photoUrl = sb.storage.from("ambassadeurs").getPublicUrl(chemin).data.publicUrl;
  }

  const champs: Record<string, unknown> = { nom, role, citation, actif, ordre };
  // Sans nouvelle photo, on garde l'ancienne : modifier une citation ne doit
  // pas effacer le portrait.
  if (photoUrl) champs.photo_url = photoUrl;

  const { error } = id
    ? await sb.from("ambassadeurs").update(champs).eq("id", id)
    : await sb.from("ambassadeurs").insert(champs);

  if (error) return { ok: false, message: error.message };

  rafraichir();
  return { ok: true, message: id ? "Ambassadeur mis à jour." : "Ambassadeur ajouté." };
}

/**
 * Retire un ambassadeur de la page d'accueil sans le supprimer.
 *
 * La ligne et la photo restent : un ambassadeur masqué se remet d'un clic, et
 * on ne perd ni son texte ni son portrait sur une fausse manœuvre.
 */
export async function basculerAmbassadeur(formData: FormData) {
  if (!(await verifierAdmin())) return { ok: false, message: "Accès refusé." };

  const id = String(formData.get("id") ?? "");
  const actif = String(formData.get("actif") ?? "") === "true";
  if (!id) return { ok: false, message: "Ambassadeur inconnu." };

  const { error } = await createAdminClient()
    .from("ambassadeurs")
    .update({ actif })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  rafraichir();
  return { ok: true, message: actif ? "Affiché sur la page d'accueil." : "Masqué de la page d'accueil." };
}
