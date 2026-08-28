"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * L'ÉQUIPE DE CŒUR, ET RIEN D'AUTRE.
 *
 * ── CE QUE CETTE DONNÉE NE FAIT PAS ───────────────────────────────────────
 *
 * Elle ne filtre rien, ne présélectionne rien, n'ouvre aucun accès et ne
 * change aucun calcul. Aucun autre module de l'application ne la lit — c'est
 * volontaire, et c'est vérifié par un test. Quelqu'un qui aime le Real Madrid
 * doit pouvoir analyser Guingamp contre Le Havre sans qu'on lui suggère autre
 * chose.
 *
 * ── POURQUOI DANS LES MÉTADONNÉES DU COMPTE ───────────────────────────────
 *
 * C'est déjà là que vit le profil de cette application : `full_name` posé à
 * l'inscription, `avatar_url`, `message_personnel`, `pays`. Il n'existe aucune
 * table `profiles`. En créer une pour deux champs décoratifs demanderait une
 * migration, une politique d'accès et une jointure de plus sur chaque page,
 * pour une donnée qui ne décide de rien.
 *
 * Conséquence assumée : ces deux champs sont modifiables par la personne
 * elle-même, comme son nom. Ce serait inacceptable pour un droit d'accès ; ça
 * ne l'est pas pour un club de cœur, qui ne donne rien à qui le change.
 *
 * ── L'INDICATEUR EST POSÉ DANS LES DEUX CAS ───────────────────────────────
 *
 * Choisir ou passer mènent au même endroit : `equipe_preferee_faite` à vrai.
 * Sans cela, la personne qui passe se verrait reposer la question à chaque
 * visite — c'est-à-dire punie d'avoir décliné.
 */

/** Le club retenu, tel qu'il sera conservé. */
export interface EquipePreferee {
  id: string;
  nom: string;
  logo: string | null;
  championnat: string | null;
}

/** Résultat rendu au navigateur : jamais d'exception qui remonte à l'écran. */
export interface Retour {
  ok: boolean;
}

/** Adresse d'écusson acceptée. Une autre origine n'est pas conservée. */
const ORIGINE_ECUSSONS = "https://media.api-sports.io/";

function texteCourt(valeur: unknown, taille: number): string {
  return String(valeur ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, taille);
}

/**
 * Remet en forme ce que le navigateur envoie.
 *
 * Le contenu vient d'un composant client : il est traité comme une saisie, pas
 * comme une donnée de confiance. Bornes de longueur, et une adresse d'image
 * retenue seulement si elle pointe vers l'hébergeur des écussons — un champ
 * libre qui accepte n'importe quelle URL finit toujours par en afficher une
 * qu'on n'avait pas prévue.
 */
function assainir(equipe: EquipePreferee | null): EquipePreferee | null {
  if (!equipe) return null;

  const id = texteCourt(equipe.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
  const nom = texteCourt(equipe.nom, 80);
  if (!id || !nom) return null;

  const logo = texteCourt(equipe.logo, 300);
  const championnat = texteCourt(equipe.championnat, 40).replace(/[^a-zA-Z0-9_-]/g, "");

  return {
    id,
    nom,
    logo: logo.startsWith(ORIGINE_ECUSSONS) ? logo : null,
    championnat: championnat || null,
  };
}

/**
 * Conserve l'équipe préférée et referme l'étape d'accueil.
 *
 * `equipe` à `null` correspond au bouton « Passer » : l'étape est close, aucun
 * club n'est retenu.
 */
export async function enregistrerEquipePreferee(
  equipe: EquipePreferee | null
): Promise<Retour> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const retenue = assainir(equipe);

  // `data` est FUSIONNÉ dans les métadonnées existantes, il ne les remplace
  // pas : c'est ainsi que la page de réglages modifie `full_name` sans effacer
  // l'avatar. Écrire ici ne fait donc perdre ni le nom, ni le pays, ni le
  // message personnel.
  const { error } = await supabase.auth.updateUser({
    data: {
      equipe_preferee: retenue,
      equipe_preferee_faite: true,
    },
  });

  if (error) {
    // Une étape décorative ne doit jamais empêcher quelqu'un d'entrer dans
    // l'application. On journalise, l'écran se referme quand même.
    console.warn("[ACCUEIL] Équipe préférée non conservée :", error.message);
    return { ok: false };
  }

  return { ok: true };
}
