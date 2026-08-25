/**
 * L'HEURE DU MATCH, DANS LE FUSEAU DE CELUI QUI LA LIT.
 *
 * ── CE QUI N'ALLAIT PAS ───────────────────────────────────────────────────
 *
 * Les heures de match étaient mises en forme sur le serveur, avec
 * `timeZone: "Europe/Paris"` écrit en dur. Tout le monde voyait donc l'heure
 * de Paris, où qu'il soit. Mesuré sur un match à 21h00 heure de Paris :
 *
 *     Conakry      19:00   affiché 21:00   (−2 h)
 *     Abidjan      19:00   affiché 21:00   (−2 h)
 *     Montréal     15:00   affiché 21:00   (−6 h)
 *     Tokyo        04:00 le lendemain      (+7 h)
 *     Sydney       05:00 le lendemain      (+8 h)
 *
 * Le marché principal était touché : un abonné à Conakry qui lit « 21:00 »
 * arrive deux heures après le coup d'envoi. Il rate le match qu'il a payé.
 *
 * Pire, la DATE n'avait aucun fuseau du tout — elle suivait celui du serveur,
 * UTC. Pour un match à 00h30 heure de Paris, l'application annonçait
 * « 25/08 à 00:30 » : la date d'un jour, l'heure d'un autre. Un instant qui
 * n'existe pas.
 *
 * ── LA RÈGLE ICI ──────────────────────────────────────────────────────────
 *
 * On ne met plus jamais une heure en forme sur le serveur pour l'afficher.
 * Le serveur transmet l'INSTANT (une date ISO, qui porte son décalage), et le
 * navigateur le met en forme dans son propre fuseau. Date, heure et jour de la
 * semaine sortent tous du même appel, donc du même fuseau : ils ne peuvent
 * plus se contredire.
 *
 * ── POURQUOI CHAQUE FONCTION ACCEPTE UN REPLI ─────────────────────────────
 *
 * Les analyses déjà calculées dorment en réserve, et celles-là ne portent pas
 * le nouvel instant : elles n'ont que les anciennes chaînes. Sans repli, elles
 * afficheraient un blanc. On rend donc l'ancienne chaîne — fausse de deux
 * heures, mais lisible — jusqu'à ce que la réserve se renouvelle d'elle-même.
 */

/**
 * Convertit ce que le serveur a transmis en instant utilisable.
 *
 * Accepte une date ISO (« 2026-08-25T19:00:00+00:00 ») ou un horodatage en
 * millisecondes. Renvoie `null` sur tout le reste — une valeur absente, vide,
 * ou une chaîne que le navigateur ne sait pas lire.
 */
function instant(source: string | number | null | undefined): Date | null {
  if (source === null || source === undefined || source === '') return null;
  const d = new Date(source);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Un fuseau proposé par un navigateur est-il utilisable ?
 *
 * `toLocaleTimeString({ timeZone: 'Mars/Olympus' })` ne renvoie pas une valeur
 * approximative : elle LÈVE une exception. Comme ce fuseau arrive d'une
 * requête, une chaîne fantaisie ferait tomber la réponse entière. On vérifie
 * donc avant de s'en servir, et on renvoie `undefined` en cas de doute — le
 * formateur retombe alors sur le fuseau du serveur, comme avant.
 */
export function fuseauUtilisable(candidat: unknown): string | undefined {
  if (typeof candidat !== 'string' || !candidat.trim()) return undefined;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: candidat }).format(new Date());
    return candidat;
  } catch {
    return undefined;
  }
}

/** « 21:00 », dans le fuseau du lecteur. */
export function heureLocale(
  source: string | number | null | undefined,
  repli = ''
): string {
  const d = instant(source);
  if (!d) return repli;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** « 25/08 », dans le fuseau du lecteur. */
export function dateCourteLocale(
  source: string | number | null | undefined,
  repli = ''
): string {
  const d = instant(source);
  if (!d) return repli;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

/** « 25 août 2026 », dans le fuseau du lecteur. */
export function dateLongueLocale(
  source: string | number | null | undefined,
  repli = ''
): string {
  const d = instant(source);
  if (!d) return repli;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Le couple jour + mois séparé, pour les colonnes de date étroites.
 *
 * La liste des prochains matchs découpait la chaîne du serveur avec
 * `m.date.split('/')`. Ce découpage est refait ici à partir de l'instant, pour
 * que la colonne et l'heure juste à côté parlent du même jour.
 */
export function jourEtMoisLocaux(
  source: string | number | null | undefined,
  repli = ''
): [string, string] {
  const court = dateCourteLocale(source, repli);
  const [jour = '', mois = ''] = court.split('/');
  return [jour, mois];
}
