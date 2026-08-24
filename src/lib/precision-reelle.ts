/**
 * Précision réelle des pronostics ProFoot.
 *
 * L'application affichait des taux de réussite écrits en dur — 79,2 % de
 * vainqueurs corrects, 23,4 % de scores exacts, une série de 11 matchs — qui ne
 * reposaient sur aucune mesure. Ces chiffres étaient montrés à des abonnés
 * payants comme une promesse de performance.
 *
 * Ce module les remplace par ce qui est constaté : chaque analyse passée est
 * confrontée au résultat réel du match, et la précision se déduit de ces
 * comparaisons. Tant qu'aucun match n'a été vérifié, il ne renvoie aucun
 * pourcentage — l'interface annonce alors qu'il n'y a pas encore de mesure,
 * plutôt que d'inventer un chiffre flatteur.
 */

import { apiFootball, CACHE_TTL } from './api-football';
import { createAdminClient } from './supabase-admin';

/**
 * Nombre de matchs vérifiés en dessous duquel aucun pourcentage n'est publié.
 *
 * Le premier match vérifié était un échec : le taux serait tombé à 0 %. Un
 * chiffre calculé sur une poignée d'observations ne décrit pas une performance,
 * il décrit le hasard — et il induit en erreur dans un sens comme dans l'autre.
 * En dessous de ce seuil, on annonce le nombre de matchs déjà vérifiés sans en
 * tirer de taux.
 */
export const ECHANTILLON_MINIMUM = 10;

export interface PrecisionReelle {
  /** Analyses effectivement confrontées à un résultat. */
  verifiees: number;
  /** Analyses en attente : le match n'a pas encore été joué ou pas encore relevé. */
  enAttente: number;
  /** Pourcentages, `null` tant qu'aucune analyse n'a été vérifiée. */
  vainqueurCorrect: number | null;
  scoreExact: number | null;
  /** Série de bons pronostics en cours, du plus récent au plus ancien. */
  serieEnCours: number;
  /** Date du dernier match vérifié. */
  derniereVerification: string | null;
}

/** Issue d'un match à partir de deux buts. */
function issue(butsDomicile: number, butsExterieur: number): 'team1' | 'team2' | 'draw' {
  if (butsDomicile > butsExterieur) return 'team1';
  if (butsExterieur > butsDomicile) return 'team2';
  return 'draw';
}

/**
 * Lit le score prédit tel qu'il est stocké (« 3 - 1 ») et en déduit l'issue.
 *
 * Renvoie `null` si le format n'est pas exploitable : une analyse illisible ne
 * doit pas compter comme un échec, elle ne doit simplement pas compter.
 */
