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
import { CHAMPIONNATS, rangDeCompetition } from './precalcul-selection';
import type { EquipeDuJour } from './grands-matchs-du-jour';

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

  /** Compose la sélection d'une journée donnée. */
  const pourLeJour = async (jour: string): Promise<MatchSelectionne[]> => {
    const retenus: MatchSelectionne[] = [];
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
      if (!CHAMPIONNATS.includes(String(f?.league?.name ?? ''))) continue;

      const p = pronostics.get(Number(f?.fixture?.id));
      if (!p || p.proba_domicile == null) continue;

      const dom: any = parApiId.get(Number(f?.teams?.home?.id));
      const ext: any = parApiId.get(Number(f?.teams?.away?.id));
      if (!dom || !ext) continue;

      const kickoff = String(f?.fixture?.date ?? '');
      if (!kickoff) continue;

      const fiab = fiabilitePour(
        releve,
        Number(p.proba_domicile),
        Number(p.proba_nul),
        Number(p.proba_exterieur),
        f?.league?.name
      );
      if (!fiab || fiab.taux < FIABILITE_MINIMUM) continue;

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
        rangDeCompetition(a.championnat) - rangDeCompetition(b.championnat) ||
        b.fiabilite - a.fiabilite ||
        a.kickoffISO.localeCompare(b.kickoffISO)
    );
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
