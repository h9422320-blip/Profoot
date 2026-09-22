/**
 * LES SÉLECTIONS DU CATALOGUE, PAR LEUR NUMÉRO CHEZ LE FOURNISSEUR.
 *
 * ── POURQUOI UNE TABLE FIXE ───────────────────────────────────────────────
 *
 * Le catalogue (`data.ts`) nomme ses sélections tantôt en anglais (« Mexico »),
 * tantôt en français (« Angleterre », « Pays de Galles »). L'analyse les
 * retrouvait par une recherche de nom chez le fournisseur, et la sélection du
 * jour ne les retrouvait pas du tout : elle ne connaît que les clubs. Une
 * rencontre de Ligue des nations pouvait donc être préparée sans jamais
 * pouvoir être proposée.
 *
 * Chaque ligne a été vérifiée le 22 septembre 2026 contre les 9 819 matchs
 * internationaux relevés par `scripts/challenger/selections.mts` : le numéro
 * est celui sous lequel la sélection A y joue.
 *
 * Les sélections africaines ont leur propre relevé (`selections-africaines.ts`)
 * et passent en premier : c'est lui qui porte leurs identifiants de CAN.
 */
import { selectionParApiId, SELECTIONS_AFRICAINES } from './selections-africaines';

const TABLE: readonly (readonly [number, string])[] = [
  [16, 'mexico'], [1531, 'south_africa'], [17, 'south_korea'], [5529, 'canada'],
  [1113, 'bosnia'], [1569, 'qatar'], [15, 'switzerland'], [6, 'brazil'],
  [31, 'morocco'], [2386, 'haiti'], [1108, 'scotland'], [2384, 'usa'],
  [2380, 'paraguay'], [20, 'australia'], [777, 'turkiye'], [25, 'germany'],
  [5530, 'curacao'], [1501, 'ivory_coast'], [2382, 'ecuador'], [1118, 'netherlands'],
  [12, 'japan'], [5, 'sweden'], [28, 'tunisia'], [1, 'belgium'],
  [32, 'egypt'], [22, 'iran'], [4673, 'new_zealand'], [9, 'spain'],
  [1533, 'cape_verde'], [23, 'saudi_arabia'], [7, 'uruguay'], [2, 'france'],
  [13, 'senegal'], [1567, 'iraq'], [8, 'colombia'], [27, 'portugal'],
  [29, 'costa_rica'], [11, 'panama'], [772, 'ukraine'],
  [770, 'czech_republic'], [26, 'argentina'], [10, 'england'], [767, 'wales'],
  [2385, 'jamaica'], [768, 'italy'], [21, 'denmark'], [3, 'croatia'],
  [2383, 'chile'], [14, 'serbia'], [1090, 'norway'], [775, 'austria'],
  [24, 'poland'],
  // Les 68 sélections ajoutées au catalogue le 22 septembre 2026 (rubrique
  // « Sélections nationales »), mêmes vérifications.
  [778, 'albania_nat'], [1110, 'andorra_nat'], [8150, 'anguilla_nat'], [5526, 'antigua_nat'],
  [1094, 'armenia_nat'], [8167, 'aruba_nat'], [1096, 'azerbaijan_nat'], [5157, 'bahamas_nat'],
  [5527, 'barbados_nat'], [1100, 'belarus_nat'], [5528, 'belize_nat'], [5158, 'bermuda_nat'],
  [2381, 'bolivia_nat'], [10982, 'bonaire_nat'], [8168, 'bvi_nat'], [1103, 'bulgaria_nat'],
  [8169, 'cayman_nat'], [2388, 'cuba_nat'], [1106, 'cyprus_nat'], [5531, 'dominica_nat'],
  [5532, 'dominican_rep_nat'], [5159, 'el_salvador_nat'], [1101, 'estonia_nat'], [1098, 'faroe_nat'],
  [1099, 'finland_nat'], [8118, 'french_guiana_nat'], [1105, 'north_macedonia_nat'], [1104, 'georgia_nat'],
  [1093, 'gibraltar_nat'], [1117, 'greece_nat'], [5533, 'grenada_nat'], [10983, 'guadeloupe_nat'],
  [5161, 'guatemala_nat'], [5162, 'guyana_nat'], [4672, 'honduras_nat'], [769, 'hungary_nat'],
  [18, 'iceland_nat'], [1116, 'israel_nat'], [1095, 'kazakhstan_nat'], [1111, 'kosovo_nat'],
  [1092, 'latvia_nat'], [1107, 'liechtenstein_nat'], [1097, 'lithuania_nat'], [1102, 'luxembourg_nat'],
  [1112, 'malta_nat'], [8117, 'martinique_nat'], [1114, 'moldova_nat'], [1109, 'montenegro_nat'],
  [8170, 'montserrat_nat'], [5164, 'nicaragua_nat'], [771, 'northern_ireland_nat'], [30, 'peru_nat'],
  [5539, 'puerto_rico_nat'], [776, 'ireland_nat'], [774, 'romania_nat'], [10984, 'saint_martin_nat'],
  [1115, 'san_marino_nat'], [10985, 'sint_maarten_nat'], [773, 'slovakia_nat'], [1091, 'slovenia_nat'],
  [5536, 'st_kitts_nat'], [5540, 'st_lucia_nat'], [5541, 'st_vincent_nat'], [8171, 'suriname_nat'],
  [5168, 'trinidad_nat'], [5169, 'turks_caicos_nat'], [8172, 'usvi_nat'], [2379, 'venezuela_nat'],
];

const PAR_NUMERO = new Map<number, string>(TABLE);
const PAR_CATALOGUE = new Map<string, number>([
  ...TABLE.map(([n, c]) => [c, n] as [string, number]),
  ...SELECTIONS_AFRICAINES.filter((s) => s.catalogue).map((s) => [s.catalogue, s.apiId] as [string, number]),
]);

/** L'identifiant du catalogue d'une sélection, d'après son numéro chez le fournisseur. */
export function catalogueDeSelection(apiId: number | string | null | undefined): string | null {
  const n = Number(apiId);
  if (!Number.isFinite(n)) return null;
  return selectionParApiId(n)?.catalogue || PAR_NUMERO.get(n) || null;
}

/** Le numéro chez le fournisseur d'une sélection du catalogue, ou `null`. */
export function numeroDeSelection(catalogue: string | null | undefined): number | null {
  return PAR_CATALOGUE.get(String(catalogue ?? '')) ?? null;
}
