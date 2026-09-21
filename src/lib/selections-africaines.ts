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
   * L'identifiant de cette nation dans le catalogue de l'application
   * (`data.ts`) — le SEUL que le serveur d'analyse accepte.
   *
   * Le serveur ne reprend jamais un nom venu du navigateur : il ne connaît une
   * équipe que par un identifiant de son catalogue, et c'est ce qui ferme
   * l'injection dans le texte envoyé à l'IA. Constaté le 21 septembre 2026 :
   * une carte portant un identifiant inventé (« nat-1501 ») recevait « Équipe
   * inconnue », et l'abonné qui la touchait voyait l'analyse échouer deux fois.
   */
  catalogue: string;
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
  { apiId: 1501, nom: "Côte d'Ivoire", en: 'Ivory Coast', drapeau: 'ci', catalogue: 'ivory_coast_can', interet: 2, vedette: true },
  { apiId: 13, nom: 'Sénégal', en: 'Senegal', drapeau: 'sn', catalogue: 'senegal_can', interet: 2, vedette: true },
  { apiId: 1500, nom: 'Mali', en: 'Mali', drapeau: 'ml', catalogue: 'mali', interet: 2, vedette: true },
  { apiId: 1502, nom: 'Burkina Faso', en: 'Burkina Faso', drapeau: 'bf', catalogue: 'bf_can_nat', interet: 2, vedette: true },
  { apiId: 1509, nom: 'Guinée', en: 'Guinea', drapeau: 'gn', catalogue: 'guinea', interet: 2, vedette: true },
  { apiId: 1530, nom: 'Cameroun', en: 'Cameroon', drapeau: 'cm', catalogue: 'cameroon', interet: 2, vedette: true },
  { apiId: 1516, nom: 'Bénin', en: 'Benin', drapeau: 'bj', catalogue: 'bj_can_nat', interet: 1, vedette: true },
  { apiId: 1534, nom: 'Togo', en: 'Togo', drapeau: 'tg', catalogue: 'tg_can_nat', interet: 1, vedette: true },
  { apiId: 1505, nom: 'Niger', en: 'Niger', drapeau: 'ne', catalogue: 'ne_can_nat', interet: 1, vedette: true },
  { apiId: 1503, nom: 'Gabon', en: 'Gabon', drapeau: 'ga', catalogue: 'ga_can_nat', interet: 1, vedette: true },
  { apiId: 1517, nom: 'Congo', en: 'Congo', drapeau: 'cg', catalogue: 'cg_can_nat', interet: 1, vedette: true },
  { apiId: 1508, nom: 'RD Congo', en: 'Congo DR', drapeau: 'cd', catalogue: 'dr_congo', interet: 2, vedette: true },
  { apiId: 31, nom: 'Maroc', en: 'Morocco', drapeau: 'ma', catalogue: 'morocco_can', interet: 2, vedette: true },
  { apiId: 1532, nom: 'Algérie', en: 'Algeria', drapeau: 'dz', catalogue: 'algeria', interet: 2, vedette: true },
  { apiId: 28, nom: 'Tunisie', en: 'Tunisia', drapeau: 'tn', catalogue: 'tunisia_can', interet: 2, vedette: true },
  { apiId: 1491, nom: 'Mauritanie', en: 'Mauritania', drapeau: 'mr', catalogue: 'mr_can_nat', interet: 1, vedette: true },
  { apiId: 1527, nom: 'Centrafrique', en: 'Central African Republic', drapeau: 'cf', catalogue: 'cf_can_nat', interet: 1, vedette: true },
  { apiId: 1524, nom: 'Comores', en: 'Comoros', drapeau: 'km', catalogue: 'km_can_nat', interet: 1, vedette: true },
  { apiId: 1490, nom: 'Madagascar', en: 'Madagascar', drapeau: 'mg', catalogue: 'mg_can_nat', interet: 1, vedette: true },
  { apiId: 19, nom: 'Nigeria', en: 'Nigeria', drapeau: 'ng', catalogue: 'nigeria', interet: 2, vedette: true },
  { apiId: 1504, nom: 'Ghana', en: 'Ghana', drapeau: 'gh', catalogue: 'ghana', interet: 2, vedette: true },
  { apiId: 32, nom: 'Égypte', en: 'Egypt', drapeau: 'eg', catalogue: 'egypt_can', interet: 2, vedette: true },
  { apiId: 1531, nom: 'Afrique du Sud', en: 'South Africa', drapeau: 'za', catalogue: 'za_can_nat', interet: 0, vedette: false },
  { apiId: 1533, nom: 'Cap-Vert', en: 'Cape Verde Islands', drapeau: 'cv', catalogue: 'cv_can_nat', interet: 0, vedette: false },
  { apiId: 1513, nom: 'Guinée-Bissau', en: 'Guinea-Bissau', drapeau: 'gw', catalogue: 'gw_can_nat', interet: 0, vedette: false },
  { apiId: 1521, nom: 'Guinée équatoriale', en: 'Equatorial Guinea', drapeau: 'gq', catalogue: 'gq_can_nat', interet: 0, vedette: false },
  { apiId: 1492, nom: 'Gambie', en: 'Gambia', drapeau: 'gm', catalogue: 'gm_can_nat', interet: 0, vedette: false },
  { apiId: 1499, nom: 'Sierra Leone', en: 'Sierra Leone', drapeau: 'sl', catalogue: 'sl_can_nat', interet: 0, vedette: false },
  { apiId: 1525, nom: 'Liberia', en: 'Liberia', drapeau: 'lr', catalogue: 'lr_can_nat', interet: 0, vedette: false },
  { apiId: 1529, nom: 'Angola', en: 'Angola', drapeau: 'ao', catalogue: 'ao_can_nat', interet: 0, vedette: false },
  { apiId: 1507, nom: 'Zambie', en: 'Zambia', drapeau: 'zm', catalogue: 'zm_can_nat', interet: 0, vedette: false },
  { apiId: 1522, nom: 'Zimbabwe', en: 'Zimbabwe', drapeau: 'zw', catalogue: 'zw_can_nat', interet: 0, vedette: false },
  { apiId: 1512, nom: 'Mozambique', en: 'Mozambique', drapeau: 'mz', catalogue: 'mz_can_nat', interet: 0, vedette: false },
  { apiId: 1495, nom: 'Malawi', en: 'Malawi', drapeau: 'mw', catalogue: 'mw_can_nat', interet: 0, vedette: false },
  { apiId: 1493, nom: 'Namibie', en: 'Namibia', drapeau: 'na', catalogue: 'na_can_nat', interet: 0, vedette: false },
  { apiId: 1520, nom: 'Botswana', en: 'Botswana', drapeau: 'bw', catalogue: 'bw_can_nat', interet: 0, vedette: false },
  { apiId: 1518, nom: 'Lesotho', en: 'Lesotho', drapeau: 'ls', catalogue: 'ls_can_nat', interet: 0, vedette: false },
  { apiId: 1511, nom: 'Kenya', en: 'Kenya', drapeau: 'ke', catalogue: 'ke_can_nat', interet: 0, vedette: false },
  { apiId: 1489, nom: 'Tanzanie', en: 'Tanzania', drapeau: 'tz', catalogue: 'tz_can_nat', interet: 0, vedette: false },
  { apiId: 1519, nom: 'Ouganda', en: 'Uganda', drapeau: 'ug', catalogue: 'ug_can_nat', interet: 0, vedette: false },
  { apiId: 1514, nom: 'Rwanda', en: 'Rwanda', drapeau: 'rw', catalogue: 'rw_can_nat', interet: 0, vedette: false },
  { apiId: 1528, nom: 'Burundi', en: 'Burundi', drapeau: 'bi', catalogue: 'bi_can_nat', interet: 0, vedette: false },
  { apiId: 1506, nom: 'Éthiopie', en: 'Ethiopia', drapeau: 'et', catalogue: 'et_can_nat', interet: 0, vedette: false },
  { apiId: 1498, nom: 'Érythrée', en: 'Eritrea', drapeau: 'er', catalogue: 'er_can_nat', interet: 0, vedette: false },
  { apiId: 8050, nom: 'Somalie', en: 'Somalia', drapeau: 'so', catalogue: 'so_can_nat', interet: 0, vedette: false },
  { apiId: 1510, nom: 'Soudan', en: 'Sudan', drapeau: 'sd', catalogue: 'sd_can_nat', interet: 0, vedette: false },
  { apiId: 1496, nom: 'Soudan du Sud', en: 'South Sudan', drapeau: 'ss', catalogue: 'ss_can_nat', interet: 0, vedette: false },
  { apiId: 1526, nom: 'Libye', en: 'Libya', drapeau: 'ly', catalogue: 'ly_can_nat', interet: 0, vedette: false },
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
