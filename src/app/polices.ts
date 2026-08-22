/**
 * LES POLICES, SERVIES DEPUIS NOTRE PROPRE DOMAINE.
 *
 * ── CE QUE ÇA REMPLACE, ET CE QUE ÇA COÛTAIT ──────────────────────────────
 *
 * Les polices étaient demandées à Google, de DEUX endroits à la fois :
 *
 *   • une balise `<link>` dans le gabarit racine — Inter, Space Grotesk,
 *     Outfit, avec toutes leurs graisses et l'italique ;
 *   • un `@import` en tête de `globals.css` — Inter à nouveau, plus Sora.
 *
 * Mesuré le 22 août 2026 sur la vraie page : 73 fichiers référencés, 2,6 Mo au
 * total, dont 741 Ko réellement téléchargés par un visiteur francophone, plus
 * 26 Ko de feuille de style bloquante. Sur une 3G ouest-africaine à 400 kbit/s,
 * quinze secondes rien que pour les polices.
 *
 * Le `@import` était le pire des deux : le navigateur ne le découvre qu'après
 * avoir reçu et analysé le CSS. C'est un aller-retour de plus, en série, avant
 * le moindre pixel.
 *
 * ── POURQUOI C'EST BEAUCOUP PLUS LÉGER MAINTENANT ─────────────────────────
 *
 *   • UN SEUL DOMAINE. Les fichiers partent de profootai.com, avec le reste.
 *     Plus de résolution DNS ni de poignée de main TLS vers fonts.gstatic.com
 *     — sur un réseau mobile lent, cette seule économie vaut une demi-seconde.
 *   • LE SOUS-ENSEMBLE LATIN SEUL. Google servait aussi le cyrillique, le grec
 *     et le vietnamien, que personne ici ne lit.
 *   • PAS D'AXE VARIABLE INUTILE. Inter était demandé avec l'axe `opsz 14..32`,
 *     qui embarque toutes les tailles optiques dans chaque fichier. Des graisses
 *     fixes suffisent : rien à l'écran ne les distingue.
 *   • LE CSS EST INTÉGRÉ À LA PAGE. Plus de feuille externe à aller chercher
 *     avant de pouvoir afficher quoi que ce soit.
 *
 * ── L'APPARENCE NE CHANGE PAS ─────────────────────────────────────────────
 *
 * Mêmes familles, mêmes graisses que celles réellement employées dans le code.
 * `display: 'swap'` conserve le comportement d'avant : le texte s'affiche
 * immédiatement dans une police de secours, puis bascule.
 *
 * Chaque famille expose une variable CSS. Les styles en ligne du code les
 * utilisent par leur nom de variable — un nom littéral comme « Space Grotesk »
 * ne fonctionnerait plus, puisque le fichier est désormais servi sous un nom
 * généré.
 */

import { Inter, Space_Grotesk, Outfit, Sora } from 'next/font/google';

/** Police du texte courant. */
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--police-texte',
  display: 'swap',
});

/**
 * Police des titres et des chiffres mis en avant.
 *
 * Space Grotesk s'arrête à 700. Les éléments marqués `font-black` s'affichaient
 * déjà en 700 auparavant : rien ne change.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--police-titre',
  display: 'swap',
});

/**
 * Police de la marque, employée dans quatre endroits seulement — le logo de la
 * barre latérale et deux titres de la page Expert — et toujours en 900.
 */
export const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--police-marque',
  display: 'swap',
});

/** Police des titres définie dans la feuille de style globale. */
export const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--police-entete',
  display: 'swap',
});

/** À poser sur `<html>` : rend les quatre variables disponibles partout. */
export const classesPolices = [
  inter.variable,
  spaceGrotesk.variable,
  outfit.variable,
  sora.variable,
].join(' ');
