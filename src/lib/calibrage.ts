/**
 * LE MOTEUR APPREND DE SES PROPRES ERREURS.
 *
 * CE QUI MANQUAIT
 *
 * Le moteur calcule les forces de chaque équipe à partir des matchs joués, et
 * il le fait bien. Mais il ne s'était jamais retourné pour regarder SES PROPRES
 * pronostics face aux résultats. Il ignorait donc s'il annonçait trop de buts,
 * pas assez, ou s'il surestimait l'équipe qui reçoit.
 *
 * Ce sont des biais SYSTÉMATIQUES. Ils ne se voient pas sur un match — un 3-0
 * inattendu n'apprend rien — mais sur cent, ils sautent aux yeux : si le moteur
 * annonce 2,1 buts par match là où il s'en marque 2,8, il se trompe dans le
 * même sens à chaque fois, et cette erreur-là se corrige d'un facteur.
 *
 * LA BOUCLE, EN TROIS TEMPS
 *
 *   1. JUGER    — chaque rencontre terminée est confrontée à son pronostic,
 *                 et le verdict est écrit en base (`jugements_moteur`).
 *   2. APPRENDRE— les verdicts d'un même championnat sont agrégés en facteurs
 *                 de correction (`calibrage_ligue`).
 *   3. APPLIQUER— le calcul suivant lit ces facteurs et corrige ses buts
 *                 attendus avant de dérouler la loi de Poisson.
 *
 * TROIS GARDE-FOUS, PARCE QU'UN APPRENTISSAGE PEUT EMPIRER LES CHOSES
 *
 *   • MATIÈRE  — sous `MATCHS_MINIMUM` rencontres, rien n'est appliqué.
 *                Corriger un biais mesuré sur six matchs, c'est prendre le
 *                hasard pour une tendance.
 *   • BORNES   — un facteur ne peut jamais sortir de [0,80 ; 1,25]. Même avec
 *                mille matchs, le moteur ne doit pas pouvoir se retourner
 *                complètement à cause d'une série anormale.
 *   • PREUVE   — la justesse et le score de Brier sont conservés AVANT et
 *                APRÈS. Si le calibrage dégrade, cela se voit et se retire.
 *
 * TOUT VIT EN BASE, JAMAIS EN MÉMOIRE. Le serveur redémarre plusieurs fois par
 * heure : un apprentissage gardé en mémoire serait effacé avant d'avoir servi.
 */

import { createAdminClient } from './supabase-admin';
import { lireReserve, ecrireReserve } from './api-football';

/** En deçà, les facteurs sont mesurés mais NON appliqués. */
export const MATCHS_MINIMUM = 30;

/** Un facteur appris ne peut jamais sortir de ces bornes. */
const FACTEUR_MIN = 0.8;
const FACTEUR_MAX = 1.25;

/** Une heure : les facteurs bougent lentement, les relire souvent ne sert à rien. */
const TTL = 60 * 60 * 1000;
const CLE = 'calibrage:ligues';

export interface CalibrageLigue {
  ligue: string;
  facteurButs: number;
  facteurDomicile: number;
  facteurExterieur: number;
  matchsObserves: number;
  justesse: number | null;
  brier: number | null;
  justesseAvant: number | null;
  brierAvant: number | null;
  /** Vrai quand la matière suffit pour que ces facteurs soient appliqués. */
  actif: boolean;
}

const borner = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 1;

/**
 * Les facteurs de correction de tous les championnats, mis en réserve.
 *
 * Renvoie une carte vide plutôt qu'une erreur : un calibrage illisible doit
 * laisser le moteur travailler comme avant, jamais l'empêcher de répondre.
 */
