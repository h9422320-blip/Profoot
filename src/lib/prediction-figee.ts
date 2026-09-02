/**
 * La prédiction de référence d'un match.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 16 août 2026, Lens — Paris Saint-Germain a été analysé quarante fois avant
 * le coup d'envoi. Trente-six analyses annonçaient une victoire du PSG, quatre
 * annonçaient Lens. Deux abonnés du même match recevaient donc des réponses
 * contraires, selon le moment où ils cliquaient.
 *
 * La cause n'était pas le calcul : c'était la DISPONIBILITÉ DES DONNÉES. Quand
 * l'appel au fournisseur échouait — ce jour-là le quota était à 98 % —,
 * l'application ne trouvait plus la rencontre, ignorait donc qui recevait, et
 * supprimait silencieusement l'avantage du terrain. Sur deux équipes proches,
 * ces quinze pour cent suffisent à inverser le favori. Lens jouait chez lui, à
 * Bollaert : les quatre analyses complètes ont vu juste, les trente-six autres
 * ont désigné le PSG.
 *
 * CE QUE FAIT CE MODULE
 *
 * Le premier calcul COMPLET d'une rencontre devient sa prédiction de référence.
 * Tous les suivants la relisent au lieu de recalculer. Une rencontre a une
 * prédiction, et une seule, jusqu'au coup d'envoi.
 *
 * Une prédiction incomplète — celle qui ignore qui reçoit — n'est jamais
 * enregistrée. Elle ne peut donc pas écraser une prédiction juste.
 *
 * LE SENS DE STOCKAGE
 *
 * Toujours l'équipe qui REÇOIT en premier, quel que soit l'ordre dans lequel
 * l'utilisateur a saisi les deux clubs. C'est le seul repère qui ne dépende pas
 * de qui pose la question — et c'est l'absence d'un tel repère qui a produit le
 * désordre.
 */

import { createAdminClient } from './supabase-admin';

export interface PredictionFigee {
  fixtureId: number;
  domicileId: number;
  domicileNom: string;
  exterieurId: number;
  exterieurNom: string;
  butsDomicile: number;
  butsExterieur: number;
  probaDomicile: number;
  probaNul: number;
  probaExterieur: number;
  confiance: number;
  xgDomicile: number | null;
  xgExterieur: number | null;
  calculeeLe: string;
}

/** Ce qu'on lit, remis dans l'ordre de saisie de l'utilisateur. */
export interface PredictionOrientee {
  buts1: number;
  buts2: number;
  probaVictoire1: number;
  probaNul: number;
  probaVictoire2: number;
  confiance: number;
  butsAttendus1: number | null;
  butsAttendus2: number | null;
  calculeeLe: string;
}

export async function lirePredictionFigee(
  fixtureId: number | null | undefined,
  idEquipe1: number | string | null | undefined
): Promise<PredictionOrientee | null> {
  if (!fixtureId || !idEquipe1) return null;

  try {
    const { data, error } = await createAdminClient()
      .from('predictions_match')
      .select('*')
      .eq('fixture_id', fixtureId)
      .maybeSingle();

    if (error || !data) return null;

    // L'utilisateur a-t-il saisi l'équipe qui reçoit en premier ? Sinon, tout
    // est renvoyé miroir — sans jamais recalculer.
    const equipe1EstDomicile = String(data.domicile_id) === String(idEquipe1);

    return equipe1EstDomicile
      ? {
          buts1: data.buts_domicile,
          buts2: data.buts_exterieur,
          probaVictoire1: data.proba_domicile,
          probaNul: data.proba_nul,
          probaVictoire2: data.proba_exterieur,
          confiance: data.confiance,
          butsAttendus1: data.xg_domicile,
          butsAttendus2: data.xg_exterieur,
          calculeeLe: data.calculee_le,
        }
      : {
          buts1: data.buts_exterieur,
          buts2: data.buts_domicile,
          probaVictoire1: data.proba_exterieur,
          probaNul: data.proba_nul,
          probaVictoire2: data.proba_domicile,
          confiance: data.confiance,
          butsAttendus1: data.xg_exterieur,
          butsAttendus2: data.xg_domicile,
          calculeeLe: data.calculee_le,
        };
  } catch {
    // Sans réserve accessible, on recalcule : mieux vaut une prédiction que
    // rien du tout.
    return null;
  }
}

/**
 * La prédiction telle qu'elle est stockée : l'équipe qui reçoit en premier.
 *
 * Sert au mur de preuves, qui connaît les équipes par leur NOM et non par leur
 * identifiant chez le fournisseur.
 */
export async function lirePredictionBrute(
  fixtureId: number | null | undefined
): Promise<{ domicileNom: string; butsDomicile: number; butsExterieur: number } | null> {
  if (!fixtureId) return null;
  try {
    const { data, error } = await createAdminClient()
      .from('predictions_match')
      .select('domicile_nom, buts_domicile, buts_exterieur')
      .eq('fixture_id', fixtureId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      domicileNom: data.domicile_nom,
      butsDomicile: data.buts_domicile,
      butsExterieur: data.buts_exterieur,
    };
  } catch {
    return null;
  }
}

