/**
 * LES MATCHS OÙ L'APPLICATION EST LA MEILLEURE, MIS DEVANT LES YEUX.
 *
 * ── LE PROBLÈME, TEL QUE LES CLIENTS L'ÉCRIVENT ───────────────────────────
 *
 * « Mais souvent profoot AI nous envoie en brousse hein » — sous une
 * publication, le 4 septembre 2026. Et le même jour, sur WhatsApp, un abonné :
 * « les deux jours là, ils ratent beaucoup ». Le propriétaire résume : « le
 * jour où ce n'est pas bon, ils oublient complètement les jours passés. Et ils
 * ont raison, parce qu'ils payent pour ça. »
 *
 * ── CE QUE LES CHIFFRES DISENT, ET QUI CHANGE TOUT ────────────────────────
 *
 * Mesuré sur 3 467 rencontres jugées, en classant chaque match par l'écart
 * entre son issue la plus probable et la suivante :
 *
 *     match très serré     867 matchs → 35,1 %
 *     léger favori       1 285 matchs → 47,5 %
 *     favori net           926 matchs → 55,9 %
 *     favori écrasant      389 matchs → 67,9 %
 *
 * Et croisé avec le championnat, sur les matchs nets : 74,6 % en Bundesliga,
 * 73,5 % en Primeira Liga, 73,0 % en Serie A.
 *
 * Autrement dit : il existe, tous les jours, des rencontres où l'application
 * tourne à trois sur quatre. Le problème n'est pas qu'elles n'existent pas —
 * c'est que le client ne sait pas les trouver. Il analyse au hasard, tombe sur
 * un derby serré à 35 %, et conclut que l'application ne vaut rien.
 *
 * Ce fichier ne rend pas le moteur meilleur. Il montre où il l'est déjà.
 *
 * ── CE QUE LA SÉLECTION NE DIT PAS ────────────────────────────────────────
 *
 * Ni le score, ni le vainqueur, ni les probabilités. Une sélection qui
 * révélerait le pronostic donnerait gratuitement ce que l'abonnement vend.
 * On annonce la FAMILLE du match — « favori écrasant » — et la fiabilité
 * observée sur cette famille. Le verdict reste derrière l'analyse.
 *
 * ── POURQUOI CERTAINS MATCHS N'Y SONT JAMAIS ──────────────────────────────
 *
 * Le classement a besoin des probabilités, qui vivent dans `predictions_match`
 * et n'existent donc que pour les rencontres déjà analysées au moins une fois.
 * Mesuré le 4 septembre 2026 : 101 des 1 535 matchs du lendemain, dont 58
 * nets ou écrasants. C'est peu en proportion, et bien assez pour une
 * sélection : les matchs analysés sont précisément ceux qui intéressent.
 */

import { createAdminClient } from './supabase-admin';
import { lireReserve, ecrireReserve } from './api-football';
import { lireReleve, fiabilitePour, trancheDe, TRANCHES } from './fiabilite-apprise';
import { getLiveTeams } from './teams-live';
import {
  CHAMPIONNATS,
  COMPETITIONS_DE_SELECTIONS_PREPAREES,
  competitionRetenue,
  rencontreRetenue,
  rangDeCompetition,
} from './precalcul-selection';
import { catalogueDeSelection } from './selections-du-catalogue';
import { clubs } from './data';
import type { EquipeDuJour } from './grands-matchs-du-jour';
import { lireForcesPoisson, avisPourLeMatch } from './forces-poisson';
import { avisDuMarcheBranche } from './couche-marche';
import { lireCotesDuJour } from './cotes-marche';

/** Une heure : la liste bouge quand un match commence, pas plus vite. */
const TTL = 60 * 60 * 1000;
/**
 * La clé porte un numéro de version, et c'est délibéré.
 *
 * La réserve survit aux déploiements. Le jour où la forme d'une carte change —
 * comme elle l'a fait quand les équipes sont passées au format du carrousel —
 * un contenu rangé sous l'ancienne forme serait servi tel quel au navigateur,
 * qui afficherait des cartes vides sans que rien n'échoue. Changer le numéro
 * met l'ancien contenu hors d'atteinte à la seconde du déploiement.
 */
