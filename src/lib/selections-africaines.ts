/**
 * LES SÉLECTIONS AFRICAINES : LEUR NOM, LEUR IDENTIFIANT, LEUR PUBLIC.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Du 21 septembre au 9 octobre 2026, les grands championnats d'Europe ne
 * jouent pas. Pendant ce temps, les qualifications de la CAN font leurs deux
 * premières journées : Côte d'Ivoire–Ghana, Cameroun–Comores, Sénégal–
 * Mozambique, Mali–Cap-Vert, Burkina–Bénin, Maroc–Gabon, Togo, Niger,
 * Guinée… Exactement les équipes que suivent les abonnés de ProFoot.
 *
 * Constaté le 21 septembre, l'application n'en montrait AUCUNE :
 *
 *   • le référentiel des équipes ne contient que des clubs (827, zéro
 *     sélection) — et le carrousel écarte toute rencontre dont une équipe
 *     lui est inconnue ;
 *   • le sélecteur ne connaissait que douze nations africaines : ni le
 *     Burkina, ni le Bénin, ni le Togo, ni le Niger, ni le Gabon ;
 *   • le fournisseur nomme en anglais : « cameroun » ne trouve rien,
 *     « ivoire » ne trouve que les moins de 20 ans.
 *
 * Tout ce qui touche aux sélections africaines lit donc ICI : un nom français,
 * l'identifiant EXACT du fournisseur (jamais une recherche par nom, qui
 * confond le Congo et la RD Congo, la Guinée et la Guinée-Bissau), et le
 * drapeau.
 *
 * Les identifiants ont été relevés un par un le 21 septembre 2026 sur le
 * calendrier des qualifications (compétition 36), jamais déduits.
 */

/** Coupe d'Afrique des nations (6) et ses qualifications (36). */
export const COMPETITIONS_AFRICAINES: ReadonlySet<number> = new Set([6, 36]);

export interface SelectionAfricaine {
  /** Identifiant du fournisseur — c'est lui qui fait foi. */
  apiId: number;
  /** Le nom tel que l'abonné le tape et le lit. */
  nom: string;
  /** Le nom du fournisseur. */
  en: string;
  /** Code du drapeau (ISO 3166 alpha-2). */
  drapeau: string;
  /**
   * Une nation que le public de ProFoot suit de près — et combien.
   *
   * 2 : une grande nation de ce public — Côte d'Ivoire, Sénégal, Mali,
   *     Burkina, Guinée, Cameroun, les grands du Maghreb, Nigeria, Ghana,
   *     Égypte, RD Congo.
   * 1 : une nation suivie — le reste de l'Afrique francophone.
   * 0 : le reste du continent.
   *
   * Une affiche vaut la somme de ses deux équipes : Côte d'Ivoire–Ghana (4)
   * passe devant Mauritanie–Centrafrique (2), qui passe devant Namibie–Congo
   * (1). Les abonnés vivent surtout en Afrique francophone de l'Ouest et du
   * Centre — là où l'on paie en Orange Money, MTN ou Wave.
   */
  interet: 0 | 1 | 2;
  /** Vrai dès qu'elle compte pour ce public (intérêt 1 ou 2). */
  vedette: boolean;
}