/**
 * Fige la prédiction d'une rencontre, si elle n'existe pas déjà.
 *
 * `onConflict do nothing` : la PREMIÈRE prédiction complète fait foi. Une
 * seconde ne doit pas la remplacer, sinon deux abonnés à dix minutes
 * d'intervalle verraient de nouveau deux choses différentes.
 */
/**
 * UNE PRÉDICTION FIGÉE QUI N'AVAIT DÉPARTAGÉ PERSONNE N'EN EST PAS UNE.
 *
 * ── POURQUOI CETTE EXCEPTION AU PRINCIPE ──────────────────────────────────
 *
 * Le principe de ce fichier est intransigeant, et il a raison de l'être : un
 * pronostic n'est un pronostic que s'il ne bouge pas. Deux abonnés du même
 * match doivent lire la même chose, quelle que soit l'heure de leur clic.
 *
 * Mais le 2 septembre 2026, l'écran affichait ceci sur Real Betis — Real
 * Madrid :
 *
 *     buts attendus   1,40  contre  1,40
 *     probabilités      36  ·  28  ·  36
 *     score annoncé          2 - 1        pour le Betis
 *
 * Enregistré le 29 août, quand la Liga avait joué trois journées. Le calcul
 * n'avait rien départagé : deux victoires à trente-six, des buts attendus
 * rigoureusement identiques. Le score annoncé venait d'un « supérieur ou
 * égal » qui avait tranché à la place du modèle.
 *
 * Trois jours plus tard, avec la matière accumulée, le même calcul donne
 * 0-2 pour le Real Madrid, à 84 %. Et pendant ce temps le texte de l'analyse,
 * la forme récente et le classement encensaient tous le Real Madrid, sous un
 * score qui le donnait perdant.
 *
 * ── LA RÈGLE, ÉTROITE ─────────────────────────────────────────────────────
 *
 * On ne remplace QUE les lignes où le calcul n'avait rien décidé — les deux
 * victoires à moins de quatre points l'une de l'autre. Une prédiction qui
 * désignait franchement un favori ne bouge jamais, même si elle se révèle
 * fausse : c'est tout l'intérêt de la figer.
 */
const ECART_INDECIS = 4;

export function predictionIndecise(p: {
  probaVictoire1: number;
  probaVictoire2: number;
  buts1: number;
  buts2: number;
}): boolean {
  // Un score de parité annoncé sur des probabilités serrées est cohérent : il
  // dit exactement ce que le calcul a trouvé. Seul le vainqueur non départagé
  // pose problème.
  if (p.buts1 === p.buts2) return false;
  return Math.abs(Number(p.probaVictoire1) - Number(p.probaVictoire2)) < ECART_INDECIS;
}

/**
 * Remplace une prédiction figée par un calcul qui, lui, a tranché.
 *
 * Ne lève jamais : l'analyse en cours doit aboutir même si la réparation
 * échoue — elle servira simplement les chiffres frais sans les enregistrer.
 */
export async function remplacerPredictionFigee(p: PredictionFigee): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .from('predictions_match')
      .update({
        domicile_id: p.domicileId,
        domicile_nom: p.domicileNom,
        exterieur_id: p.exterieurId,
        exterieur_nom: p.exterieurNom,
        buts_domicile: p.butsDomicile,
        buts_exterieur: p.butsExterieur,
        proba_domicile: p.probaDomicile,
        proba_nul: p.probaNul,
        proba_exterieur: p.probaExterieur,
        confiance: p.confiance,
        xg_domicile: p.xgDomicile,
        xg_exterieur: p.xgExterieur,
        calculee_le: new Date().toISOString(),
      })
      .eq('fixture_id', p.fixtureId);
    return !error;
  } catch {
    return false;
  }
}

export async function figerPrediction(p: PredictionFigee): Promise<void> {
  try {
    await createAdminClient()
      .from('predictions_match')
      .insert({
        fixture_id: p.fixtureId,
        domicile_id: p.domicileId,
        domicile_nom: p.domicileNom,
        exterieur_id: p.exterieurId,
        exterieur_nom: p.exterieurNom,
        buts_domicile: p.butsDomicile,
        buts_exterieur: p.butsExterieur,
        proba_domicile: p.probaDomicile,
        proba_nul: p.probaNul,
        proba_exterieur: p.probaExterieur,
        confiance: p.confiance,
        xg_domicile: p.xgDomicile,
        xg_exterieur: p.xgExterieur,
      });
  } catch {
    // Déjà figée, ou table absente : dans les deux cas l'analyse en cours reste
    // valable et doit aboutir.
  }
}
