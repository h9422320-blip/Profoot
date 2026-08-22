/**
 * LE PAYS RETENU POUR CONSTRUIRE LE LIEN DE PAIEMENT.
 *
 * ── POURQUOI CE FICHIER EST SÉPARÉ DE `pays-acheteur.ts` ──────────────────
 *
 * `pays-acheteur.ts` est importé par des composants qui tournent dans le
 * navigateur — la page des tarifs y prend `fuseauDuNavigateur`. Tout ce qu'on
 * y ajoute part donc dans le téléphone de chaque visiteur.
 *
 * La table des moyens de paiement pèse quarante-huit kilo-octets et ne sert
 * qu'au serveur pour valider un code pays. La placer là-bas l'aurait envoyée à
 * tout le monde, y compris aux visiteurs qui n'achètent rien.
 *
 * Ce module-ci n'est appelé que par la route de paiement, côté serveur.
 *
 * ── POURQUOI UN CHOIX EXPLICITE PEUT PASSER DEVANT L'ADRESSE IP ───────────
 *
 * La détection par IP se trompe dans des cas réels : un Ivoirien en voyage, un
 * réseau d'entreprise qui sort par un autre pays, un opérateur mobile qui
 * route par l'Europe. La personne voit alors Apple Pay là où elle attendait
 * Wave, et elle abandonne — alors qu'elle sait parfaitement où elle est.
 *
 * La notice affichée avant la redirection lui permet de corriger. Ce choix
 * n'aurait aucun intérêt s'il ne changeait pas la page suivante.
 *
 * ── CE QUI EST ACCEPTÉ, ET SEULEMENT CELA ────────────────────────────────
 *
 * Deux lettres, et un pays que la boutique sert réellement. Une valeur venue
 * du navigateur ne mérite pas confiance : sans ce filtre, une chaîne fantaisie
 * partirait telle quelle chez Chariow, qui retombe silencieusement sur la
 * Guinée pour tout code inconnu — l'acheteur se verrait proposer Orange Money
 * Guinée où qu'il soit.
 *
 * Sans choix valable, on retombe EXACTEMENT sur le comportement d'avant.
 */

import { detecterPaysAcheteur, type PaysDetecte } from './pays-acheteur';
import { moyensDuPays } from './moyens-paiement';

export function paysRetenu(
  entetes: Headers,
  fuseauClient?: unknown,
  choixExplicite?: unknown
): PaysDetecte {
  const choix = String(choixExplicite ?? '').trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(choix) && moyensDuPays(choix)) {
    return { code: choix, source: 'choix' };
  }

  return detecterPaysAcheteur(entetes, fuseauClient);
}
