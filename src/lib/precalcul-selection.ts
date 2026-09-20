/**
 * CALCULER LES GRANDS MATCHS À VENIR AVANT QU'ON LES DEMANDE.
 *
 * ── LE VERROU QUE CE FICHIER FAIT SAUTER ──────────────────────────────────
 *
 * La sélection « les matchs les mieux cernés » ne peut classer qu'une
 * rencontre dont les probabilités existent — donc une rencontre déjà analysée
 * par quelqu'un. Mesuré le 5 septembre 2026 sur le programme du lendemain :
 *
 *     88 rencontres dans un grand championnat
 *     38 avaient un calcul  →  50 invisibles pour la sélection
 *
 * Elle proposait donc trois ou quatre matchs par jour, choisis parmi ce que
 * les clients avaient ouvert la veille, et non parmi ce qui se joue vraiment.
 * Un abonné qui dispose de vingt analyses par mois ne peut pas se contenter de
 * trois propositions.
 *
 * ── CE QUE ÇA COÛTE, ET POURQUOI C'EST SUPPORTABLE ────────────────────────
 *
 * Le quota du fournisseur est la ressource la plus rare du projet : il a
 * frôlé les 100 % le 16 août 2026, et au-delà plus aucune analyse ne
 * fonctionne pour personne. Relevé le 5 septembre : 27 801 requêtes sur
 * 150 000, soit 122 000 disponibles.
 *
 * Un pronostic coûte deux appels — les statistiques de chaque équipe. Le
 * classement et les forces de la ligue sont partagés par toutes les
 * rencontres du même championnat, donc lus une seule fois. Cinquante matchs
 * manquants reviennent à une centaine d'appels, sur cent vingt-deux mille.
 *
 * Le plafond `MAX_PAR_PASSAGE` reste là pour le jour où quelque chose
 * déraille : mieux vaut couvrir la moitié du programme que vider le quota.
 *
 * ── CE QUI N'EST JAMAIS RECALCULÉ ─────────────────────────────────────────
 *
 * Une rencontre qui a déjà un pronostic. Il est FIGÉ, et c'est tout le sujet :
 * un abonné qui rouvre son analyse doit y retrouver ce qu'il a lu. Ce fichier
 * ne fait qu'ajouter ce qui manque.
 */

import { createAdminClient } from './supabase-admin';
import { calculerScoreProbable, competitionPeuFiable, melangerStatistiques } from './score-probable';
import { statistiquesDepuisMatchs } from './statistiques-recentes';
import { correctionElanTerrain, lireElanEtTerrain } from './elan-et-terrain';
import { correctionRepos, derniereRencontreAvant, sommeDesCorrections } from './repos-des-clubs';
import {
  lireForces,
  butsAttendusOccasions,
  CHAMPIONNATS as COMPETITIONS_APPRISES,
} from './forme-occasions';
import { avisDeLaMemoire, lireMemoireClubs, partDeLaMemoire } from './memoire-clubs';
import { lireForcesLigue } from './forces-equipes';
import { lireForcesChampionnats, rapportEntreChampionnats } from './forces-championnats';
import { lireForcesPoisson, butsAttendusPourLeMatch, PART_GRILLE_SCORE } from './forces-poisson';
import { avisDuMarchePour, avisDuMarcheBranche, totalDuMarchePour } from './couche-marche';
import { lireCotesDuJourPatiemment } from './cotes-marche';
import { figerPrediction, remplacerPredictionFigee } from './prediction-figee';
import { coucheDesAbsences, LIGUES_DES_ABSENCES } from './forces-absences';
import { lireEntraineurs, partDeLEntraineurNeuf } from './entraineurs';

/**
 * Les championnats que la sélection a vocation à couvrir.
 *
 * Ce sont ceux que les abonnés ouvrent, et ceux pour lesquels le fournisseur
 * rend des statistiques complètes. Y ajouter les championnats obscurs
 * coûterait du quota pour des rencontres que la fiabilité mesurée écarterait
 * de toute façon.
 */
