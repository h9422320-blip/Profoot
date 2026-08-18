/**
 * Dans quelle monnaie facturer un acheteur.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 18 août 2026, un acheteur à Paris se voyait facturer « F CFA 2 000 ».
 * Constaté en créant de vraies sessions de paiement avec une adresse française
 * puis marocaine : le montant restait en franc CFA dans les deux cas, parce que
 * notre demande à Chariow n'a jamais transmis de devise.
 *
 * Ce que ça coûte : un montant dans une monnaie inconnue, sur une boutique
 * ouest-africaine, fait renoncer — et certaines banques européennes refusent
 * d'emblée un débit en XOF. Sur la même période, la conversion est de 14 % dans
 * la zone franc et de 9 % en dehors, Maroc et Algérie à zéro.
 *
 * CE QUI NE DOIT SURTOUT PAS CASSER
 *
 * Les pays qui paient DÉJÀ, et qui paient en franc CFA. La liste ci-dessous
 * part donc des pays réellement observés dans les ventes — Côte d'Ivoire,
 * Guinée, Bénin, Togo, RD Congo, Burkina, Cameroun, Congo, Sénégal — étendue à
 * toute la zone franc et à ses voisins de mobile money. Pour eux, rien ne
 * change : la devise reste celle du produit.
 *
 * Le reste du monde reçoit une monnaie qu'il reconnaît.
 */

export type DeviseAcheteur = 'XOF' | 'EUR' | 'USD';

/**
 * Pays où le mobile money en franc CFA fonctionne déjà.
 *
 * Toucher à cette liste, c'est risquer de casser les ventes qui marchent.
 * UEMOA et CEMAC au complet, plus les voisins où des paiements ont réellement
 * abouti.
 */
const ZONE_FRANC_ET_MOBILE_MONEY = new Set([
  // UEMOA
  'BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG',
  // CEMAC
  'CM', 'CF', 'TD', 'CG', 'GQ', 'GA',
  // Voisins où des ventes ont abouti ou où le mobile money domine
  'GN', 'CD', 'MR', 'NG', 'GH', 'SL', 'LR', 'GM',
]);

/**
 * Europe et Maghreb : l'euro y est compris de tous, y compris là où il n'est
 * pas la monnaie officielle. Un Marocain lit « 3,05 € » sans hésiter ; il ne
 * sait pas ce que vaut un franc CFA.
 */
const ZONE_EURO = new Set([
  // Union européenne
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK',
  // Reste de l'Europe
  'CH', 'GB', 'NO', 'IS', 'AL', 'BA', 'MK', 'ME', 'RS', 'MD', 'UA', 'XK',
  // Maghreb
  'MA', 'DZ', 'TN', 'LY',
]);

/**
 * La monnaie à facturer.
 *
 * Sans pays connu, on garde le franc CFA : c'est la monnaie du produit et celle
 * de l'immense majorité des acheteurs. Deviner l'euro sur un pays inconnu
 * risquerait de dérouter un acheteur ivoirien dont la géolocalisation a échoué.
 */
export function deviseDuPays(pays: string | null | undefined): DeviseAcheteur {
  const code = String(pays ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return 'XOF';
  if (ZONE_FRANC_ET_MOBILE_MONEY.has(code)) return 'XOF';
  if (ZONE_EURO.has(code)) return 'EUR';
  return 'USD';
}