export const SELECTIONS_AFRICAINES: readonly SelectionAfricaine[] = [
  { apiId: 1501, nom: "Côte d'Ivoire", en: 'Ivory Coast', drapeau: 'ci', interet: 2, vedette: true },
  { apiId: 13, nom: 'Sénégal', en: 'Senegal', drapeau: 'sn', interet: 2, vedette: true },
  { apiId: 1500, nom: 'Mali', en: 'Mali', drapeau: 'ml', interet: 2, vedette: true },
  { apiId: 1502, nom: 'Burkina Faso', en: 'Burkina Faso', drapeau: 'bf', interet: 2, vedette: true },
  { apiId: 1509, nom: 'Guinée', en: 'Guinea', drapeau: 'gn', interet: 2, vedette: true },
  { apiId: 1530, nom: 'Cameroun', en: 'Cameroon', drapeau: 'cm', interet: 2, vedette: true },
  { apiId: 1516, nom: 'Bénin', en: 'Benin', drapeau: 'bj', interet: 1, vedette: true },
  { apiId: 1534, nom: 'Togo', en: 'Togo', drapeau: 'tg', interet: 1, vedette: true },
  { apiId: 1505, nom: 'Niger', en: 'Niger', drapeau: 'ne', interet: 1, vedette: true },
  { apiId: 1503, nom: 'Gabon', en: 'Gabon', drapeau: 'ga', interet: 1, vedette: true },
  { apiId: 1517, nom: 'Congo', en: 'Congo', drapeau: 'cg', interet: 1, vedette: true },
  { apiId: 1508, nom: 'RD Congo', en: 'Congo DR', drapeau: 'cd', interet: 2, vedette: true },
  { apiId: 31, nom: 'Maroc', en: 'Morocco', drapeau: 'ma', interet: 2, vedette: true },
  { apiId: 1532, nom: 'Algérie', en: 'Algeria', drapeau: 'dz', interet: 2, vedette: true },
  { apiId: 28, nom: 'Tunisie', en: 'Tunisia', drapeau: 'tn', interet: 2, vedette: true },
  { apiId: 1491, nom: 'Mauritanie', en: 'Mauritania', drapeau: 'mr', interet: 1, vedette: true },
  { apiId: 1527, nom: 'Centrafrique', en: 'Central African Republic', drapeau: 'cf', interet: 1, vedette: true },
  { apiId: 1524, nom: 'Comores', en: 'Comoros', drapeau: 'km', interet: 1, vedette: true },
  { apiId: 1490, nom: 'Madagascar', en: 'Madagascar', drapeau: 'mg', interet: 1, vedette: true },
  { apiId: 19, nom: 'Nigeria', en: 'Nigeria', drapeau: 'ng', interet: 2, vedette: true },
  { apiId: 1504, nom: 'Ghana', en: 'Ghana', drapeau: 'gh', interet: 2, vedette: true },
  { apiId: 32, nom: 'Égypte', en: 'Egypt', drapeau: 'eg', interet: 2, vedette: true },
  { apiId: 1531, nom: 'Afrique du Sud', en: 'South Africa', drapeau: 'za', interet: 0, vedette: false },
  { apiId: 1533, nom: 'Cap-Vert', en: 'Cape Verde Islands', drapeau: 'cv', interet: 0, vedette: false },
  { apiId: 1513, nom: 'Guinée-Bissau', en: 'Guinea-Bissau', drapeau: 'gw', interet: 0, vedette: false },
  { apiId: 1521, nom: 'Guinée équatoriale', en: 'Equatorial Guinea', drapeau: 'gq', interet: 0, vedette: false },
  { apiId: 1492, nom: 'Gambie', en: 'Gambia', drapeau: 'gm', interet: 0, vedette: false },
  { apiId: 1499, nom: 'Sierra Leone', en: 'Sierra Leone', drapeau: 'sl', interet: 0, vedette: false },
  { apiId: 1525, nom: 'Liberia', en: 'Liberia', drapeau: 'lr', interet: 0, vedette: false },
  { apiId: 1529, nom: 'Angola', en: 'Angola', drapeau: 'ao', interet: 0, vedette: false },
  { apiId: 1507, nom: 'Zambie', en: 'Zambia', drapeau: 'zm', interet: 0, vedette: false },
  { apiId: 1522, nom: 'Zimbabwe', en: 'Zimbabwe', drapeau: 'zw', interet: 0, vedette: false },
  { apiId: 1512, nom: 'Mozambique', en: 'Mozambique', drapeau: 'mz', interet: 0, vedette: false },
  { apiId: 1495, nom: 'Malawi', en: 'Malawi', drapeau: 'mw', interet: 0, vedette: false },
  { apiId: 1493, nom: 'Namibie', en: 'Namibia', drapeau: 'na', interet: 0, vedette: false },
  { apiId: 1520, nom: 'Botswana', en: 'Botswana', drapeau: 'bw', interet: 0, vedette: false },
  { apiId: 1518, nom: 'Lesotho', en: 'Lesotho', drapeau: 'ls', interet: 0, vedette: false },
  { apiId: 1511, nom: 'Kenya', en: 'Kenya', drapeau: 'ke', interet: 0, vedette: false },
  { apiId: 1489, nom: 'Tanzanie', en: 'Tanzania', drapeau: 'tz', interet: 0, vedette: false },
  { apiId: 1519, nom: 'Ouganda', en: 'Uganda', drapeau: 'ug', interet: 0, vedette: false },
  { apiId: 1514, nom: 'Rwanda', en: 'Rwanda', drapeau: 'rw', interet: 0, vedette: false },
  { apiId: 1528, nom: 'Burundi', en: 'Burundi', drapeau: 'bi', interet: 0, vedette: false },
  { apiId: 1506, nom: 'Éthiopie', en: 'Ethiopia', drapeau: 'et', interet: 0, vedette: false },
  { apiId: 1498, nom: 'Érythrée', en: 'Eritrea', drapeau: 'er', interet: 0, vedette: false },
  { apiId: 8050, nom: 'Somalie', en: 'Somalia', drapeau: 'so', interet: 0, vedette: false },
  { apiId: 1510, nom: 'Soudan', en: 'Sudan', drapeau: 'sd', interet: 0, vedette: false },
  { apiId: 1496, nom: 'Soudan du Sud', en: 'South Sudan', drapeau: 'ss', interet: 0, vedette: false },
  { apiId: 1526, nom: 'Libye', en: 'Libya', drapeau: 'ly', interet: 0, vedette: false },
];

