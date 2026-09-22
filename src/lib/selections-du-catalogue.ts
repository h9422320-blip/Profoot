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
