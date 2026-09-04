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

/**
 * UN FACTEUR COLLÉ À SA BORNE N'EST PAS UNE MESURE.
 *
 * Quand le rapport calculé dépasse la borne, on n'apprend pas « le moteur se
 * trompe de 25 % » : on apprend « le moteur se trompe d'au moins 25 %, et le
 * calcul a cessé de mesurer ». Appliquer cette valeur revient à prendre un
 * débordement pour un résultat.
 *
 * Ce n'est pas théorique. Mesuré le 21 août 2026 sur 3 099 rencontres de la
 * saison 2025, championnat par championnat : NEUF championnats sur dix
 * ressortaient exactement à 1,250, la borne haute. Pas parce que le moteur se
 * trompe partout de la même façon — parce que le rapport était calculé entre
 * deux choses qui ne se comparent pas.
 *
 * Le score annoncé est le score le PLUS PROBABLE. Dans une loi de Poisson, il
 * est toujours inférieur à la moyenne : on annonce 1-1 là où l'espérance vaut
 * 1,4 contre 1,2. Le rapport buts réels / score annoncé dépasse donc 1 par
 * construction, dans tous les championnats, pour toujours.
 *
 * La comparaison honnête se fait sur les BUTS ATTENDUS, et elle a été faite :
 * les facteurs tombent alors entre 0,90 et 1,16, autour de 1,00. Autrement
 * dit, le moteur n'a pas de biais de buts à corriger. C'est une bonne
 * nouvelle, et c'est le contraire de ce que le calcul saturé racontait.
 */
const AUX_BORNES = (v: number) => v <= FACTEUR_MIN + 1e-9 || v >= FACTEUR_MAX - 1e-9;