const CLE = 'selection:du-jour-v2';

/**
 * ── LE SEUIL VISE LES QUATRE SUR CINQ ─────────────────────────────────────
 *
 * Il valait 58. Mesuré sur les 3 467 rencontres jugées, en classant par la
 * probabilité de l'issue annoncée :
 *
 *     50 à 60 %  → 58,5 % de réussite
 *     60 à 65 %  → 65,0 %
 *     65 à 70 %  → 68,5 %
 *     70 à 75 %  → 71,2 %
 *     75 % et +  → 76,0 %
 *
 * Et croisé avec le championnat au-dessus de 70 % : La Liga 83,3 %,
 * Eredivisie 82,4 %, Primeira Liga 80,0 %.
 *
 * À 70, la sélection ne retient plus que des rencontres où l'application a
 * réellement raison sept à huit fois sur dix. Elle en propose forcément moins
 * — c'est le prix, et c'est le bon prix : une sélection qui contiendrait des
 * matchs à 58 % ne serait pas une sélection.
 */
/** Angleterre, Espagne, Italie, Allemagne, France : les numéros du fournisseur. */
export const CINQ_GRANDS_CHAMPIONNATS: ReadonlySet<number> = new Set([39, 140, 135, 78, 61]);

export const FIABILITE_MINIMUM = 70;

/** Au-delà, ce n'est plus une sélection, c'est une liste. */
export const MAX_MATCHS = 6;

/**
 * ── COMBIEN DE RENCONTRES FAUT-IL POUR AFFICHER LA SECTION ────────────────
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 6 SEPTEMBRE 2026 ───────────────────────────
 *
 * Le propriétaire signale que « Les matchs les mieux cernés » a disparu de
 * l'écran d'analyse. Rien n'avait été retiré : la section était VIDE, ce qui
 * n'est pas la même chose.
 *
 * Le relevé du jour, mesuré :
 *
 *                              aujourd'hui   demain
 *     rencontres à venir            29          26
 *     avec un pronostic préparé     18          24
 *     atteignant les 70 %            1           1
 *
 * Le seuil en valait trois. Avec une seule rencontre qualifiée, la section
 * s'effaçait — et l'application donnait l'impression de ne rien avoir à
 * proposer, alors qu'elle avait précisément trouvé LA rencontre la mieux
 * cernée du jour, à 78 %.
 *
 * ── POURQUOI UN SEUL SUFFIT ─────────────────────────────────────────────
 *
 * Le raisonnement d'origine — « deux rencontres présentées comme les plus
 * sûres du jour donneraient l'impression qu'il n'y a rien à analyser » —
 * confondait deux choses. La section ne promet pas l'abondance, elle promet la
 * QUALITÉ : ce qui y figure a été mesuré au-dessus de 70 % de réussite sur les
 * rencontres de ce type déjà jouées.
 *
 * Un dimanche soir ou un lundi, le programme ne contient parfois qu'une seule
 * affiche vraiment lisible. La cacher pour cause de solitude prive l'abonné de
 * la meilleure information de sa journée, et lui laisse croire que le moteur
 * n'a rien trouvé.
 *
 * Le seuil de fiabilité, lui, ne bouge PAS : c'est lui qui porte la promesse.
 * On montre moins souvent plusieurs rencontres ; on ne montre jamais une
 * rencontre moins sûre.
 */
export const MINIMUM_POUR_AFFICHER = 1;

export interface MatchSelectionne {
  fixtureId: number;
  /**
   * Les deux équipes AU FORMAT DU CARROUSEL, et ce n'est pas un détail.
   *
   * Taper une carte doit emprunter exactement le même chemin qu'un match du
   * jour : mêmes identifiants internes, même fonction de sélection, même
   * décompte de quota. Une seconde façon de lancer une analyse finirait par
   * diverger de la première, et personne ne s'en apercevrait avant qu'un
   * client ne paie deux fois le même match.
   *
   * C'est aussi ce qui impose d'écarter toute rencontre dont une équipe est
   * inconnue du référentiel : elle s'afficherait, puis échouerait au clic.
   */
  dom: EquipeDuJour;
  ext: EquipeDuJour;
  championnat: string;
  /** L'instant du coup d'envoi, mis à l'heure du lecteur par le navigateur. */
  kickoffISO: string;
  /** « Favori écrasant », « Favori net »… */
  famille: string;
  /** Part de pronostics justes observée sur cette famille de matchs. */
  fiabilite: number;
  /** Sur combien de rencontres cette part est mesurée. */
  mesureeSur: number;
  /** Le championnat quand le chiffre en vient, sinon `null`. */
  ligueMesuree: string | null;
}