/** Minuscules, sans accents, sans apostrophes ni tirets : « Côte d'Ivoire » = « cote divoire ». */
function cle(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Apostrophes droite et typographiques, accent grave, tiret, souligné,
    // point. Le tiret est échappé : non échappé entre deux caractères, il
    // deviendrait une plage.
    .replace(/[’‘'`\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAR_API_ID = new Map(SELECTIONS_AFRICAINES.map((s) => [s.apiId, s]));
const PAR_NOM = new Map<string, SelectionAfricaine>();
for (const s of SELECTIONS_AFRICAINES) {
  PAR_NOM.set(cle(s.nom), s);
  PAR_NOM.set(cle(s.en), s);
}
// Les graphies que les abonnés tapent vraiment.
for (const [variante, en] of [
  ['cote divoire', 'Ivory Coast'],
  ['cote d ivoire', 'Ivory Coast'],
  ['rdc', 'Congo DR'],
  ['republique democratique du congo', 'Congo DR'],
  ['congo brazzaville', 'Congo'],
  ['cap vert', 'Cape Verde Islands'],
  ['cape verde', 'Cape Verde Islands'],
  ['republique centrafricaine', 'Central African Republic'],
  ['nigeria', 'Nigeria'],
] as [string, string][]) {
  const s = SELECTIONS_AFRICAINES.find((x) => x.en === en);
  if (s) PAR_NOM.set(cle(variante), s);
}

/** La sélection, par l'identifiant du fournisseur. */
export function selectionParApiId(apiId: number | string | null | undefined): SelectionAfricaine | null {
  return PAR_API_ID.get(Number(apiId)) ?? null;
}

/** La sélection, par son nom français, anglais ou une graphie courante. */
export function selectionParNom(nom: string | null | undefined): SelectionAfricaine | null {
  return PAR_NOM.get(cle(String(nom ?? ''))) ?? null;
}

/** Le nom à afficher : français quand on le connaît, sinon celui du fournisseur. */
export function nomAffiche(apiId: number | string | null | undefined, nomFournisseur: string): string {
  return selectionParApiId(apiId)?.nom ?? nomFournisseur;
}
