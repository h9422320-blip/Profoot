/**
 * LE NOM D'UNE COMPÉTITION, AVEC SON PAYS QUAND IL LE FAUT.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * « Cup » est le nom de la coupe de Grèce, d'Autriche, de Pologne, de
 * Tchéquie, d'Estonie, d'Ukraine, de Lituanie, d'Islande ET de Lettonie.
 * « Super League » désigne la Suisse, l'Ouzbékistan, la Chine, le Malawi et la
 * Malaisie. « Premiership » l'Écosse et l'Irlande du Nord.
 *
 * Deux endroits du projet rangent des mesures par compétition : le mur des
 * preuves, qui l'affiche, et le calibrage du moteur, qui apprend des facteurs
 * de buts PAR championnat et les applique ensuite. Le second les rangeait sous
 * le nom brut : constaté le 17 septembre 2026, la ligne « Cup » mélangeait neuf
 * coupes de neuf pays, et « Super League » cinq championnats de cinq pays — et
 * cette moyenne était appliquée à chacun d'eux.
 *
 * Le nom sort d'ici, pour les deux, et une seule fois.
 */

/**
 * LES CHAMPIONNATS QUI PORTENT LE MÊME NOM DANS DEUX PAYS.
 *
 * Le 31 août 2026, le mur de preuves affichait « SERIE A » au-dessus de
 * Flamengo — Botafogo, et « BUNDESLIGA » au-dessus de Rapid Vienne — Sturm
 * Graz. Les deux étiquettes venaient du fournisseur et étaient exactes : le
 * championnat brésilien s'appelle bien Série A, l'autrichien bien Bundesliga.
 *
 * Exactes, et trompeuses. Sur la même page, « SERIE A » coiffait aussi
 * Napoli — Como. Un amateur de football qui voit Flamengo rangé dans le
 * championnat italien n'en conclut pas qu'il existe deux Série A : il conclut
 * que nos données sont fausses. Sur la page dont le seul rôle est de prouver
 * que nos données sont justes.
 *
 * On ajoute donc le pays UNIQUEMENT quand le nom est ambigu et que le pays
 * n'est pas celui auquel on pense spontanément. « Premier League » reste
 * « Premier League » pour l'Angleterre, et devient « Premier League (Russie) »
 * pour la Russie.
 */
export const PAYS_ATTENDU: Record<string, string> = {
  'serie a': 'Italy',
  'serie b': 'Italy',
  bundesliga: 'Germany',
  'bundesliga 2': 'Germany',
  'premier league': 'England',
  championship: 'England',
  'ligue 1': 'France',
  'ligue 2': 'France',
  'la liga': 'Spain',
  eredivisie: 'Netherlands',
  'primeira liga': 'Portugal',
  'super lig': 'Turkey',
  'süper lig': 'Turkey',
};

/** Le nom français des pays qui apparaissent réellement dans nos preuves. */
const NOM_PAYS: Record<string, string> = {
  Brazil: 'Brésil',
  Austria: 'Autriche',
  Russia: 'Russie',
  Ukraine: 'Ukraine',
  Switzerland: 'Suisse',
  Greece: 'Grèce',
  Belgium: 'Belgique',
  Scotland: 'Écosse',
  Denmark: 'Danemark',
  Norway: 'Norvège',
  Sweden: 'Suède',
  Poland: 'Pologne',
  Croatia: 'Croatie',
  Romania: 'Roumanie',
  Israel: 'Israël',
  Cyprus: 'Chypre',
  Hungary: 'Hongrie',
  Bulgaria: 'Bulgarie',
  Czechia: 'Tchéquie',
  'Czech-Republic': 'Tchéquie',
  Serbia: 'Serbie',
  Slovakia: 'Slovaquie',
  Slovenia: 'Slovénie',
  Ireland: 'Irlande',
  Iceland: 'Islande',
  Finland: 'Finlande',
  Kazakhstan: 'Kazakhstan',
  Argentina: 'Argentine',
  Mexico: 'Mexique',
  'USA': 'États-Unis',
  Japan: 'Japon',
  'South-Korea': 'Corée du Sud',
  China: 'Chine',
  Egypt: 'Égypte',
  Morocco: 'Maroc',
  Tunisia: 'Tunisie',
  Algeria: 'Algérie',
  'Ivory-Coast': "Côte d'Ivoire",
  Senegal: 'Sénégal',
};

/**
 * Le nom d'un championnat, complété par son pays quand il le faut.
 *
 * Ne lève jamais et ne perd jamais l'information d'origine : sans pays connu,
 * ou sur un nom non ambigu, la chaîne du fournisseur ressort telle quelle.
 */
export function nommerCompetition(
  nom: string | null | undefined,
  pays: string | null | undefined
): string | null {
  const n = String(nom ?? '').trim();
  if (!n) return null;

  const p = String(pays ?? '').trim();
  if (!p || p.toLowerCase() === 'world') return n;

  const attendu = PAYS_ATTENDU[n.toLowerCase()];
  if (!attendu || attendu.toLowerCase() === p.toLowerCase()) return n;

  return `${n} (${NOM_PAYS[p] ?? p})`;
}

/**
 * LA CLÉ SOUS LAQUELLE ON RANGE UNE MESURE PAR COMPÉTITION.
 *
 * ── POURQUOI ELLE DIFFÈRE DU NOM AFFICHÉ ──────────────────────────────────
 *
 * `nommerCompetition` sert à ÉCRIRE sur une carte : elle n'ajoute le pays que
 * lorsqu'il lève une ambiguïté connue, pour ne pas alourdir « Premier League »
 * en Angleterre. C'est le bon choix pour l'œil.
 *
 * C'est le mauvais pour une CLÉ. Relevé le 17 septembre 2026 sur les 4 242
 * jugements du moteur :
 *
 *     « Premier League »  514 jugements, dont ~130 venus de Russie, de
 *                         Biélorussie, du pays de Galles, d'Ukraine,
 *                         d'Arménie, d'Égypte, du Bhoutan…
 *     « Cup »             les coupes de neuf pays dans la même ligne
 *     « Super League »    Suisse, Ouzbékistan, Chine, Malawi, Malaisie
 *
 * Les facteurs de buts appris sur ces mélanges étaient ensuite appliqués à
 * chacune de ces compétitions. Un quart du calibrage de la Premier League
 * anglaise venait d'ailleurs.
 *
 * La clé porte donc TOUJOURS le pays. Une compétition sans pays — les coupes
 * d'Europe, dont le pays vaut « World » — garde son nom seul : il est unique.
 */
export function cleDeCompetition(
  nom: string | null | undefined,
  pays: string | null | undefined
): string | null {
  const n = String(nom ?? '').trim();
  if (!n) return null;
  const p = String(pays ?? '').trim();
  if (!p || p.toLowerCase() === 'world') return n;
  return `${n} (${NOM_PAYS[p] ?? p})`;
}