// ── PREMIÈRES DIVISIONS UNIQUEMENT ────────────────────────────────────────
//
// Décision du propriétaire, le 5 septembre 2026 : la sélection ne propose que
// des premières divisions. Championship, Serie B, 2. Bundesliga et Ligue 2 en
// ont été retirées le jour même — elles étaient entrées la veille et la
// sélection s'était mise à proposer de la 2. Bundesliga.
//
// Ce n'est pas une question de mesure : le Championship ressortait à 80,8 %,
// mieux que la Serie A. C'est une question de produit — ce que les abonnés
// veulent voir analysé.
/**
 * ── LES GRANDES COUPES D'EUROPE PASSENT DEVANT, PARTOUT ──────────────────
 *
 * ── CE QUI MANQUAIT, CONSTATÉ LE 10 SEPTEMBRE 2026 ──────────────────────
 *
 * La Ligue des champions ne figurait pas dans la liste ci-dessous. Le
 * pré-calcul ne la préparait donc jamais, et « Les matchs les mieux cernés »
 * ne pouvait pas la proposer : l'abonné y voyait la Bundesliga et la Super
 * League un soir de Ligue des champions.
 *
 * Or ce sont ces rencontres-là qu'il vient chercher. Et sur les deux journées
 * du 8 et du 9 septembre, l'application y a été juste sept fois sur dix, dont
 * un score exact — Sporting 3-1 Galatasaray.
 *
 * ── CE QUE CETTE LISTE DÉCIDE ───────────────────────────────────────────
 *
 * Elle sert au pré-calcul ET à la sélection : une compétition absente d'ici
 * n'est ni préparée, ni proposée. Les coupes y entrent donc, sans que rien
 * n'en sorte — les championnats restent tous là.
 *
 * L'ORDRE, lui, se décide par `rangDeCompetition` : la Ligue des champions
 * d'abord, les autres coupes européennes ensuite, puis tout le reste par
 * fiabilité mesurée.
 */
export const COUPES_EUROPE = [
  'UEFA Champions League',
  'UEFA Europa League',
  'UEFA Europa Conference League',
];

/**
 * Le rang d'affichage d'une compétition : plus il est petit, plus elle passe
 * devant. Employé par la sélection, par le carrousel et par le mur public,
 * pour qu'ils rangent tous les trois de la même façon.
 */
export function rangDeCompetition(nom: string | null | undefined): number {
  const n = String(nom ?? '').trim();
  if (n === 'UEFA Champions League') return 0;
  if (COUPES_EUROPE.includes(n)) return 1;
  return 2;
}

/**
 * ── UN NOM NE DÉSIGNE PAS UNE COMPÉTITION ────────────────────────────────
 *
 * ── CE QUI A ÉTÉ MESURÉ LE 10 SEPTEMBRE 2026 ────────────────────────────
 *
 * La sélection retenait une rencontre quand le NOM de sa compétition figurait
 * dans la liste ci-dessous. Or « Premier League » est aussi le nom du
 * championnat du Bhoutan, de l'Ouganda, du Ghana, du Botswana, de l'Égypte,
 * de Bahreïn, du Kirghizistan, de Hong-Kong et de Singapour ; « Ligue 1 »
 * celui de l'Algérie et de la Tunisie ; « Super League » celui de la
 * Malaisie, de l'Ouzbékistan et de la Chine.
 *
 * Sur les 366 rencontres d'une semaine réelle, **108 entraient par cette
 * porte — 29,5 %**. Le moteur les préparait, les proposait dans « les matchs
 * les mieux cernés », et annonçait un vainqueur dans des championnats dont il
 * n'a jamais lu une seule rencontre. On a vu RTC — Thimphu City et
 * Police — UPDF remonter dans la liste des candidats.
 *
 * C'est l'exact contraire de ce qui est demandé : quand le moteur dit qu'une
 * équipe gagne, cette équipe doit gagner.
 *
 * ── CE QU'ON RETIENT DÉSORMAIS ──────────────────────────────────────────
 *
 * Les compétitions que le moteur a RÉELLEMENT apprises, désignées par leur
 * numéro chez le fournisseur — un numéro ne se confond avec rien. La liste
 * est celle de `forme-occasions`, c'est-à-dire celle dont les forces
 * d'attaque et de défense sont mesurées sur les tirs.
 *
 * ── CE QUE ÇA AJOUTE, ET CE QUE ÇA RETIRE ───────────────────────────────
 *
 * Ça AJOUTE quatorze compétitions que le moteur connaît par cœur et que la
 * liste de noms ne mentionnait pas : Major League Soccer, Serie A
 * brésilienne, Championship, Liga Profesional Argentina, Segunda División,
 * Serie B, Ligue 2, Superliga danoise, Bundesliga autrichienne, First League
 * bulgare, première division chypriote, Premier League ukrainienne, Ligat
 * Ha'al, NB I.
 *
 * Ça ne retire QUE les homonymes jamais appris. Aucune compétition voulue ne
 * disparaît : la Liga I roumaine, nommée ici sans figurer dans le relevé des
 * tirs, est conservée explicitement.
 */
const LIGA_I_ROUMAINE = 283;

/**
 * Les numéros des coupes d'Europe, pour le chemin « championnat de chaque club ».
 *
 * Pris sur l'indicateur `europeenne` du relevé des occasions, jamais sur un
 * nom : le relevé les nomme en français (« Ligue des champions ») et la liste
 * d'affichage en anglais. Comparer les deux rendait un ensemble VIDE — défaut
 * attrapé à l'essai le 17 septembre 2026, avant toute mise en ligne.
 */
export const COUPES_EUROPE_IDS: ReadonlySet<number> = new Set<number>(
  COMPETITIONS_APPRISES.filter((c) => (c as { europeenne?: boolean }).europeenne === true).map(
    (c) => c.id
  )
);

