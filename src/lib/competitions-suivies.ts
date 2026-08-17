/**
 * Les compétitions réellement suivies par l'application.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * La page des compétitions affichait QUATORZE compétitions, écrites à la main.
 * Le moteur, lui, en suit soixante-deux : les cinquante-trois premières
 * divisions d'Europe ajoutées le 16 août, plus les coupes continentales. Un
 * abonné qui cherchait le championnat suisse, grec ou israélien ne le trouvait
 * nulle part — alors que l'application l'analyse et en connaît le classement.
 *
 * CE QU'IL CONTIENT, ET CE QU'IL NE CONTIENT PAS
 *
 * Seulement ce qui ne change jamais : l'identifiant, le nom, le pays, la
 * région. L'état d'une compétition — commencée, terminée, leader du moment —
 * est lu en direct par `/api/competitions/status`, et n'a rien à faire ici :
 * c'est exactement ce genre de valeur figée qui affichait la saison passée
 * comme s'il s'agissait de l'actualité.
 *
 * Les logos se déduisent de l'identifiant chez le fournisseur : aucun appel
 * réseau n'est nécessaire pour bâtir cette liste.
 */

import { LEAGUE_IDS } from './api-football';

export type RegionCompetition = 'continentale' | 'europe' | 'afrique' | 'monde';

export interface CompetitionSuivie {
  id: string;
  nom: string;
  pays: string;
  region: RegionCompetition;
  logo: string;
}