export async function lireCalibrages(): Promise<Map<string, CalibrageLigue>> {
  try {
    const enBase = await lireReserve<CalibrageLigue[]>(CLE);
    if (enBase && !enBase.expiree && Array.isArray(enBase.contenu))
      return new Map(enBase.contenu.map((c) => [normaliser(c.ligue), c]));

    const { data, error } = await createAdminClient()
      .from('calibrage_ligue')
      .select('*')
      .gte('matchs_observes', 1);

    if (error) {
      // Table absente : le script SQL n'a pas encore été exécuté. Ce n'est pas
      // une panne, c'est un état de départ — le moteur fonctionne sans.
      console.warn('[CALIBRAGE] Indisponible :', error.message);
      return new Map();
    }

    const liste: CalibrageLigue[] = (data ?? []).map(versCalibrage);
    void ecrireReserve(CLE, liste, TTL);
    return new Map(liste.map((c) => [normaliser(c.ligue), c]));
  } catch (e: any) {
    console.warn('[CALIBRAGE] Lecture impossible :', e?.message);
    return new Map();
  }
}

function versCalibrage(l: any): CalibrageLigue {
  const matchs = Number(l.matchs_observes ?? 0);
  return {
    ligue: String(l.ligue ?? ''),
    facteurButs: borner(Number(l.facteur_buts ?? 1), FACTEUR_MIN, FACTEUR_MAX),
    facteurDomicile: borner(Number(l.facteur_domicile ?? 1), FACTEUR_MIN, FACTEUR_MAX),
    facteurExterieur: borner(Number(l.facteur_exterieur ?? 1), FACTEUR_MIN, FACTEUR_MAX),
    matchsObserves: matchs,
    justesse: l.justesse == null ? null : Number(l.justesse),
    brier: l.brier == null ? null : Number(l.brier),
    justesseAvant: l.justesse_avant == null ? null : Number(l.justesse_avant),
    brierAvant: l.brier_avant == null ? null : Number(l.brier_avant),
    actif: matchs >= MATCHS_MINIMUM,
  };
}

/**
 * Le nom d'un championnat, ramené à une forme comparable.
 *
 * Le fournisseur écrit tantôt « La Liga », tantôt « LaLiga », tantôt
 * « Primera División ». Sans normalisation, le même championnat aurait trois
 * lignes de calibrage, chacune avec trois fois moins de matière.
 */