export interface SelectionDuJour {
  matchs: MatchSelectionne[];
  /** Faux quand la sélection porte sur demain, faute de matchs aujourd'hui. */
  aujourdhui: boolean;
  calculeeLe: string;
}

const VIDE: SelectionDuJour = { matchs: [], aujourdhui: true, calculeeLe: '' };

/** Les statuts qui désignent une rencontre pas encore jouée. */
const A_VENIR = ['NS', 'TBD'];

/**
 * Les rencontres pas encore jouées d'une journée.
 *
 * Exportée pour que « Les certitudes du jour » lisent EXACTEMENT la même
 * liste : deux façons de savoir quels matchs se jouent aujourd'hui finiraient
 * par diverger, et l'abonné verrait une certitude sur un match absent de la
 * sélection, ou l'inverse.
 */
export async function fixturesDuJour(jour: string): Promise<any[]> {
  const cle = process.env.API_FOOTBALL_KEY;
  if (!cle) return [];
  try {
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, {
      headers: { 'x-apisports-key': cle },
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.response ?? []).filter((f: any) => A_VENIR.includes(f?.fixture?.status?.short));
  } catch {
    return [];
  }
}

/** Les pronostics déjà calculés, par identifiant de rencontre. */
async function pronosticsConnus(): Promise<Map<number, any>> {
  const sb = createAdminClient();
  const sortie = new Map<number, any>();
  for (let de = 0; de < 50_000; de += 1000) {
    const { data, error } = await sb
      .from('predictions_match')
      .select('fixture_id, proba_domicile, proba_nul, proba_exterieur, calculee_le')
      .range(de, de + 999);
    if (error) break;
    for (const p of data ?? []) {
      const id = Number(p.fixture_id);
      if (!Number.isFinite(id)) continue;
      // Le pronostic le plus récent gagne : les forces des équipes bougent
      // d'un jour à l'autre, et c'est le dernier calcul qui fait foi.
      const connu = sortie.get(id);
      if (!connu || String(p.calculee_le) > String(connu.calculee_le)) sortie.set(id, p);
    }
    if (!data || data.length < 1000) break;
  }
  return sortie;
}