/** Nom et pays de chaque compétition suivie. */
const CATALOGUE: Record<string, { nom: string; pays: string; region: RegionCompetition }> = {
  // ── Compétitions continentales ──
  ucl: { nom: 'UEFA Champions League', pays: 'Europe', region: 'continentale' },
  uel: { nom: 'UEFA Europa League', pays: 'Europe', region: 'continentale' },
  uecl: { nom: 'UEFA Conference League', pays: 'Europe', region: 'continentale' },
  can: { nom: "Coupe d'Afrique des Nations", pays: 'Afrique', region: 'afrique' },

  // ── Les cinq grands championnats ──
  epl: { nom: 'Premier League', pays: 'Angleterre', region: 'europe' },
  laliga: { nom: 'La Liga', pays: 'Espagne', region: 'europe' },
  seriea: { nom: 'Serie A', pays: 'Italie', region: 'europe' },
  bundesliga: { nom: 'Bundesliga', pays: 'Allemagne', region: 'europe' },
  ligue1: { nom: 'Ligue 1', pays: 'France', region: 'europe' },

  // ── Le reste de l'Europe ──
  eredivisie: { nom: 'Eredivisie', pays: 'Pays-Bas', region: 'europe' },
  ligaportugal: { nom: 'Primeira Liga', pays: 'Portugal', region: 'europe' },
  proleague: { nom: 'Jupiler Pro League', pays: 'Belgique', region: 'europe' },
  premiership: { nom: 'Premiership', pays: 'Écosse', region: 'europe' },
  superlig: { nom: 'Süper Lig', pays: 'Turquie', region: 'europe' },
  suisse: { nom: 'Super League', pays: 'Suisse', region: 'europe' },
  autriche: { nom: 'Bundesliga', pays: 'Autriche', region: 'europe' },
  grece: { nom: 'Super League 1', pays: 'Grèce', region: 'europe' },
  danemark: { nom: 'Superliga', pays: 'Danemark', region: 'europe' },
  norvege: { nom: 'Eliteserien', pays: 'Norvège', region: 'europe' },
  suede: { nom: 'Allsvenskan', pays: 'Suède', region: 'europe' },
  pologne: { nom: 'Ekstraklasa', pays: 'Pologne', region: 'europe' },
  tchequie: { nom: 'Chance Liga', pays: 'Tchéquie', region: 'europe' },
  croatie: { nom: 'HNL', pays: 'Croatie', region: 'europe' },
  serbie: { nom: 'Super Liga', pays: 'Serbie', region: 'europe' },
  ukraine: { nom: 'Premier League', pays: 'Ukraine', region: 'europe' },
  roumanie: { nom: 'Liga I', pays: 'Roumanie', region: 'europe' },
  russie: { nom: 'Premier League', pays: 'Russie', region: 'europe' },
  israel: { nom: "Ligat Ha'al", pays: 'Israël', region: 'europe' },
  chypre: { nom: '1re Division', pays: 'Chypre', region: 'europe' },
  hongrie: { nom: 'NB I', pays: 'Hongrie', region: 'europe' },
  bulgarie: { nom: 'First League', pays: 'Bulgarie', region: 'europe' },
  slovaquie: { nom: 'Super Liga', pays: 'Slovaquie', region: 'europe' },
  slovenie: { nom: '1. SNL', pays: 'Slovénie', region: 'europe' },
  bosnie: { nom: 'Premijer Liga', pays: 'Bosnie', region: 'europe' },
  kazakhstan: { nom: 'Premier League', pays: 'Kazakhstan', region: 'europe' },
  finlande: { nom: 'Veikkausliiga', pays: 'Finlande', region: 'europe' },
  irlande: { nom: 'Premier Division', pays: 'Irlande', region: 'europe' },
  islande: { nom: 'Úrvalsdeild', pays: 'Islande', region: 'europe' },
  azerbaidjan: { nom: 'Premyer Liqa', pays: 'Azerbaïdjan', region: 'europe' },
  bielorussie: { nom: 'Premier League', pays: 'Biélorussie', region: 'europe' },
  georgie: { nom: 'Erovnuli Liga', pays: 'Géorgie', region: 'europe' },
  albanie: { nom: 'Superliga', pays: 'Albanie', region: 'europe' },
  kosovo: { nom: 'Superliga', pays: 'Kosovo', region: 'europe' },
  moldavie: { nom: 'Super Liga', pays: 'Moldavie', region: 'europe' },
  montenegro: { nom: 'First League', pays: 'Monténégro', region: 'europe' },
  lettonie: { nom: 'Virsliga', pays: 'Lettonie', region: 'europe' },
  lituanie: { nom: 'A Lyga', pays: 'Lituanie', region: 'europe' },
  estonie: { nom: 'Meistriliiga', pays: 'Estonie', region: 'europe' },
  armenie: { nom: 'Premier League', pays: 'Arménie', region: 'europe' },
  malte: { nom: 'Premier League', pays: 'Malte', region: 'europe' },
  luxembourg: { nom: 'National Division', pays: 'Luxembourg', region: 'europe' },
  irlandedunord: { nom: 'Premiership', pays: 'Irlande du Nord', region: 'europe' },
  paysdegalles: { nom: 'Cymru Premier', pays: 'Pays de Galles', region: 'europe' },
  feroe: { nom: 'Meistaradeildin', pays: 'Îles Féroé', region: 'europe' },
  gibraltar: { nom: 'Premier Division', pays: 'Gibraltar', region: 'europe' },
  andorre: { nom: '1a Divisió', pays: 'Andorre', region: 'europe' },
  sanmarin: { nom: 'Campionato', pays: 'Saint-Marin', region: 'europe' },

  // ── Deuxièmes divisions connues du grand public ──
  championship: { nom: 'Championship', pays: 'Angleterre', region: 'europe' },
  ligue2: { nom: 'Ligue 2', pays: 'France', region: 'europe' },
  segunda: { nom: 'LaLiga 2', pays: 'Espagne', region: 'europe' },
  serieb: { nom: 'Serie B', pays: 'Italie', region: 'europe' },
  bundesliga2: { nom: '2. Bundesliga', pays: 'Allemagne', region: 'europe' },
};

/**
 * Toutes les compétitions suivies, dans l'ordre où elles doivent s'afficher.
 *
 * Les continentales d'abord, puis les cinq grands championnats, puis le reste
 * par ordre alphabétique de pays : c'est l'ordre dans lequel un amateur les
 * cherche.
 */
export function trouverCompetitionSuivie(id: string): CompetitionSuivie | undefined {
  const fiche = CATALOGUE[id];
  if (!fiche || LEAGUE_IDS[id] === undefined) return undefined;
  return { id, ...fiche, logo: `https://media.api-sports.io/football/leagues/${LEAGUE_IDS[id]}.png` };
}

export function listerCompetitionsSuivies(): CompetitionSuivie[] {
  const PRIORITE = ['ucl', 'uel', 'uecl', 'can', 'epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];

  const toutes = Object.keys(CATALOGUE)
    .filter((cle) => LEAGUE_IDS[cle] !== undefined)
    .map((cle) => ({
      id: cle,
      ...CATALOGUE[cle],
      logo: `https://media.api-sports.io/football/leagues/${LEAGUE_IDS[cle]}.png`,
    }));

  return toutes.sort((a, b) => {
    const ra = PRIORITE.indexOf(a.id);
    const rb = PRIORITE.indexOf(b.id);
    if (ra !== -1 || rb !== -1) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
    return a.pays.localeCompare(b.pays, 'fr');
  });
}
