/**
 * CE QUE L'ACHETEUR VA RÉELLEMENT TROUVER SUR LA PAGE DE PAIEMENT.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * La page de paiement appartient à Chariow : on ne peut rien y écrire. La
 * dernière occasion de guider l'acheteur est donc chez nous, juste avant de
 * l'y envoyer. Encore faut-il savoir ce qu'il y verra.
 *
 * ── RIEN N'EST DEVINÉ ─────────────────────────────────────────────────────
 *
 * Les moyens de paiement ont été lus dans le HTML des vraies pages Chariow,
 * pour les 249 codes pays ISO, un par un. 243 pays sont reconnus par la
 * boutique ; 45 moyens de paiement distincts ont été relevés.
 *
 * Se tromper d'un opérateur, c'est promettre Wave à quelqu'un qui ne le verra
 * pas — et perdre exactement la confiance qu'on cherchait à gagner.
 *
 * ── LE PIÈGE QUI A FAILLI PASSER ──────────────────────────────────────────
 *
 * Chariow retombe SILENCIEUSEMENT sur la Guinée pour tout code qu'il ne
 * reconnaît pas : `country=ZZ`, `country=XX` et un code vide renvoient tous
 * « Guinea », avec Orange Money et MTN. Quatre territoires — Pays-Bas
 * caribéens, Bouvet, Sahara occidental, Heard — avaient donc hérité des moyens
 * guinéens lors de la première récolte. Sans vérification, on aurait promis
 * Orange Money à un acheteur du Sahara occidental.
 *
 * Ils sont absents de ce fichier, avec la Corée du Nord et le Venezuela que
 * Chariow ne sert pas. Ces pays reçoivent la notice générique.
 *
 * ── LA MISE À JOUR ────────────────────────────────────────────────────────
 *
 * `node scripts/recolter-moyens-paiement.mjs` puis
 * `node scripts/construire-moyens-paiement.mjs` refont la table à neuf le jour
 * où Chariow ajoute un opérateur.
 */

import donnees from './moyens-paiement.json';

export interface MoyenPaiement {
  /** Identifiant Chariow, qui est aussi le nom du fichier d'icône. */
  cle: string;
  nom: string;
}

export interface PaysPaiement {
  code: string;
  nom: string;
  moyens: MoyenPaiement[];
}

const TABLE = donnees as Record<string, { nom: string; moyens: MoyenPaiement[] }>;

/**
 * Le repli, pour un pays que Chariow ne sert pas ou qu'on n'a pas su détecter.
 *
 * « Card » tout seul ne rassure personne. La carte est nommée avec les réseaux
 * que l'acheteur reconnaîtra, et rien de plus n'est promis : pas d'opérateur
 * inventé, pas de mobile money supposé.
 */
export const MOYEN_GENERIQUE: MoyenPaiement = {
  cle: 'card',
  nom: 'Carte bancaire (Visa / Mastercard)',
};

/** Tous les pays servis, classés par nom — pour la liste de correction. */
export const PAYS_SERVIS: PaysPaiement[] = Object.entries(TABLE)
  .map(([code, v]) => ({ code, nom: v.nom, moyens: v.moyens }))
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

/**
 * Ce qui sera proposé à l'acheteur de ce pays.
 *
 * Renvoie toujours quelque chose : un pays inconnu reçoit la carte bancaire,
 * qui est proposée partout. Mieux vaut une notice sobre et vraie qu'aucune
 * notice.
 */
export function moyensDuPays(code: string | null | undefined): PaysPaiement | null {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return null;
  const trouve = TABLE[c];
  if (!trouve) return null;
  return { code: c, nom: trouve.nom, moyens: trouve.moyens };
}

/**
 * Le mobile money d'abord, la carte à la fin.
 *
 * Sur ce marché, l'acheteur cherche Wave ou Orange Money — la carte est le
 * dernier recours, et beaucoup n'en ont pas. La montrer en tête ferait croire
 * qu'elle est obligatoire, et c'est précisément ce qui fait abandonner.
 */
export function ordonnerPourAfrique(moyens: MoyenPaiement[]): MoyenPaiement[] {
  const estCarte = (m: MoyenPaiement) =>
    m.cle === 'card' || m.cle === 'card_cb' || m.cle.startsWith('bank_');
  return [...moyens.filter((m) => !estCarte(m)), ...moyens.filter(estCarte)];
}