async function calculer(): Promise<SelectionDuJour> {
  const releve = await lireReleve();
  if (!releve) return VIDE;

  const pronostics = await pronosticsConnus();
  if (!pronostics.size) return VIDE;

  // Sans référentiel, aucune carte ne serait cliquable : mieux vaut ne rien
  // proposer que proposer ce qui échouera.
  const equipes = await getLiveTeams().catch(() => []);
  const parApiId = new Map(equipes.map((e: any) => [e.apiId, e]));
  if (!parApiId.size) return VIDE;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // La seconde lecture du match, lue une fois : elle sert à CLASSER les
  // rencontres retenues, jamais à changer le vainqueur annoncé.
  const forcesPoisson = await lireForcesPoisson().catch(() => null);

  // Les rencontres cotées avant le match, par jour : le marché est alors DÉJÀ
  // dans le pronostic du moteur (voir `couche-marche.ts`).
  const cotesParJour = new Map<string, Set<number>>();
  const estCotee = async (fixtureId: number, coupDEnvoi: string, ligue: number): Promise<boolean> => {
    if (!avisDuMarcheBranche(ligue)) return false;
    const jour = String(coupDEnvoi).slice(0, 10);
    if (!cotesParJour.has(jour)) {
      const r = await lireCotesDuJour(jour).catch(() => null);
      cotesParJour.set(jour, new Set((r?.matchs ?? []).map((m) => Number(m.id))));
    }
    return cotesParJour.get(jour)!.has(Number(fixtureId));
  };

  /** Compose la sélection d'une journée donnée. */
  const pourLeJour = async (jour: string): Promise<MatchSelectionne[]> => {
    const retenus: MatchSelectionne[] = [];
    // La note de classement de chaque rencontre retenue, par identifiant.
    const noteDe = new Map<number, number>();
    // ── LES CINQ GRANDS CHAMPIONNATS PASSENT DEVANT LES AUTRES ──────────
    //
    // Demande du propriétaire, répétée le 20 septembre 2026 : « ton focus doit
    // être sur les plus gros championnats européens. Angleterre, Espagne,
    // France, Allemagne, Italie. » La sélection mettait en avant Chypre, la
    // Serbie et la Croatie — des favoris écrasants, très prévisibles, mais que
    // personne ne vient chercher ici.
    //
    // Mesuré sur 3 402 rencontres cotées depuis août 2024, à seuil de
    // certitude égal (65 %) : la justesse passe de 78,5 % à 76,8 % — 1,7 point
    // — et les journées 100 % justes MONTENT, de 58 % à 62 %.
    //
    // Les jours sans rencontre sûre dans les cinq grands, les autres
    // championnats reprennent leur place : la section n'est jamais vide.
    const rangDe = new Map<number, number>();
    for (const f of await fixturesDuJour(jour)) {
      // ── PREMIÈRES DIVISIONS SEULEMENT ─────────────────────────────
      //
      // Décision du propriétaire, le 5 septembre 2026. Le pré-calcul a cessé
      // de préparer les deuxièmes divisions le jour même, mais leurs
      // pronostics restent en base — calculés la veille — et la sélection
      // continuait de proposer de la 2. Bundesliga.
      //
      // La liste est celle du pré-calcul : une seule source, pour que ce
      // qu'on prépare et ce qu'on propose ne divergent jamais.
      //
      // ── ET ON JUGE SUR LE NUMÉRO, PAS SUR LE NOM ──────────────────────
      //
      // « Premier League » est aussi le nom du championnat du Bhoutan, de
      // l'Ouganda et de sept autres pays ; « Ligue 1 » celui de l'Algérie.
      // Mesuré le 10 septembre 2026 : 108 rencontres sur 366 entraient par
      // cette porte, et la sélection annonçait un vainqueur dans des
      // championnats dont le moteur n'a jamais lu une rencontre.
      if (!rencontreRetenue(f)) continue;

      const p = pronostics.get(Number(f?.fixture?.id));
      if (!p || p.proba_domicile == null) continue;

      // ── LES SÉLECTIONS NE SONT PAS DANS LE RÉFÉRENTIEL DES CLUBS ───────
      //
      // Constaté le 22 septembre 2026 : les rencontres de CAN, préparées avec
      // la note Elo des sélections, n'avaient ici aucune équipe et ne
      // pouvaient jamais être proposées. Dans une compétition de sélections,
      // on prend la sélection du catalogue, par son numéro vérifié.
      const enSelections = COMPETITIONS_DE_SELECTIONS_PREPAREES.has(Number(f?.league?.id));
      const equipeDe = (apiId: unknown): any =>
        enSelections ? clubs[catalogueDeSelection(apiId as number) ?? ''] : parApiId.get(Number(apiId));
      const dom: any = equipeDe(f?.teams?.home?.id);
      const ext: any = equipeDe(f?.teams?.away?.id);
      if (!dom || !ext) continue;

      const kickoff = String(f?.fixture?.date ?? '');
      if (!kickoff) continue;

      // Ligue des champions 0, autres coupes d'Europe 1, les cinq grands
      // championnats 2, le reste 3.
      const rangNom = rangDeCompetition(String(f?.league?.name ?? ''));
      rangDe.set(
        Number(f.fixture.id),
        rangNom < 2 ? rangNom : CINQ_GRANDS_CHAMPIONNATS.has(Number(f?.league?.id)) ? 2 : 3
      );

      const fiab = fiabilitePour(
        releve,
        Number(p.proba_domicile),
        Number(p.proba_nul),
        Number(p.proba_exterieur),
        f?.league?.name,
        f?.league?.country ?? null
      );
      if (!fiab || fiab.taux < FIABILITE_MINIMUM) continue;

      // ── LA NOTE DE CLASSEMENT : LA MOYENNE DES DEUX LECTURES ───────────
      //
      // Le moteur désigne le vainqueur, et c'est lui qu'on affiche. Mais pour
      // choisir QUELLES rencontres mettre en avant, on prend la moyenne de sa
      // conviction et de celle du modèle de Poisson pour ce même vainqueur :
      // un match où les deux lectures s'accordent passe devant un match où
      // le moteur est seul à y croire.
      //
      // Mesuré le 18 septembre 2026 sur 5 756 rencontres des grands
      // championnats et des coupes d'Europe, Ligue des champions d'abord comme
      // ici, face au classement par fiabilité (pourtant avantagé : son relevé
      // recoupe ces matchs) :
      //
      //     3 par jour   65,4 % → 66,8 %   journées parfaites 133 → 147
      //     5 par jour   64,3 % → 66,2 %   journées parfaites  44 →  50
      //
      // Positif dans les trois périodes de contrôle. Sans avis du modèle, la
      // conviction du moteur seule sert de note.
      {
        const pd = Number(p.proba_domicile);
        const pe = Number(p.proba_exterieur);
        const recoit = pd >= pe;
        const moteur = (recoit ? pd : pe) / 100;
        // ── MAIS QUAND LE MARCHÉ EST DÉJÀ DANS LE PRONOSTIC, LE MOTEUR SEUL ──
        //
        // Depuis le 18 septembre 2026, sur les sept grands championnats, le
        // pronostic du moteur intègre l'avis du marché. Y ajouter encore le
        // modèle de Poisson dilue une conviction devenue meilleure que lui.
        // Mesuré sur 5 756 rencontres : 3 par jour 68,2 → 69,0 % (journées
        // parfaites 154 → 163), 5 par jour 67,6 → 68,9 % (52 → 59), meilleur ou
        // égal dans les trois périodes.
        const cotee = await estCotee(Number(f.fixture.id), kickoff, Number(f?.league?.id));
        const avis = cotee ? null : avisPourLeMatch(forcesPoisson, f?.league?.id, f?.teams?.home?.id, f?.teams?.away?.id);
        const modele = avis ? (recoit ? avis.dom : avis.ext) : moteur;
        noteDe.set(Number(f.fixture.id), (moteur + modele) / 2);
      }

      retenus.push({
        fixtureId: Number(f.fixture.id),
        dom: {
          id: dom.id,
          name: dom.name,
          logo: dom.logo || String(f?.teams?.home?.logo ?? ''),
          country: dom.country,
          league: dom.league,
          stadium: dom.stadium,
        },
        ext: {
          id: ext.id,
          name: ext.name,
          logo: ext.logo || String(f?.teams?.away?.logo ?? ''),
          country: ext.country,
          league: ext.league,
          stadium: ext.stadium,
        },
        championnat: String(f?.league?.name ?? ''),
        kickoffISO: kickoff,
        famille: fiab.famille,
        fiabilite: fiab.taux,
        mesureeSur: fiab.matchs,
        ligueMesuree: fiab.ligue,
      });
    }

    // ── LA LIGUE DES CHAMPIONS PASSE DEVANT ─────────────────────────────
    //
    // Décision du propriétaire, 10 septembre 2026 : c'est la compétition que
    // l'abonné vient chercher, et celle où l'application a été la plus juste —
    // sept fois sur dix les 8 et 9 septembre, dont un score exact.
    //
    // Elle ne remplace rien : les championnats restent tous proposés, ils
    // passent simplement après. Le seuil de fiabilité, lui, ne bouge pas —
    // une rencontre de Ligue des champions mal cernée n'entre pas ici pour
    // autant.
    //
    // À rang égal, la plus haute fiabilité d'abord ; puis le match le plus
    // proche — une rencontre dans une heure vaut mieux qu'une rencontre à
    // minuit.
    retenus.sort(
      (a, b) =>
        (rangDe.get(a.fixtureId) ?? rangDeCompetition(a.championnat)) -
          (rangDe.get(b.fixtureId) ?? rangDeCompetition(b.championnat)) ||
        (noteDe.get(b.fixtureId) ?? b.fiabilite / 100) - (noteDe.get(a.fixtureId) ?? a.fiabilite / 100) ||
        a.kickoffISO.localeCompare(b.kickoffISO)
    );
    // ── ON NE MET EN AVANT QUE CE DONT ON EST SÛR ─────────────────────────
    //
    // Demande du propriétaire, répétée : « quand il dit telle équipe gagne,
    // que telle équipe gagne ». Or la sélection prenait les MEILLEURS du
    // jour, même quand les meilleurs du jour étaient à 52 %.
    //
    // Mesuré le 20 septembre 2026 sur 3 402 rencontres des cinq grands
    // championnats depuis août 2024, cotes d'avant-match comprises, en ne
    // gardant que les rencontres annoncées à 65 % ou plus :
    //
    //     3 par jour   66,2 % → 77,5 %   journées 100 % justes  35 % → 61 %
    //     5 par jour   64,0 % → 77,0 %   journées 100 % justes  19 % → 56 %
    //
    // Le seuil descend par paliers plutôt que de vider la section : une
    // journée creuse montre moins de matchs, et des matchs moins sûrs, mais
    // jamais rien du tout — le repli final est exactement l'ancien tri.
    //
    // ── LE NUL, MESURÉ LE 21 SEPTEMBRE 2026, ET ÉCARTÉ ────────────────────
    //
    // Le constat de départ est vrai et il est gros : sur 3 548 rencontres des
    // cinq grands championnats, **54,6 % des pronostics ratés finissent par un
    // nul**. C'est la première cause d'erreur du moteur, loin devant la
    // victoire de l'autre camp.
    //
    // Et le danger se lit AVANT le match, par la part que le nul prend dans ce
    // qui reste une fois le favori retiré — `nul / (1 − favori)`, qui ne dépend
    // pas mécaniquement du niveau de certitude :
    //
    //                          le nul domine le reste   l'autre a sa chance
    //     certitude 60 %+           73,6 % justes            66,7 %
    //     certitude 65 %+           75,6 %                   71,9 %
    //
    // Jamais inversé sur trois tranches. Deux façons de s'en servir ont été
    // essayées, et toutes deux REJETÉES sur la sélection telle qu'elle sort :
    //
    //   • COMPLÉTER la sélection avec les rencontres à 60 % où le nul domine.
    //     La bande réellement ajoutée — 60 à 65 % — n'est juste qu'à 64,0 %
    //     (56,8 puis 71,1 % sur les deux moitiés), sous les 70 % promis.
    //     Simulé sur 320 journées : 72,8 → 71,9 % de justesse, journées
    //     parfaites 50,3 → 46,9 %. La mesure à « 60 %+ » incluait les 65 %+,
    //     et c'est ce mélange qui donnait l'illusion.
    //
    //   • N'AFFICHER que les rencontres où le nul domine. À plafond égal, la
    //     justesse gagne 0,2 à 0,6 point et les journées parfaites montent —
    //     mais un tiers des cartes disparaît, et le gain de « journées
    //     parfaites » vient surtout de là. Payer trente pour cent de la
    //     section pour un demi-point n'est pas un échange raisonnable.
    //
    // Le classement, lui, prend déjà les plus certaines, et les plus certaines
    // sont déjà celles où le nul domine : le signal est réel, il est
    // simplement DÉJÀ consommé par le seuil de certitude.
    const PALIERS_DE_CERTITUDE = [0.65, 0.55];
    for (const seuil of PALIERS_DE_CERTITUDE) {
      const surs = retenus.filter((r) => (noteDe.get(r.fixtureId) ?? 0) >= seuil);
      if (surs.length >= MINIMUM_POUR_AFFICHER) return surs.slice(0, MAX_MATCHS);
    }
    // Aucune rencontre sûre nulle part : on garde l'ancien tri, grands
    // championnats devant.
    return retenus.slice(0, MAX_MATCHS);
  };

  const duJour = await pourLeJour(aujourdhui);
  if (duJour.length >= MINIMUM_POUR_AFFICHER) {
    return { matchs: duJour, aujourdhui: true, calculeeLe: new Date().toISOString() };
  }

  // ── PLUTÔT DEMAIN QU'UNE SECTION VIDE ───────────────────────────────────
  //
  // Passé le dernier coup d'envoi, il ne reste rien à proposer aujourd'hui.
  // Un abonné qui ouvre l'application le soir doit y trouver le programme du
  // lendemain, pas un blanc — c'est précisément l'heure où il prépare sa
  // journée.
  const deDemain = await pourLeJour(demain);
  if (deDemain.length >= MINIMUM_POUR_AFFICHER) {
    return { matchs: deDemain, aujourdhui: false, calculeeLe: new Date().toISOString() };
  }

  // ── ET SI LE CALENDRIER EST EN TRÊVE, ON VA CHERCHER PLUS LOIN ──────────
  //
  // Le 20 septembre 2026, le programme des grands championnats reprenait le
  // 9 octobre : ni aujourd'hui ni demain n'avaient la moindre rencontre, et la
  // section restait vide trois semaines durant. Un bloc vide sur la page la
  // plus consultée se lit comme une panne — et un abonné qui trouve une page
  // en panne ne revient pas.
  //
  // On demande donc au fournisseur les prochaines rencontres des grandes
  // compétitions, et on compose la sélection du PREMIER jour qui en contient.
  try {
    const { getUpcomingFixtures } = await import('./api-football');
    const prochaines = (await getUpcomingFixtures(5)) ?? [];
    // ── LES QUATRE JOURS QUI SUIVENT, AUSSI ──────────────────────────────
    //
    // Le 22 septembre 2026, les grands championnats reprenaient le 9 octobre,
    // mais les Ligues des nations et la CAN se jouaient dès le 24. La liste
    // ci-dessus ne connaît que les grands championnats : la section montrait
    // donc des matchs à dix-sept jours et sautait les sélections du
    // surlendemain, déjà préparées. Les jours proches passent en premier.
    const prochainsJours = [2, 3, 4, 5].map((d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10));
    const joursAVenir = [
      ...new Set([
        ...prochainsJours,
        ...prochaines.map((f: any) => String(f?.fixture?.date ?? '').slice(0, 10)).filter(Boolean),
      ]),
    ].sort();
    for (const jour of joursAVenir.slice(0, 7)) {
      if (jour <= demain) continue;
      const liste = await pourLeJour(jour);
      if (liste.length >= MINIMUM_POUR_AFFICHER) {
        return { matchs: liste, aujourdhui: false, calculeeLe: new Date().toISOString() };
      }
    }
  } catch (e: any) {
    console.warn('[SÉLECTION] Prochaines journées illisibles :', e?.message);
  }

  return VIDE;
}

/** La sélection, depuis la réserve quand elle est fraîche. */
export async function lireSelectionDuJour(): Promise<SelectionDuJour> {
  try {
    const cache = await lireReserve<SelectionDuJour>(CLE);
    if (cache && !cache.expiree) {
      // Une rencontre commencée depuis la mise en réserve n'a plus rien à
      // faire dans une sélection : on la retire à la lecture, sans tout
      // recalculer.
      const maintenant = Date.now();
      const encore = (cache.contenu.matchs ?? []).filter(
        (m) => !m.kickoffISO || Date.parse(m.kickoffISO) > maintenant
      );
      if (encore.length >= MINIMUM_POUR_AFFICHER) return { ...cache.contenu, matchs: encore };
    }

    const selection = await calculer();
    await ecrireReserve(CLE, selection, TTL);
    return selection;
  } catch (e: any) {
    console.warn('[SÉLECTION] Indisponible :', e?.message);
    // L'écran d'analyse doit vivre sans elle : elle ajoute, elle ne porte rien.
    return VIDE;
  }
}

/** Exporté pour les tests : la famille d'un match, sans passer par la base. */
export { trancheDe, TRANCHES };