export const IDS_PREPARES: ReadonlySet<number> = new Set<number>([
  ...COMPETITIONS_APPRISES.map((c) => c.id),
  LIGA_I_ROUMAINE,
]);

/**
 * Cette rencontre appartient-elle à une compétition que le moteur prépare ?
 *
 * On juge sur le NUMÉRO de la compétition, jamais sur son nom : c'est le seul
 * identifiant qui ne se confond pas d'un pays à l'autre.
 */
export function competitionRetenue(ligue: unknown): boolean {
  const id = Number((ligue as { id?: unknown } | null | undefined)?.id);
  return Number.isFinite(id) && IDS_PREPARES.has(id);
}

/**
 * Les noms, conservés : le rang d'affichage, les diagnostics et les scripts
 * s'en servent. Ce n'est plus ce qui décide de ce qu'on prépare — voir
 * `competitionRetenue` juste au-dessus.
 */
export const CHAMPIONNATS = [
  // Les coupes d'Europe en tête de liste — voir la note ci-dessus.
  ...COUPES_EUROPE,
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Primeira Liga',
  'Eredivisie',
  'Jupiler Pro League',
  
  
  
  
  'Süper Lig',
  'Super Lig',
  'Liga Portugal',
  'Premiership',
  'Super League',
  'Super League 1',
  'Ekstraklasa',
  'Allsvenskan',
  'Eliteserien',
  'Czech Liga',
  'Liga I',
  'HNL',
];

/** Au-delà, on s'arrête : le quota vaut plus qu'une sélection complète. */
const MAX_PAR_PASSAGE = 60;

/** Combien de journées à venir on prépare. */
const JOURS_A_PREPARER = 2;

/** Les statuts d'une rencontre pas encore jouée. */
const A_VENIR = ['NS', 'TBD'];

export interface BilanPrecalcul {
  examinees: number;
  calculees: number;
  dejaConnues: number;
  echecs: number;
  details: string[];
}