function lirePrediction(score: string | null): { buts: [number, number]; issue: string } | null {
  const m = (score ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return null;
  const buts: [number, number] = [Number(m[1]), Number(m[2])];
  return { buts, issue: issue(buts[0], buts[1]) };
}

/**
 * Retrouve le résultat réel d'une analyse.
 *
 * On cherche la confrontation entre les deux équipes autour de la date de
 * l'analyse. Renvoie `null` tant que le match n'est pas terminé — l'analyse
 * reste alors en attente et sera reprise au passage suivant.
 */
export function identifiantEquipe(logo: string | null | undefined): string | null {
  // Les identifiants du fournisseur sont contenus dans l'URL des logos, seule
  // trace fiable : les identifiants stockés sont des slugs internes.
  return String(logo ?? '').match(/teams\/(\d+)\.png/)?.[1] ?? null;
}

async function trouverResultat(analyse: any): Promise<{
  fixtureId: number;
  butsDomicile: number;
  butsExterieur: number;
  inverse: boolean;
  competition: string | null;
  /** Identifiant de l'équipe qui reçoit, pour redresser chaque analyse. */
  idDomicile: string;
} | null> {
  const id1 = identifiantEquipe(analyse.team1_logo);
  const id2 = identifiantEquipe(analyse.team2_logo);
  if (!id1 || !id2) return null;

  const data = await apiFootball<any>(
    `/fixtures/headtohead?h2h=${id1}-${id2}&last=10`,
    CACHE_TTL.STANDINGS
  );
  const matchs = data?.response ?? [];
  if (!matchs.length) return null;

  const creee = new Date(analyse.created_at).getTime();

  // Le match visé est le premier disputé APRÈS la création de l'analyse : une
  // analyse ne peut pas porter sur une rencontre déjà jouée au moment où elle
  // a été produite.
  const candidats = matchs
    .filter((f: any) => ['FT', 'AET', 'PEN'].includes(f.fixture?.status?.short))
    .filter((f: any) => new Date(f.fixture.date).getTime() >= creee - 6 * 3600 * 1000)
    .sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

  const match = candidats[0];
  if (!match) return null;

  // L'analyse nomme « team1 » l'équipe interrogée en premier, qui n'est pas
  // toujours celle qui reçoit. Sans ce redressement, un 2-1 à l'extérieur serait
  // compté comme une victoire de l'adversaire.
  const inverse = String(match.teams?.home?.id) !== id1;

  return {
    fixtureId: match.fixture.id,
    butsDomicile: match.goals?.home ?? 0,
    butsExterieur: match.goals?.away ?? 0,
    inverse,
    idDomicile: String(match.teams?.home?.id ?? ''),
    // LA COMPÉTITION RÉELLE DE LA RENCONTRE.
    //
    // Celle enregistrée à l'analyse n'est pas fiable : quand la rencontre n'a
    // pas pu être résolue, le code retombe sur le championnat de la première
    // équipe. Paris Saint-Germain — Aston Villa se retrouvait ainsi étiqueté
    // « ligue1 », ce qu'un amateur de football repère en une seconde.
    //
    // Ici, le nom vient de la fiche du match elle-même. C'est la seule source
    // qui ne puisse pas se tromper.
    competition: match.league?.name ?? null,
  };
}

/** Ce qu'on retient d'une rencontre terminée, quel que soit le chemin suivi. */
interface RencontreTerminee {
  fixtureId: number;
  butsDomicile: number;
  butsExterieur: number;
  idDomicile: string;
  competition: string | null;
}

/** Le fournisseur n'accepte pas plus de vingt identifiants par appel. */
const IDENTIFIANTS_PAR_APPEL = 20;

/** Statuts qui signifient « c'est fini, le score ne bougera plus ». */
const STATUTS_TERMINES = new Set(['FT', 'AET', 'PEN']);

/**
 * LE CHEMIN RAPIDE : ON DEMANDE LES MATCHS PAR LEUR IDENTIFIANT.
 *
 * ── POURQUOI IL EXISTE ────────────────────────────────────────────────────
 *
 * La vérification cherchait chaque résultat par la PAIRE D'ÉQUIPES, avec un
 * appel par affiche. Mesuré le 24 août 2026 : 7 046 analyses en attente,
 * portant sur 408 rencontres distinctes — donc 408 appels au fournisseur, la
 * ressource la plus rare du projet.
 *
 * Or chaque analyse porte déjà l'identifiant de sa rencontre, enregistré à sa
 * création. Le fournisseur accepte vingt identifiants par appel. Les mêmes
 * 408 rencontres tiennent donc dans 21 appels au lieu de 408 : dix-neuf fois
 * moins.
 *
 * ── ET C'EST AUSSI PLUS JUSTE ─────────────────────────────────────────────
 *
 * La recherche par paire devait deviner LAQUELLE des confrontations entre deux
 * équipes était visée, à partir de la date de l'analyse. L'identifiant, lui,
 * ne se devine pas : c'est exactement la rencontre qui a été analysée. Un
 * aller et un retour ne peuvent plus être confondus.
 *
 * Les rencontres non terminées sont simplement absentes du résultat : leurs
 * analyses restent en attente et seront reprises au passage suivant.
 */
async function lireRencontresParIdentifiant(
  identifiants: string[]
): Promise<Map<string, RencontreTerminee>> {
  const trouvees = new Map<string, RencontreTerminee>();
  if (!identifiants.length) return trouvees;

  const paquets: string[][] = [];
  for (let i = 0; i < identifiants.length; i += IDENTIFIANTS_PAR_APPEL) {
    paquets.push(identifiants.slice(i, i + IDENTIFIANTS_PAR_APPEL));
  }

  // ── PAR VAGUES, ET NON TOUS À LA FOIS ───────────────────────────────────
  //
  // L'abonnement au fournisseur borne le nombre d'appels PAR MINUTE. Lancer
  // les vingt-et-un paquets ensemble a fait refuser plusieurs appels le
  // 24 août 2026 — « too many requests per minute » — et les analyses
  // concernées sont restées en attente pour rien.
  //
  // Six à la fois laissent de la marge pour les appels que l'application sert
  // en même temps à ses abonnés : la tâche quotidienne ne doit jamais manger
  // le quota d'un client qui lance une analyse au même moment.
  const PAQUETS_SIMULTANES = 6;
  const reponses: any[] = [];

  for (let i = 0; i < paquets.length; i += PAQUETS_SIMULTANES) {
    const vague = await Promise.all(
      paquets.slice(i, i + PAQUETS_SIMULTANES).map((paquet) =>
        apiFootball<any>(
          `/fixtures?ids=${paquet.join('-')}`,
          // Cinq minutes : une rencontre terminée ne change plus, mais le même
          // paquet contient souvent des matchs encore à venir. Une réserve
          // longue les figerait « non joués » jusqu'au lendemain.
          CACHE_TTL.FIXTURES_TODAY
        ).catch((e: any) => {
          // Un paquet perdu n'annule pas les autres : ses analyses restent en
          // attente et repasseront demain.
          console.warn(`[PRECISION] Paquet de rencontres illisible : ${e?.message}`);
          return null;
        })
      )
    );
    reponses.push(...vague);
  }

  for (const data of reponses) {
    for (const f of data?.response ?? []) {
      const statut = f?.fixture?.status?.short;
      if (!STATUTS_TERMINES.has(String(statut))) continue;

      const id = String(f?.fixture?.id ?? '');
      if (!id) continue;

      trouvees.set(id, {
        fixtureId: Number(f.fixture.id),
        butsDomicile: f.goals?.home ?? 0,
        butsExterieur: f.goals?.away ?? 0,
        idDomicile: String(f.teams?.home?.id ?? ''),
        // La compétition vient de la fiche du match, seule source qui ne
        // puisse pas se tromper — celle enregistrée à l'analyse retombait sur
        // le championnat de la première équipe quand la rencontre n'avait pas
        // pu être résolue.
        competition: f.league?.name ?? null,
      });
    }
  }

  return trouvees;
}

/**
 * Confronte les analyses passées aux résultats réels et enregistre le verdict.
 *
 * Appelée par la tâche quotidienne. Traite un lot borné pour rester dans le
 * temps d'exécution alloué ; le reliquat est repris au passage suivant.
 */
export async function verifierPronostics(limite = 60): Promise<{
  examinees: number;
  verifiees: number;
  enAttente: number;
}> {
  const sb = createAdminClient();

  // ── ON LIT PAGE PAR PAGE ────────────────────────────────────────────────
  //
  // Supabase rend mille lignes au maximum par requête, silencieusement. Une
  // limite de trois mille en rendait donc mille, et les deux tiers du lot
  // demandé n'étaient jamais examinés — sans qu'aucune erreur ne le signale.
  const data: any[] = [];
  let error: { message: string } | null = null;

  for (let de = 0; de < limite; de += 1000) {
    const taille = Math.min(1000, limite - de);
    const { data: page, error: erreurPage } = await sb
      .from('analysis_history')
      .select('id, team1_logo, team2_logo, score, created_at, predicted_winner, predicted_at, fixture_id')
      .is('verified_at', null)
    // Deux heures, et non vingt-quatre.
    //
    // Le délai précédent rendait invisible tout match joué le jour même. Le 12
    // août 2026, Paris Saint-Germain — Aston Villa a été analysé par une
    // dizaine d'abonnés puis joué dans la foulée : la vérification refusait de
    // le regarder avant le lendemain, et le diagnostic affichait « 1 match
    // vérifié, 271 en attente » alors que le résultat était connu de tous.
    //
    // Une rencontre dure environ deux heures. Passé ce délai, elle PEUT être
    // terminée ; c'est la recherche du résultat qui tranche, et elle ne retient
    // que les matchs réellement achevés.
      .lt('created_at', new Date(Date.now() - 2 * 3600 * 1000).toISOString())
      // Les analyses les plus récentes d'abord : ce sont les matchs du jour qui
      // intéressent, pas un arriéré de la semaine passée.
      //
      // Cet ordre affamait l'arriéré tant que le lot était petit : à trois
      // cents analyses par passage, les plus vieilles n'étaient jamais
      // atteintes, puisque les nouvelles leur passaient devant chaque jour.
      // Mesuré le 24 août 2026, 1 871 analyses attendaient depuis plus de
      // trois jours sans espoir d'être vues. Le lot couvre désormais tout
      // l'arriéré : l'ordre ne décide plus que de qui passe en premier.
      .order('created_at', { ascending: false })
      .range(de, de + taille - 1);

    if (erreurPage) {
      error = erreurPage;
      break;
    }
    if (!page?.length) break;
    data.push(...page);
    if (page.length < taille) break;
  }

  if (error) {
    console.error('[PRECISION] Lecture impossible :', error.message);
    return { examinees: 0, verifiees: 0, enAttente: 0 };
  }

  let verifiees = 0;
  let enAttente = 0;

  // ── UN APPEL PAR RENCONTRE, PAS PAR ANALYSE ────────────────────────────────
  //
  // Cinquante personnes ont analysé FC Barcelone — Elche. Le code interrogeait
  // le fournisseur cinquante fois pour la même rencontre, dont le résultat est
  // évidemment identique. Sur 191 analyses en attente, cela faisait 191 appels
  // là où 57 suffisent — 70 % de gaspillage, sur un quota qui est justement ce
  // qui limite le nombre de matchs qu'on peut vérifier.
  //
  // Le résultat est donc cherché une fois par paire d'équipes, puis appliqué à
  // toutes les analyses qui portent sur cette rencontre.
  // ── LA RÉSERVE GARDE LA PROMESSE, PAS LA VALEUR ─────────────────────────
  //
  // Les analyses sont désormais traitées par paquets, en parallèle. Si la
  // réserve gardait le résultat une fois obtenu, dix analyses de la même
  // affiche lancées ensemble déclencheraient dix appels au fournisseur avant
  // que le premier n'ait répondu — et le quota du fournisseur est la ressource
  // la plus rare du projet.
  //
  // En gardant la promesse dès le premier appel, les neuf autres attendent la
  // même réponse. Un seul appel par affiche, quoi qu'il arrive.
  const resultatsParPaire = new Map<string, Promise<Awaited<ReturnType<typeof trouverResultat>>>>();

  // ── LES RENCONTRES CONNUES PAR LEUR IDENTIFIANT, D'UN SEUL COUP ─────────
  //
  // La quasi-totalité des analyses portent l'identifiant de leur rencontre,
  // enregistré à leur création. Vingt identifiants tiennent dans un appel :
  // les 408 rencontres de l'arriéré du 24 août 2026 se lisaient ainsi en
  // 21 appels au lieu de 408.
  const identifiants = [
    ...new Set(
      (data ?? [])
        .map((a: any) => a.fixture_id)
        .filter((v: any) => v !== null && v !== undefined && v !== '')
        .map(String)
    ),
  ];
  const rencontresParId = await lireRencontresParIdentifiant(identifiants);

  const resultatPourAnalyse = async (analyse: any) => {
    const id1 = identifiantEquipe(analyse.team1_logo);
    const id2 = identifiantEquipe(analyse.team2_logo);
    if (!id1 || !id2) return null;

    // ── LE CHEMIN RAPIDE PASSE EN PREMIER ────────────────────────────────
    //
    // Quand l'analyse porte un identifiant de rencontre, il n'y a rien à
    // deviner : c'est exactement le match analysé. Une rencontre absente de
    // la table n'est pas terminée — l'analyse reste en attente, et l'on ne
    // retombe PAS sur la recherche par paire. Y retomber relancerait un appel
    // par affiche pour un résultat qui n'existe pas encore, et risquerait de
    // ramener l'aller quand c'est le retour qui a été analysé.
    if (analyse.fixture_id !== null && analyse.fixture_id !== undefined && analyse.fixture_id !== '') {
      const connue = rencontresParId.get(String(analyse.fixture_id));
      if (!connue) return null;
      return { ...connue, inverse: String(connue.idDomicile) !== String(id1) };
    }

    // La date entre dans la clé : deux analyses de la même affiche à des dates
    // éloignées peuvent viser deux rencontres différentes (aller et retour).
    const jour = String(analyse.created_at).slice(0, 10);
    const cle = `${[id1, id2].sort().join('-')}@${jour}`;

    if (!resultatsParPaire.has(cle)) {
      resultatsParPaire.set(cle, trouverResultat(analyse));
    }
    const commun = await resultatsParPaire.get(cle);
    if (!commun) return null;

    // « inverse » dépend de l'ordre dans lequel CETTE analyse nomme les
    // équipes, pas de celui de la première analyse rencontrée. Sans ce
    // redressement, une analyse saisie dans l'autre sens verrait le score à
    // l'envers et serait comptée comme fausse.
    return { ...commun, inverse: String(commun.idDomicile) !== String(id1) };
  };

  // ── PAR PAQUETS, ET NON UNE PAR UNE ─────────────────────────────────────
  //
  // Chaque analyse demandait un aller-retour vers la base, attendu avant de
  // passer à la suivante. Trois cents analyses faisaient donc trois cents
  // allers-retours en file indienne — plusieurs minutes, dépassant les cent
  // vingt secondes que la plateforme accorde à la tâche quotidienne.
  //
  // Résultat mesuré le 24 août 2026 : 9 180 analyses au total, 2 329 vérifiées,
  // 6 851 en attente. À trois cents par jour dans le meilleur des cas, et avec
  // de nouvelles analyses qui arrivent plus vite que ça, l'arriéré ne se
  // résorbait jamais.
  //
  // Vingt à la fois : la base répond aussi vite pour vingt écritures que pour
  // une, et l'on reste très loin de la saturer. Le temps total est divisé par
  // vingt.
  //
  // ── PUIS CENT, LE 24 AOÛT 2026 ──────────────────────────────────────────
  //
  // Une fois les résultats lus d'un seul coup par identifiant, l'écriture est
  // devenue le seul goulot : 4 530 analyses vérifiées en 237 secondes, quand
  // la plateforme en accorde 300. Une journée un peu chargée aurait fait
  // couper la tâche au milieu.
  //
  // Cent écritures simultanées restent très en deçà de ce que Postgres
  // encaisse, et ramènent le même travail sous la minute.
  const TAILLE_PAQUET = 100;
  const analyses = data ?? [];

  const traiter = async (analyse: any) => {
    const prediction = lirePrediction(analyse.score);
    const resultat = await resultatPourAnalyse(analyse);

    if (!resultat || !prediction) {
      enAttente++;
      return;
    }

    const [butsEq1, butsEq2] = resultat.inverse
      ? [resultat.butsExterieur, resultat.butsDomicile]
      : [resultat.butsDomicile, resultat.butsExterieur];

    const issueReelle = issue(butsEq1, butsEq2);

    // L'issue figée à la création prime sur celle qu'on recalcule ici : elle
    // date d'avant le match. Ne l'écraser jamais, sinon la preuve perd ce qui
    // fait sa valeur — l'antériorité.
    const issueAnnoncee = (analyse as any).predicted_winner ?? prediction.issue;

    const { error: erreurEcriture } = await sb
      .from('analysis_history')
      .update({
        real_score: `${butsEq1} - ${butsEq2}`,
        real_winner: issueReelle,
        predicted_winner: issueAnnoncee,
        winner_correct: issueAnnoncee === issueReelle,
        score_correct: prediction.buts[0] === butsEq1 && prediction.buts[1] === butsEq2,
        verified_at: new Date().toISOString(),
        fixture_id: resultat.fixtureId,
        is_finished: true,
      })
      .eq('id', analyse.id);

    if (erreurEcriture) {
      console.error(`[PRECISION] Écriture impossible sur ${analyse.id} :`, erreurEcriture.message);
      enAttente++;
      return;
    }
    verifiees++;
  };

  for (let i = 0; i < analyses.length; i += TAILLE_PAQUET) {
    await Promise.all(analyses.slice(i, i + TAILLE_PAQUET).map(traiter));
  }

  console.log(`[PRECISION] ${verifiees} pronostic(s) vérifié(s), ${enAttente} en attente.`);
  return { examinees: data?.length ?? 0, verifiees, enAttente };
}

/**
 * Précision constatée, calculée uniquement sur les analyses vérifiées.
 *
 * Ne renvoie jamais de pourcentage tant qu'aucun match n'a été confronté : un
 * taux calculé sur zéro observation n'a aucun sens et retomberait dans le
 * défaut qu'on corrige.
 */
export async function getPrecisionReelle(): Promise<PrecisionReelle> {
  const sb = createAdminClient();

  const [verifiees, attente] = await Promise.all([
    sb
      .from('analysis_history')
      .select('winner_correct, score_correct, verified_at, fixture_id, team1_name, team2_name, analysis_data')
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1000),
    sb
      .from('analysis_history')
      .select('id', { count: 'exact', head: true })
      .is('verified_at', null),
  ]);

  // Tant que la migration n'a pas été appliquée, les colonnes de vérification
  // n'existent pas et la requête échoue. Ce n'est pas une raison pour casser la
  // page : on retombe sur l'état « aucune mesure », qui est la vérité.
  if (verifiees.error) {
    console.warn(
      '[PRECISION] Colonnes de vérification absentes — appliquer la migration ' +
        '20260809_verification_pronostics.sql. Détail :',
      verifiees.error.message
    );
  }

  // ── UN MATCH COMPTE POUR UN ────────────────────────────────────────────────
  //
  // Vingt personnes qui analysent la même rencontre ne fournissent pas vingt
  // observations : elles en fournissent UNE. Compter chaque analyse séparément
  // laisse une seule affiche décider du chiffre global.
  //
  // Constaté le 12 août 2026 : Paris Saint-Germain — Aston Villa pesait 29 des
  // 49 vérifications, soit 59 % de la mesure. Le match a fini 2-1, et le défaut
  // du « 2-1 par défaut » annonçait précisément 2-1 : vingt-cinq analyses ont
  // décroché le score exact par pur hasard, hissant ce taux à 67 % alors qu'il
  // tourne autour de 10 % pour tout le monde dans ce métier.
  //
  // On regroupe donc par rencontre. Au sein d'une même rencontre, le verdict
  // retenu est celui de la MAJORITÉ des analyses : c'est ce que l'application a
  // dit à ses abonnés sur ce match-là.
  const brutes = verifiees.data ?? [];

  const parMatch = new Map<string, { justes: number; exacts: number; total: number; date: string }>();
  for (const l of brutes as any[]) {
    const cle = l.fixture_id
      ? `f${l.fixture_id}`
      : [l.team1_name, l.team2_name].map((n) => String(n ?? '').toLowerCase()).sort().join('|');
    const m = parMatch.get(cle) ?? { justes: 0, exacts: 0, total: 0, date: l.verified_at };
    m.total++;
    if (l.winner_correct) m.justes++;
    if (l.score_correct) m.exacts++;
    if (l.verified_at > m.date) m.date = l.verified_at;
    parMatch.set(cle, m);
  }

  const lignes = [...parMatch.values()]
    .map((m) => ({
      winner_correct: m.justes * 2 > m.total,
      score_correct: m.exacts * 2 > m.total,
      verified_at: m.date,
    }))
    .sort((a, b) => (a.verified_at < b.verified_at ? 1 : -1));

  const total = lignes.length;

  if (!total) {
    return {
      verifiees: 0,
      enAttente: attente.count ?? 0,
      vainqueurCorrect: null,
      scoreExact: null,
      serieEnCours: 0,
      derniereVerification: null,
    };
  }

  const bonsVainqueurs = lignes.filter((l: any) => l.winner_correct).length;
  const bonsScores = lignes.filter((l: any) => l.score_correct).length;

  // Série en cours : les lignes sont triées du plus récent au plus ancien, on
  // compte tant que le pronostic est bon.
  let serie = 0;
  for (const l of lignes as any[]) {
    if (!l.winner_correct) break;
    serie++;
  }

  // En dessous du seuil, on renvoie le décompte mais aucun taux : publier un
  // pourcentage sur deux ou trois matchs reviendrait à présenter du hasard
  // comme une performance.
  const assezDeMatchs = total >= ECHANTILLON_MINIMUM;

  return {
    verifiees: total,
    enAttente: attente.count ?? 0,
    vainqueurCorrect: assezDeMatchs ? Math.round((bonsVainqueurs / total) * 1000) / 10 : null,
    scoreExact: assezDeMatchs ? Math.round((bonsScores / total) * 1000) / 10 : null,
    serieEnCours: serie,
    derniereVerification: (lignes[0] as any)?.verified_at ?? null,
  };
}