function versCalibrage(l: any): CalibrageLigue {
  const matchs = Number(l.matchs_observes ?? 0);
  const fButs = borner(Number(l.facteur_buts ?? 1), FACTEUR_MIN, FACTEUR_MAX);
  const fDom = borner(Number(l.facteur_domicile ?? 1), FACTEUR_MIN, FACTEUR_MAX);
  const fExt = borner(Number(l.facteur_exterieur ?? 1), FACTEUR_MIN, FACTEUR_MAX);

  // Trois conditions pour qu'un calibrage agisse sur les pronostics servis :
  // assez de matière, une mesure comparable, et une mesure qui n'a pas
  // débordé. Il en manque une, le moteur travaille exactement comme avant.
  const mesurable = !AUX_BORNES(fButs) && !AUX_BORNES(fDom) && !AUX_BORNES(fExt);

  return {
    ligue: String(l.ligue ?? ''),
    facteurButs: fButs,
    facteurDomicile: fDom,
    facteurExterieur: fExt,
    matchsObserves: matchs,
    justesse: l.justesse == null ? null : Number(l.justesse),
    brier: l.brier == null ? null : Number(l.brier),
    justesseAvant: l.justesse_avant == null ? null : Number(l.justesse_avant),
    brierAvant: l.brier_avant == null ? null : Number(l.brier_avant),
    actif: matchs >= MATCHS_MINIMUM && mesurable,
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
/**
 * LIT UNE TABLE ENTIÈRE, PAR TRANCHES.
 *
 * ── LE PLAFOND QUI NE SE VOIT PAS ────────────────────────────────────────
 *
 * Supabase refuse de rendre plus de mille lignes d'un coup, quoi qu'on lui
 * demande. `.limit(5000)` ne lève pas d'erreur : il rend mille lignes, et le
 * code continue comme si c'était tout.
 *
 * Tant que la base contenait quatre-vingt-cinq jugements, personne ne pouvait
 * s'en apercevoir. Le 21 août, l'amorçage en a écrit 2 769 d'un coup : le
 * recalcul n'en a vu que mille — les plus récents — et a produit des facteurs
 * établis sur un tiers de la matière disponible.
 *
 * Pire, la liste des rencontres DÉJÀ JUGÉES subissait le même plafond. Au-delà
 * de mille, la tâche de nuit redemandait au fournisseur des fiches qu'elle
 * possédait déjà. Le quota du fournisseur est la ressource la plus rare du
 * projet — il a frôlé les 100 % un 16 août, et au-delà plus aucune analyse ne
 * fonctionne pour personne.
 */
async function lireTout<T = any>(
  requete: (de: number, a: number) => any,
  plafond = 20000
): Promise<T[]> {
  const TRANCHE = 1000;
  const tout: T[] = [];

  for (let de = 0; de < plafond; de += TRANCHE) {
    const { data, error } = await requete(de, de + TRANCHE - 1);
    if (error) {
      console.warn('[CALIBRAGE] Lecture partielle :', error.message);
      break;
    }
    if (!data?.length) break;
    tout.push(...data);
    // Une tranche incomplète signifie qu'on a atteint le bout de la table.
    if (data.length < TRANCHE) break;
  }

  return tout;
}

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
 * Juge les rencontres terminées qui ne l'ont pas encore été.
 *
 * C'est le premier temps de la boucle, celui qui alimente tout le reste.
 *
 * ON NE REJUGE JAMAIS CE QUI L'EST DÉJÀ
 *
 * Les rencontres déjà présentes dans `jugements_moteur` sont écartées avant
 * le moindre appel au fournisseur. Sans ce filtre, la tâche quotidienne
 * redemanderait chaque nuit les mêmes centaines de fiches : le quota du
 * fournisseur est la ressource la plus rare du projet, et il a déjà frôlé les
 * 100 % un 16 août — au-delà, plus aucune analyse ne fonctionne pour personne.
 *
 * LA BORNE EXISTE POUR LA PLATEFORME, PAS POUR LE CALCUL
 *
 * Vercel coupe une fonction à soixante secondes. Vingt identifiants par appel,
 * quarante appels au plus : de quoi rattraper huit cents rencontres par nuit
 * sans jamais risquer la coupure. L'arriéré se résorbe en quelques nuits
 * plutôt qu'en une seule, et rien n'est perdu.
 */
export async function jugerRencontresTerminees(
  appelsMax = 40
): Promise<{ examinees: number; jugees: number; deja: number }> {
  const cle = process.env.API_FOOTBALL_KEY;
  if (!cle) {
    console.warn('[CALIBRAGE] Clé du fournisseur absente : aucun jugement possible.');
    return { examinees: 0, jugees: 0, deja: 0 };
  }

  const sb = createAdminClient();

  // Par tranches, comme partout ailleurs ici : `.limit(3000)` rendait mille
  // lignes sans le dire. Les pronostics les plus anciens n'étaient donc jamais
  // confrontés à leur résultat, et la boucle apprenait d'une fenêtre glissante
  // qu'elle croyait complète.
  // ── LES PLUS ANCIENNES D'ABORD, ET C'EST TOUT LE SUJET ──────────────────
  //
  // Ce tri était DESCENDANT. La boucle commençait donc par les pronostics
  // qu'on vient d'écrire — ceux des matchs de ce soir et de demain, qui ne
  // sont pas joués. Le fournisseur répondait « NS », rien n'était retenu, et
  // le plafond de `appelsMax` était atteint avant d'avoir approché un seul
  // match terminé.
  //
  // Mesuré le 4 septembre 2026 : « 40 rencontres examinées, 0 jugée ». Et pas
  // seulement ce jour-là — le DERNIER jugement écrit datait du 21 août, celui
  // de l'amorçage. Depuis, la file s'était remplie par le haut et la boucle
  // butait dessus, quinze jours durant, sans qu'aucune erreur ne soit levée :
  // « 0 jugée » n'est pas une panne, c'est une phrase.
  //
  // Pendant ce temps, 1 028 rencontres attendaient d'être apprises.
  //
  // En remontant du plus ancien, on tombe sur des matchs joués depuis
  // longtemps, dont le résultat est acquis. Ce qui n'est pas encore terminé
  // reste dans la file et sera repris au passage suivant.
  const predictions = await lireTout((de, a) =>
    sb.from('predictions_match').select('*').order('calculee_le', { ascending: true }).range(de, a),
    6000
  );

  if (!predictions.length) return { examinees: 0, jugees: 0, deja: 0 };

  // TOUTES les rencontres déjà jugées, pas les mille premières. Au-delà de ce
  // plafond invisible, la tâche de nuit redemandait au fournisseur des fiches
  // qu'elle possédait déjà — sur son quota, le bien le plus rare du projet.
  const connus = await lireTout<{ fixture_id: number }>((de, a) =>
    sb.from('jugements_moteur').select('fixture_id').range(de, a)
  );
  const dejaJuges = new Set(connus.map((j) => Number(j.fixture_id)));

  // ── ON NE DEMANDE PAS UN RÉSULTAT QUI N'EXISTE PAS ENCORE ───────────────
  //
  // Une analyse écrite il y a moins de deux jours porte presque toujours sur
  // un match à venir. L'interroger ne peut rien rendre d'autre que « NS », et
  // chaque lot coûte une requête sur le quota du fournisseur — le bien le plus
  // rare du projet. Ces pronostics ne sont pas perdus : ils remontent d'
  // eux-mêmes dans la file en vieillissant.
  const DELAI_DE_GRACE_MS = 48 * 60 * 60 * 1000;
  const limite = Date.now() - DELAI_DE_GRACE_MS;

  const aExaminer = predictions
    .filter((p: any) => p.fixture_id && !dejaJuges.has(Number(p.fixture_id)))
    .filter((p: any) => {
      const quand = Date.parse(p.calculee_le);
      // Une date illisible ne doit pas écarter la ligne : mieux vaut une
      // requête de trop qu'un pronostic jamais confronté à son résultat.
      return !Number.isFinite(quand) || quand <= limite;
    })
    .slice(0, appelsMax * 20);

  if (!aExaminer.length) return { examinees: 0, jugees: 0, deja: dejaJuges.size };

  // Seules ces trois issues signifient qu'un résultat est acquis. Un match
  // reporté ou interrompu n'apprend rien et ne doit pas entrer au bilan.
  const TERMINE = ['FT', 'AET', 'PEN'];
  const lignes: any[] = [];

  for (let i = 0; i < aExaminer.length; i += 20) {
    const lot = aExaminer.slice(i, i + 20);
    try {
      const r = await fetch(
        `https://v3.football.api-sports.io/fixtures?ids=${lot.map((p: any) => p.fixture_id).join('-')}`,
        { headers: { 'x-apisports-key': cle }, cache: 'no-store' }
      );
      const j = await r.json();
      const fiches = new Map<number, any>();
      for (const f of j?.response ?? []) fiches.set(f.fixture.id, f);

      for (const p of lot as any[]) {
        const f = fiches.get(Number(p.fixture_id));
        if (!f || !TERMINE.includes(f.fixture?.status?.short)) continue;

        const reelsDom = Number(f.goals?.home);
        const reelsExt = Number(f.goals?.away);
        if (!Number.isFinite(reelsDom) || !Number.isFinite(reelsExt)) continue;

        // La prédiction est stockée avec l'équipe qui REÇOIT en premier : elle
        // est donc déjà dans le sens du fournisseur, aucune réorientation.
        const prevusDom = Number(p.buts_domicile);
        const prevusExt = Number(p.buts_exterieur);
        const ip = issueDe(prevusDom, prevusExt);
        const ir = issueDe(reelsDom, reelsExt);

        lignes.push({
          fixture_id: p.fixture_id,
          ligue: f.league?.name ?? null,
          date_match: f.fixture?.date ?? null,
          equipe_domicile: p.domicile_nom,
          equipe_exterieur: p.exterieur_nom,
          buts_prevus_domicile: prevusDom,
          buts_prevus_exterieur: prevusExt,
          // Les buts attendus, gardés à côté du score arrondi : c'est sur eux
          // que le facteur de correction se mesure honnêtement.
          buts_attendus_domicile: p.xg_domicile ?? null,
          buts_attendus_exterieur: p.xg_exterieur ?? null,
          proba_domicile: Number(p.proba_domicile),
          proba_nul: Number(p.proba_nul),
          proba_exterieur: Number(p.proba_exterieur),
          confiance: Number(p.confiance),
          buts_reels_domicile: reelsDom,
          buts_reels_exterieur: reelsExt,
          issue_prevue: ip,
          issue_reelle: ir,
          issue_juste: ip === ir,
          score_exact: prevusDom === reelsDom && prevusExt === reelsExt,
          brier: brierDe(
            { domicile: p.proba_domicile, nul: p.proba_nul, exterieur: p.proba_exterieur },
            ir
          ),
          juge_le: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.warn('[CALIBRAGE] Lot ignoré :', e?.message);
    }
  }

  for (let i = 0; i < lignes.length; i += 100) {
    const lot = lignes.slice(i, i + 100);
    const { error: err } = await sb
      .from('jugements_moteur')
      .upsert(lot, { onConflict: 'fixture_id' });

    if (!err) continue;

    // ── LES DEUX COLONNES PEUVENT NE PAS ENCORE EXISTER ─────────────────
    //
    // `buts_attendus_*` s'ajoute par une commande SQL que le propriétaire
    // exécute lui-même. Tant qu'elle n'a pas été passée, la colonne est
    // absente et la base refuse TOUT le lot. Une amélioration de mesure ne
    // doit pas faire perdre les jugements eux-mêmes : on réessaie sans elles.
    if (/buts_attendus/.test(err.message)) {
      const sansAttendus = lot.map(({ buts_attendus_domicile, buts_attendus_exterieur, ...reste }) => reste);
      const { error: err2 } = await sb
        .from('jugements_moteur')
        .upsert(sansAttendus, { onConflict: 'fixture_id' });
      if (err2) console.warn('[CALIBRAGE] Lot refusé :', err2.message);
      continue;
    }

    console.warn('[CALIBRAGE] Lot refusé :', err.message);
  }

  console.log(
    `[CALIBRAGE] ${aExaminer.length} rencontre(s) examinée(s), ${lignes.length} jugée(s).`
  );
  return { examinees: aExaminer.length, jugees: lignes.length, deja: dejaJuges.size };
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

  // Toutes les tranches, pas seulement la première : voir `lireTout`.
  const data = await lireTout((de, a) =>
    sb.from('jugements_moteur').select('*').order('date_match', { ascending: false }).range(de, a)
  );

  if (!data.length) {
    console.warn('[CALIBRAGE] Aucun jugement lisible.');
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

    // ── ON COMPARE CE QUI SE COMPARE ──────────────────────────────────────
    //
    // Les buts ATTENDUS quand ils sont connus, le score arrondi sinon. Le
    // score arrondi est le score le plus probable : dans une loi de Poisson il
    // est toujours inférieur à la moyenne, donc le rapport buts réels / score
    // annoncé dépasse 1 par construction et sature la borne haute. Neuf
    // championnats sur dix ressortaient ainsi à 1,250 exactement — un
    // débordement, pas une mesure. Voir `AUX_BORNES` plus haut.
    const attDom = Number(j.buts_attendus_domicile);
    const attExt = Number(j.buts_attendus_exterieur);
    const comparable = Number.isFinite(attDom) && Number.isFinite(attExt) && attDom + attExt > 0;

    a.prevusDom += comparable ? attDom : Number(j.buts_prevus_domicile ?? 0);
    a.prevusExt += comparable ? attExt : Number(j.buts_prevus_exterieur ?? 0);
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
    `[CALIBRAGE] ${parLigue.size} championnat(s), ${data.length} rencontre(s) jugée(s).`
  );
  return { ligues: parLigue.size, matchs: data.length, detail };
}