export function normaliser(ligue: string | null | undefined): string {
  return String(ligue ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Les facteurs applicables à une rencontre donnée.
 *
 * Renvoie des facteurs neutres — tous à 1 — quand le championnat est inconnu
 * ou que la matière manque. Le moteur rend alors exactement ce qu'il rendait
 * avant l'existence de ce module.
 */
export function facteursPour(
  calibrages: Map<string, CalibrageLigue>,
  ligue: string | null | undefined
): { domicile: number; exterieur: number; source: string } {
  const c = calibrages.get(normaliser(ligue));
  if (!c || !c.actif) return { domicile: 1, exterieur: 1, source: 'aucun' };

  // Le facteur de buts s'applique aux deux camps ; les facteurs de côté
  // corrigent ensuite le déséquilibre propre au championnat.
  return {
    domicile: borner(c.facteurButs * c.facteurDomicile, FACTEUR_MIN, FACTEUR_MAX),
    exterieur: borner(c.facteurButs * c.facteurExterieur, FACTEUR_MIN, FACTEUR_MAX),
    source: `${c.ligue} (${c.matchsObserves} matchs)`,
  };
}

/** Issue d'une rencontre à partir de deux buts. */
export const issueDe = (a: number, b: number): 'domicile' | 'nul' | 'exterieur' =>
  a > b ? 'domicile' : a === b ? 'nul' : 'exterieur';

/**
 * Score de Brier d'un pronostic à trois issues.
 *
 * Somme des carrés des écarts entre la probabilité annoncée et ce qui est
 * arrivé (1 pour l'issue réalisée, 0 pour les autres). Plus il est bas, mieux
 * les probabilités sont calibrées.
 *
 * Il mesure autre chose que la justesse : annoncer 90 % et se tromper coûte
 * bien plus cher qu'annoncer 55 % et se tromper. C'est ce qui empêche de
 * confondre « avoir raison » et « avoir eu de la chance ».
 */
export function brierDe(
  proba: { domicile: number; nul: number; exterieur: number },
  reelle: 'domicile' | 'nul' | 'exterieur'
): number {
  const p = (v: number) => Math.min(1, Math.max(0, Number(v) / 100));
  const d = p(proba.domicile), n = p(proba.nul), e = p(proba.exterieur);
  return (
    Math.pow(d - (reelle === 'domicile' ? 1 : 0), 2) +
    Math.pow(n - (reelle === 'nul' ? 1 : 0), 2) +
    Math.pow(e - (reelle === 'exterieur' ? 1 : 0), 2)
  );
}

export interface Jugement {
  fixtureId: number;
  ligue: string | null;
  dateMatch: string | null;
  domicile: string;
  exterieur: string;
  prevusDomicile: number;
  prevusExterieur: number;
  probaDomicile: number;
  probaNul: number;
  probaExterieur: number;
  confiance: number | null;
  reelsDomicile: number;
  reelsExterieur: number;
}

/**
 * Enregistre le verdict d'une rencontre.
 *
 * `upsert` sur l'identifiant : rejuger une rencontre ne crée pas de doublon,
 * et un résultat corrigé plus tard écrase l'ancien.
 */
export async function enregistrerJugement(j: Jugement): Promise<boolean> {
  const issuePrevue = issueDe(j.prevusDomicile, j.prevusExterieur);
  const issueReelle = issueDe(j.reelsDomicile, j.reelsExterieur);

  try {
    const { error } = await createAdminClient()
      .from('jugements_moteur')
      .upsert(
        {
          fixture_id: j.fixtureId,
          ligue: j.ligue,
          date_match: j.dateMatch,
          equipe_domicile: j.domicile,
          equipe_exterieur: j.exterieur,
          buts_prevus_domicile: j.prevusDomicile,
          buts_prevus_exterieur: j.prevusExterieur,
          proba_domicile: j.probaDomicile,
          proba_nul: j.probaNul,
          proba_exterieur: j.probaExterieur,
          confiance: j.confiance,
          buts_reels_domicile: j.reelsDomicile,
          buts_reels_exterieur: j.reelsExterieur,
          issue_prevue: issuePrevue,
          issue_reelle: issueReelle,
          issue_juste: issuePrevue === issueReelle,
          score_exact:
            j.prevusDomicile === j.reelsDomicile && j.prevusExterieur === j.reelsExterieur,
          brier: brierDe(
            { domicile: j.probaDomicile, nul: j.probaNul, exterieur: j.probaExterieur },
            issueReelle
          ),
          juge_le: new Date().toISOString(),
        },
        { onConflict: 'fixture_id' }
      );

    if (error) {
      console.warn('[CALIBRAGE] Jugement non enregistré :', error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[CALIBRAGE] Jugement impossible :', e?.message);
    return false;
  }
}

/**
 * Recalcule les facteurs de correction à partir de tous les jugements.
 *
 * COMMENT LE FACTEUR EST OBTENU
 *
 * On additionne, par championnat, les buts réellement marqués et les buts qui
 * avaient été annoncés. Leur rapport est le facteur : si le moteur a annoncé
 * 210 buts là où il s'en est marqué 280, il sous-estime de 33 % et son facteur
 * vaut 1,33 — ramené à 1,25 par la borne.
 *
 * Le rapport est calculé SÉPARÉMENT pour l'équipe qui reçoit et pour celle qui
 * se déplace : c'est ainsi qu'on capte un avantage du terrain mal estimé, qui
 * se compenserait dans un total unique.
 */
export async function recalculerCalibrages(): Promise<{
  ligues: number;
  matchs: number;
  detail: { ligue: string; matchs: number; facteurButs: number; justesse: number }[];
}> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from('jugements_moteur')
    .select('*')
    .order('date_match', { ascending: false })
    .limit(5000);

  if (error) {
    console.warn('[CALIBRAGE] Jugements illisibles :', error.message);
    return { ligues: 0, matchs: 0, detail: [] };
  }

  const parLigue = new Map<
    string,
    {
      nom: string;
      n: number;
      justes: number;
      brier: number;
      prevusDom: number;
      prevusExt: number;
      reelsDom: number;
      reelsExt: number;
    }
  >();

  for (const j of data ?? []) {
    const cle = normaliser(j.ligue);
    if (!cle) continue;
    const a =
      parLigue.get(cle) ??
      { nom: String(j.ligue), n: 0, justes: 0, brier: 0, prevusDom: 0, prevusExt: 0, reelsDom: 0, reelsExt: 0 };

    a.n++;
    if (j.issue_juste) a.justes++;
    a.brier += Number(j.brier ?? 0);
    a.prevusDom += Number(j.buts_prevus_domicile ?? 0);
    a.prevusExt += Number(j.buts_prevus_exterieur ?? 0);
    a.reelsDom += Number(j.buts_reels_domicile ?? 0);
    a.reelsExt += Number(j.buts_reels_exterieur ?? 0);
    parLigue.set(cle, a);
  }

  const detail: { ligue: string; matchs: number; facteurButs: number; justesse: number }[] = [];

  for (const a of parLigue.values()) {
    const prevus = a.prevusDom + a.prevusExt;
    const reels = a.reelsDom + a.reelsExt;

    const facteurButs = prevus > 0 ? borner(reels / prevus, FACTEUR_MIN, FACTEUR_MAX) : 1;
    // Les facteurs de côté se mesurent APRÈS neutralisation du facteur global,
    // sinon la correction d'ensemble serait appliquée deux fois.
    const facteurDomicile =
      a.prevusDom > 0 ? borner(a.reelsDom / (a.prevusDom * facteurButs), FACTEUR_MIN, FACTEUR_MAX) : 1;
    const facteurExterieur =
      a.prevusExt > 0 ? borner(a.reelsExt / (a.prevusExt * facteurButs), FACTEUR_MIN, FACTEUR_MAX) : 1;

    const justesse = Math.round((1000 * a.justes) / a.n) / 10;
    const brier = Math.round((1000 * a.brier) / a.n) / 1000;

    // La mesure d'avant n'est écrite qu'une fois : c'est le point de départ,
    // il ne doit pas se déplacer à chaque recalcul, sinon la comparaison
    // « avant / après » ne compare plus rien.
    const { data: existante } = await sb
      .from('calibrage_ligue')
      .select('justesse_avant, brier_avant')
      .eq('ligue', a.nom)
      .maybeSingle();

    await sb.from('calibrage_ligue').upsert(
      {
        ligue: a.nom,
        facteur_buts: facteurButs,
        facteur_domicile: facteurDomicile,
        facteur_exterieur: facteurExterieur,
        matchs_observes: a.n,
        justesse,
        brier,
        justesse_avant: (existante as any)?.justesse_avant ?? justesse,
        brier_avant: (existante as any)?.brier_avant ?? brier,
        mis_a_jour_le: new Date().toISOString(),
      },
      { onConflict: 'ligue' }
    );

    detail.push({ ligue: a.nom, matchs: a.n, facteurButs, justesse });
  }

  // La réserve est vidée : sans cela, le moteur continuerait une heure durant
  // à travailler sur les anciens facteurs.
  void ecrireReserve(CLE, [], 1);

  detail.sort((x, y) => y.matchs - x.matchs);
  console.log(
    `[CALIBRAGE] ${parLigue.size} championnat(s), ${data?.length ?? 0} rencontre(s) jugée(s).`
  );
  return { ligues: parLigue.size, matchs: data?.length ?? 0, detail };
}