async function api(chemin: string): Promise<any[]> {
  const cle = process.env.API_FOOTBALL_KEY;
  if (!cle) return [];
  try {
    // ── SURTOUT PAS `cache: 'no-store'` ICI ──────────────────────────────
    //
    // L'entretien quotidien tourne dans le `after()` de la page des preuves,
    // une page régénérée toutes les dix minutes. Dans ce cadre, le moteur de
    // rendu REFUSE une requête marquée « sans cache » — il lève une erreur
    // de rendu dynamique, que le `catch` ci-dessous changeait en liste vide.
    // Constaté le 18 septembre 2026 dans les comptes rendus : « 0 calculée,
    // 0 déjà connue sur 0 examinée » CHAQUE JOUR depuis le 5 septembre. La
    // préparation n'avait jamais rien préparé en production.
    //
    // Sans option, comme `apiFootballFetch` dont le relevé des cotes se sert
    // chaque nuit avec succès, la requête part et rien n'est gardé en cache.
    const r = await fetch(`https://v3.football.api-sports.io/${chemin}`, {
      headers: { 'x-apisports-key': cle },
      // Sans option, une page régénérée garderait la réponse aussi longtemps
      // qu'elle-même. Cinq minutes au plus : un programme et des statistiques
      // ne bougent pas plus vite que cela.
      next: { revalidate: 300 },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.response ?? [];
  } catch (e: any) {
    // Jamais plus en silence : c'est ce silence qui a caché la panne.
    console.warn(`[PRECALCUL] Fournisseur illisible sur ${chemin} : ${e?.message}`);
    return [];
  }
}

/**
 * Prépare les rencontres à venir des grands championnats.
 *
 * Ne lève JAMAIS : cette préparation est un confort. Son échec doit laisser
 * l'application exactement dans l'état où elle était — la sélection se
 * contentera des rencontres déjà connues, comme avant.
 */
export async function precalculerGrandsMatchs(
  /**
   * Temps accordé aux calculs, en millisecondes.
   *
   * La préparation tourne au milieu de l'entretien quotidien, dans une
   * fonction que l'hébergeur coupe à soixante secondes ; les étapes qui la
   * suivent — dont la reconstruction du mur des preuves — ne partiraient
   * jamais si elle débordait. Mesuré le 17 septembre 2026 : 53 s pour 34
   * rencontres. Passé ce budget, on s'arrête proprement ; les rencontres
   * restantes sont préparées au passage suivant, ou par la première analyse.
   */
  budgetMs = 20_000,
  /**
   * Rafraîchir aussi des pronostics DÉJÀ figés, dans ces championnats, tant que
   * le coup d'envoi est à plus de vingt-quatre heures — la même règle que
   * l'analyse (`HEURES_AVANT_GEL_DEFINITIF`). Sert après une amélioration du
   * moteur : sans lui, les cartes du week-end garderaient l'ancien calcul.
   * Dans les vingt-quatre dernières heures, un pronostic ne bouge JAMAIS.
   */
  options: { rafraichirLigues?: ReadonlySet<number>; joursEnPlus?: number; maxParPassage?: number } = {}
): Promise<BilanPrecalcul> {
  const bilan: BilanPrecalcul = {
    examinees: 0,
    calculees: 0,
    dejaConnues: 0,
    echecs: 0,
    details: [],
  };

  try {
    const sb = createAdminClient();

    // Tous les identifiants déjà calculés, en une lecture paginée : Supabase
    // rend mille lignes et s'arrête sans le dire.
    const connus = new Set<number>();
    // Les probabilités figées, pour voir si le marché y est entré.
    const probasFigees = new Map<number, { dom: number; ext: number }>();
    for (let de = 0; de < 50_000; de += 1000) {
      const { data, error } = await sb
        .from('predictions_match')
        .select('fixture_id, proba_domicile, proba_exterieur')
        .range(de, de + 999);
      if (error) break;
      for (const p of data ?? []) {
        connus.add(Number(p.fixture_id));
        probasFigees.set(Number(p.fixture_id), { dom: Number(p.proba_domicile), ext: Number(p.proba_exterieur) });
      }
      if (!data || data.length < 1000) break;
    }

    // ── LES RÉSERVES PARTAGÉES ────────────────────────────────────────────
    //
    // Le classement et les forces valent pour TOUTES les rencontres d'un même
    // championnat. Les relire par match multiplierait le coût par vingt.
    const statsCache = new Map<string, any>();
    const classementCache = new Map<string, any[]>();
    const forcesCache = new Map<string, any>();

    const stats = async (ligue: number, saison: number, equipe: number) => {
      const cle = `${ligue}:${saison}:${equipe}`;
      if (!statsCache.has(cle)) {
        const r = await api(`teams/statistics?league=${ligue}&season=${saison}&team=${equipe}`);
        statsCache.set(cle, Array.isArray(r) ? r[0] : r);
      }
      return statsCache.get(cle);
    };

    const classement = async (ligue: number, saison: number) => {
      const cle = `${ligue}:${saison}`;
      if (!classementCache.has(cle)) {
        const r = await api(`standings?league=${ligue}&season=${saison}`);
        classementCache.set(cle, r?.[0]?.league?.standings?.[0] ?? []);
      }
      return classementCache.get(cle) ?? [];
    };

    const forces = async (ligue: number, saison: number) => {
      const cle = `${ligue}:${saison}`;
      if (!forcesCache.has(cle)) {
        forcesCache.set(cle, await lireForcesLigue(ligue, saison).catch(() => null));
      }
      return forcesCache.get(cle);
    };

    // ── LES RENCONTRES À PRÉPARER ─────────────────────────────────────────
    const aPreparer: any[] = [];
    const aRemplacer = new Set<number>();
    const GEL_DEFINITIF_MS = 24 * 3_600_000;

    // ── UN PRONOSTIC FIGÉ SANS LE MARCHÉ SE REFAIT QUAND LA COTE ARRIVE ────
    //
    // Constaté le 18 septembre 2026 : figé deux jours avant le match, un
    // pronostic l'était souvent AVANT que sa cote soit relevée — et restait
    // ainsi, sans sa couche la plus précise, jusqu'au coup d'envoi. Seul un
    // rafraîchissement lancé à la main le rattrapait.
    //
    // Avec le marché à pleine part, les probabilités figées collent à celles
    // du marché : écart médian 2 points, 4 points pour 90 % des matchs
    // (mesuré sur 90 rencontres figées ce jour-là). Au-delà de 8 points, le
    // marché n'y est pas entré : on refige — jamais à moins de vingt-quatre
    // heures du coup d'envoi.
    const ECART_SANS_MARCHE = 8;
    const cotesParJour = new Map<string, Map<number, any>>();
    const figeSansLeMarche = async (f: any): Promise<boolean> => {
      if (!avisDuMarcheBranche(f?.league?.id)) return false;
      const fige = probasFigees.get(Number(f?.fixture?.id));
      if (!fige) return false;
      const jour = String(f?.fixture?.date ?? '').slice(0, 10);
      if (!cotesParJour.has(jour)) {
        const r = await lireCotesDuJourPatiemment(jour).catch(() => null);
        cotesParJour.set(jour, new Map((r?.matchs ?? []).map((m) => [Number(m.id), m])));
      }
      const c = cotesParJour.get(jour)!.get(Number(f.fixture.id));
      if (!c?.proba) return false;
      const ecart = Math.max(Math.abs(fige.dom - 100 * c.proba.dom), Math.abs(fige.ext - 100 * c.proba.ext));
      return ecart > ECART_SANS_MARCHE;
    };
    for (let d = 0; d < JOURS_A_PREPARER + (options.joursEnPlus ?? 0); d++) {
      const jour = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
      for (const f of await api(`fixtures?date=${jour}`)) {
        if (!A_VENIR.includes(String(f?.fixture?.status?.short))) continue;
        // Un pronostic déjà figé par une analyse d'abonné, dans un championnat
        // que l'on rafraîchit, se refige lui aussi — même si la préparation
        // ne couvre pas ce championnat. Sans cela, Cottbus–St. Pauli
        // (2. Bundesliga), figé le 17 septembre avant que le marché ne
        // couvre cette ligue, gardait un vainqueur que le marché contredit.
        const dejaFigeARafraichir =
          connus.has(Number(f?.fixture?.id)) &&
          (options.rafraichirLigues?.has(Number(f?.league?.id)) === true || avisDuMarcheBranche(f?.league?.id));
        if (!competitionRetenue(f?.league) && !dejaFigeARafraichir) continue;
        bilan.examinees++;
        if (connus.has(Number(f?.fixture?.id))) {
          const loin = Date.parse(String(f?.fixture?.date ?? '')) - Date.now() > GEL_DEFINITIF_MS;
          // ── ET ON RECALCULE CE QUI A PU CHANGER DEPUIS LE GEL ─────────
          //
          // Un pronostic figé quarante-huit heures à l'avance ignore les
          // blessures annoncées la veille, et un changement d'entraîneur du
          // lendemain. On recalcule donc toute rencontre encore à plus de
          // vingt-quatre heures dans une compétition que le moteur enrichit —
          // et on ne réécrit QUE si le calcul d'aujourd'hui diverge vraiment
          // de celui qui est figé (voir `ECART_POUR_REFIGER` plus bas).
          const enrichie = avisDuMarcheBranche(f?.league?.id) || LIGUES_DES_ABSENCES.has(Number(f?.league?.id));
          if (loin && (options.rafraichirLigues?.has(Number(f?.league?.id)) || enrichie || (await figeSansLeMarche(f)))) {
            aRemplacer.add(Number(f.fixture.id));
            aPreparer.push(f);
            continue;
          }
          bilan.dejaConnues++;
          continue;
        }
        aPreparer.push(f);
      }
    }

    // Les rencontres les plus proches d'abord : ce sont celles qu'on ouvrira
    // en premier, et le plafond peut tomber avant la fin de la liste.
    aPreparer.sort((a, b) =>
      String(a?.fixture?.date ?? '').localeCompare(String(b?.fixture?.date ?? ''))
    );

    // Le relevé des occasions se lit UNE FOIS par passage, jamais par
    // rencontre : c'est le même pour toutes, et le relire soixante fois
    // coûterait soixante allers-retours pour un résultat identique.
    const releveOccasions = await lireForces();
    // La mémoire de tous les clubs, lue une fois pour toute la passe : elle ne
    // servira QUE sur les matchs dont le relevé des tirs ignore un club.
    const memoireDesClubs = await lireMemoireClubs();
    // Élan et terrain par championnat, lus une fois pour toute la passe.
    const elanEtTerrain = await lireElanEtTerrain();
    // La hiérarchie des championnats, lue une fois : elle ramène deux
    // championnats différents à la même échelle en coupe d'Europe.
    const forcesDesChampionnats = await lireForcesChampionnats().catch(() => null);
    // La seconde grille des scores, lue une fois pour toute la passe.
    const forcesPoisson = await lireForcesPoisson().catch(() => null);
    // Le poids des joueurs sert à toutes les rencontres : une seule lecture.
    // Les passages d'entraîneurs, lus une fois pour toutes les rencontres.
    const entraineurs = await lireEntraineurs().catch(() => null);

    // Le championnat domestique d'un club, comme le résout l'analyse : on ne
    // retient qu'une compétition de type « League », et la saison précédente
    // sert de recours quand la nouvelle n'est pas encore déclarée.
    const championnatCache = new Map<string, number | null>();
    const championnatDe = async (equipe: number, saison: number): Promise<number | null> => {
      const cle = String(equipe);
      if (championnatCache.has(cle)) return championnatCache.get(cle) ?? null;
      let trouve: number | null = null;
      for (const s2 of [saison, saison - 1]) {
        const r = await api(`leagues?team=${equipe}&season=${s2}`);
        const championnat = r.find((x: any) => x?.league?.type === 'League');
        if (championnat?.league?.id) { trouve = Number(championnat.league.id); break; }
      }
      championnatCache.set(cle, trouve);
      return trouve;
    };

    // Le budget court à partir d'ICI, et non de l'entrée de la fonction : la
    // lecture des pronostics déjà connus et du programme prend à elle seule
    // une vingtaine de secondes quand la base répond lentement, et la
    // préparation n'aurait alors JAMAIS rien calculé — constaté à l'essai le
    // 17 septembre 2026.
    const debutDesCalculs = Date.now();
    for (const f of aPreparer.slice(0, options.maxParPassage ?? MAX_PAR_PASSAGE)) {
      if (Date.now() - debutDesCalculs > budgetMs) {
        bilan.details.push(`budget de ${Math.round(budgetMs / 1000)} s atteint : la suite au prochain passage`);
        break;
      }
      const ligue = Number(f?.league?.id);
      const saison = Number(f?.league?.season);
      const domId = Number(f?.teams?.home?.id);
      const extId = Number(f?.teams?.away?.id);
      if (!ligue || !saison || !domId || !extId) {
        bilan.echecs++;
        continue;
      }

      const debutDeLaRencontre = Date.now();
      try {
        // ── EN COUPE D'EUROPE, ON LIT LE CHAMPIONNAT DE CHAQUE CLUB ──────
        //
        // Les statistiques de la coupe elle-même portent une ou deux
        // rencontres : elles ne décrivent rien. L'analyse résout donc le
        // championnat domestique de chacun, y prend ses statistiques et son
        // classement, puis corrige l'écart de niveau entre les deux
        // championnats. Cette préparation ne le faisait pas.
        //
        // Mesuré le 17 septembre 2026 sur les matchs joués depuis le 15 août
        // (`scripts/_fige-contre-analyse.mts`) : en championnat les deux
        // calculs font jeu égal (579 contre 577 bons vainqueurs), mais en
        // COUPES D'EUROPE l'analyse en trouve 96 contre 82 — et sur les 20
        // désaccords, elle avait raison 17 fois.
        const enCoupeDEurope = COUPES_EUROPE_IDS.has(ligue);
        const [ligueDom, ligueExt] = enCoupeDEurope
          ? await Promise.all([championnatDe(domId, saison), championnatDe(extId, saison)])
          : [ligue, ligue];
        const ligueStatsDom = ligueDom ?? ligue;
        const ligueStatsExt = ligueExt ?? ligue;

        // Les douze derniers matchs partent EN MÊME TEMPS que le reste : la
        // préparation tourne dans une fonction coupée à soixante secondes, et
        // deux appels mis à la suite allongeraient chaque rencontre.
        const [sDom, sExt, tableDom, tableExt, fl, recentsDom, recentsExt] = await Promise.all([
          stats(ligueStatsDom, saison, domId),
          stats(ligueStatsExt, saison, extId),
          classement(ligueStatsDom, saison),
          classement(ligueStatsExt, saison),
          forces(ligue, saison),
          api(`fixtures?team=${domId}&last=12`),
          api(`fixtures?team=${extId}&last=12`),
        ]);

        const brut = (s: any) => ({
          butsMarques: Number(s?.goals?.for?.total?.total ?? 0),
          butsEncaisses: Number(s?.goals?.against?.total?.total ?? 0),
          matchsJoues: Number(s?.fixtures?.played?.total ?? 0),
        });

        // Une équipe qui n'a joué aucun match ne donne rien d'exploitable :
        // le calcul sortirait des probabilités inventées, et la sélection les
        // servirait comme les autres.
        if (brut(sDom).matchsJoues < 1 || brut(sExt).matchsJoues < 1) {
          bilan.echecs++;
          continue;
        }

        // ── LE CLASSEMENT SE TRANSMET AVEC SA RÉFÉRENCE ────────────────
        //
        // `forceDepuisClassement` divise les points de l'équipe par la moyenne
        // du championnat. Sans `pointsMoyens`, elle rend 1 — c'est-à-dire
        // qu'elle ignore purement et simplement le classement, sans que rien
        // ne le signale. C'est ce que faisait le script de réparation, qui
        // transmettait `{ rang, points, total }` : trois champs, dont aucun
        // n'était celui attendu.
        // En coupe d'Europe, chaque club est classé dans SON championnat : les
        // deux tables sont donc distinctes, et les points moyens aussi.
        const rangDans = (lignes: any[], id: number) => {
          const r = lignes.find((x: any) => x?.team?.id === id);
          if (!r || !lignes.length) return null;
          const totalPoints = lignes.reduce((s2: number, x: any) => s2 + (Number(x?.points) || 0), 0);
          return {
            points: Number(r.points) || 0,
            pointsMoyens: totalPoints / lignes.length,
          };
        };
        const rang = (id: number) =>
          rangDans((id === domId ? tableDom : tableExt) as any[], id);

        const fDom = fl?.equipes?.get(domId);
        const fExt = fl?.equipes?.get(extId);
        const forcesDuMatch =
          fl?.fiable && fDom && fExt
            ? { equipe1: fDom, equipe2: fExt, butsDomicile: fl.butsDomicile, butsExterieur: fl.butsExterieur }
            : null;

        // Les occasions de CE match : `null` dès qu'un des deux clubs est
        // inconnu du relevé des tirs. On le garde pour savoir si le moteur
        // voit la rencontre ou non.
        const occasionsDuMatch = butsAttendusOccasions(releveOccasions, f?.teams?.home?.name, f?.teams?.away?.name);

        // ── LE MÊME MOTEUR QUE L'ANALYSE ─────────────────────────────────
        //
        // Jusqu'au 17 septembre 2026, cette préparation calculait SANS l'ancre
        // des douze derniers matchs ni les corrections d'élan, de terrain et de
        // repos, que la route d'analyse applique toutes. Or c'est elle qui fige
        // le pronostic jugé au mur des preuves. Mesuré sur 697 matchs joués
        // depuis le 1er septembre : 23 désaccords avec l'analyse lue par
        // l'abonné, 14 où l'analyse avait raison contre 4.
        //
        // Deux appels de plus au fournisseur par rencontre préparée, lancés
        // plus haut avec les autres.
        const coupDEnvoi = Date.parse(String(f?.fixture?.date ?? '')) || Date.now();
        const ancreDom = recentsDom.length ? statistiquesDepuisMatchs(recentsDom, String(domId)) : null;
        const ancreExt = recentsExt.length ? statistiquesDepuisMatchs(recentsExt, String(extId)) : null;
        const corrections = sommeDesCorrections(
          correctionElanTerrain(elanEtTerrain, f?.teams?.home?.name, f?.teams?.away?.name, ligue),
          correctionRepos(
            coupDEnvoi,
            derniereRencontreAvant(recentsDom, coupDEnvoi),
            derniereRencontreAvant(recentsExt, coupDEnvoi)
          )
        );

        const r = calculerScoreProbable(
          melangerStatistiques(brut(sDom), ancreDom),
          melangerStatistiques(brut(sExt), ancreExt),
          // L'équipe 1 est celle qui reçoit : c'est l'orientation de la table,
          // et s'en écarter inverserait tous les pronostics enregistrés.
          true,
          competitionPeuFiable(f?.league?.name ?? null),
          { equipe1: rang(domId), equipe2: rang(extId) },
          forcesDuMatch,
          // Le calibrage par championnat garde sa valeur d'origine.
          undefined,
          // ── DEUX CHAMPIONNATS, DEUX ÉCHELLES ─────────────────────────────
          //
          // La confiance est plafonnée quand les deux clubs ne viennent pas du
          // même championnat, et les buts attendus sont ramenés à la même
          // échelle par la hiérarchie des championnats. L'analyse le fait
          // depuis le 24 août 2026 ; cette préparation, non — elle annonçait
          // donc en coupe d'Europe une confiance qu'elle ne tenait pas.
          !!ligueDom && !!ligueExt && Number(ligueDom) !== Number(ligueExt),
          rapportEntreChampionnats(forcesDesChampionnats, ligueDom, ligueExt),
          // ── LA MÊME LECTURE QUE L'ANALYSE ──────────────────────────────
          //
          // Indispensable, et pas seulement souhaitable : la sélection du jour
          // affiche un score que l'abonné retrouve en ouvrant l'analyse. Si
          // l'un des deux voyait les occasions et pas l'autre, la carte
          // annoncerait un score que l'analyse contredirait.
          occasionsDuMatch,
          // Élan, terrain et repos : les mêmes corrections que l'analyse.
          corrections,
          // ── ET LÀ OÙ LE MOTEUR NE VOIT RIEN, LA MÉMOIRE PARLE ──────────
          //
          // Uniquement quand les occasions manquent — un club hors des sept
          // grands championnats. Le moteur garde son total de buts et reprend
          // l'avis de la mémoire sur qui domine, à 60 %. Mesuré sur 4 922
          // matchs aveugles : +31 vainqueurs justes, 71,8 et 68,1 % quand le
          // moteur est sûr de lui contre 63,7 %.
          // ── ET LÀ OÙ LE MOTEUR NE VOIT RIEN, LA MÉMOIRE PARLE ──────────
          //
          // Uniquement quand les occasions manquent — un club hors du relevé
          // des tirs. Chaque club y est ancré sur le niveau mesuré de son
          // championnat ; sans ancrage elle se tait. Mesuré sur 4 409 matchs
          // aveugles : +29 vainqueurs justes, et 72,0 / 68,9 % quand le moteur
          // est sûr de lui contre 64,0 %.
          // L'avis du marché d'abord, sur les sept grands championnats — le
          // même que l'analyse, voir `couche-marche.ts`.
          (await avisDuMarchePour(f?.fixture?.id, f?.fixture?.date, ligue)) ??
          (occasionsDuMatch
            ? null
            : avisDeLaMemoire(
                memoireDesClubs,
                domId,
                extId,
                // Pleine part sous cinq matchs connus dans la compétition.
                partDeLaMemoire(Math.min(brut(sDom).matchsJoues, brut(sExt).matchsJoues))
              )),
          // Le match retour et la seconde conviction restent éteints.
          null,
          null,
          // ── LE SCORE RELU PAR LA SECONDE GRILLE ────────────────────────
          //
          // La même que l'analyse : sans elle, la carte de la sélection
          // annoncerait un score que l'analyse contredirait. Elle ne départage
          // que les scores de l'issue déjà retenue.
          (() => {
            const buts = butsAttendusPourLeMatch(forcesPoisson, ligue, domId, extId);
            return buts ? { ...buts, poids: PART_GRILLE_SCORE } : null;
          })(),
          // Le nombre de buts selon le marché, comme l'analyse.
          await totalDuMarchePour(f?.fixture?.id, f?.fixture?.date, ligue),
          // Les absents ET l'entraîneur fraîchement arrivé, comme l'analyse.
          await coucheDesAbsences(
            f?.fixture?.id,
            ligue,
            saison,
            domId,
            extId,
            partDeLEntraineurNeuf(entraineurs, ligue, domId, f?.fixture?.date),
            partDeLEntraineurNeuf(entraineurs, ligue, extId, f?.fixture?.date)
          )
        );

        // ── ON NE RÉÉCRIT PAS POUR TROIS DIXIÈMES DE POINT ────────────────
        //
        // Réécrire un pronostic identique ferait « bouger » une carte sans
        // raison aux yeux de l'abonné, et changerait sa date de calcul pour
        // rien. On ne remplace que si le vainqueur annoncé change, ou si une
        // probabilité bouge de plus de cinq points.
        const ECART_POUR_REFIGER = 5;
        const dejaFige = probasFigees.get(Number(f.fixture.id));
        const remplace = aRemplacer.has(Number(f.fixture.id));
        if (remplace && dejaFige) {
          const vainqueurAvant = dejaFige.dom >= dejaFige.ext ? 'dom' : 'ext';
          const vainqueurMaintenant = r.probaVictoire1 >= r.probaVictoire2 ? 'dom' : 'ext';
          const bouge =
            vainqueurAvant !== vainqueurMaintenant ||
            Math.abs(dejaFige.dom - r.probaVictoire1) > ECART_POUR_REFIGER ||
            Math.abs(dejaFige.ext - r.probaVictoire2) > ECART_POUR_REFIGER;
          if (!bouge) {
            bilan.dejaConnues++;
            continue;
          }
          console.log(
            `[PRECALCUL] ${f?.teams?.home?.name} — ${f?.teams?.away?.name} refigé : ` +
              `${dejaFige.dom}/${dejaFige.ext} → ${r.probaVictoire1}/${r.probaVictoire2}`
          );
        }

        await (remplace ? remplacerPredictionFigee : figerPrediction)({
          fixtureId: Number(f.fixture.id),
          domicileId: domId,
          domicileNom: String(f?.teams?.home?.name ?? ''),
          exterieurId: extId,
          exterieurNom: String(f?.teams?.away?.name ?? ''),
          butsDomicile: r.buts1,
          butsExterieur: r.buts2,
          probaDomicile: r.probaVictoire1,
          probaNul: r.probaNul,
          probaExterieur: r.probaVictoire2,
          confiance: r.confiance,
          xgDomicile: r.butsAttendus1,
          xgExterieur: r.butsAttendus2,
          calculeeLe: new Date().toISOString(),
          // L'heure du coup d'envoi et la compétition, pour que la boucle
          // d'apprentissage sache quand ce match est jouable et appris.
          dateMatch: f?.fixture?.date ? String(f.fixture.date) : null,
          competition: f?.league?.name ? String(f.league.name) : null,
        });
        bilan.calculees++;
        // La durée de chaque rencontre, pour voir tout de suite ce qui ralentit
        // la préparation quand le budget est atteint sans que rien ne sorte.
        console.log(
          `[PRECALCUL] ${f?.teams?.home?.name} — ${f?.teams?.away?.name} ` +
            `(${f?.league?.name}) : ${r.buts1}-${r.buts2}, confiance ${r.confiance} ` +
            `en ${Date.now() - debutDeLaRencontre} ms`
        );
      } catch (e: any) {
        bilan.echecs++;
        bilan.details.push(`${f?.teams?.home?.name} : ${e?.message}`);
        console.warn(
          `[PRECALCUL] ${f?.teams?.home?.name} — ${f?.teams?.away?.name} A ÉCHOUÉ ` +
            `après ${Date.now() - debutDeLaRencontre} ms : ${e?.message}`
        );
      }
    }

    if (aPreparer.length > (options.maxParPassage ?? MAX_PAR_PASSAGE)) {
      bilan.details.push(
        `${aPreparer.length - (options.maxParPassage ?? MAX_PAR_PASSAGE)} rencontre(s) laissée(s) au prochain passage (plafond).`
      );
    }
  } catch (e: any) {
    bilan.details.push(`interrompu : ${e?.message}`);
  }

  return bilan;
}
