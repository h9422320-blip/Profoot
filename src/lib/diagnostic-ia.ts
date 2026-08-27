/**
 * Diagnostic de l'analyseur : ce qu'il annonce, ce qui arrive vraiment.
 *
 * Tout ici est calculé à partir de la base, sans aucun appel extérieur et sans
 * aucun coût. Les résultats réels sont déjà récupérés par la vérification
 * quotidienne ; il ne reste qu'à les confronter aux prédictions et à en tirer
 * des constats.
 *
 * Le parti pris : ne rien faire juger par une intelligence artificielle. Un
 * avis ponctuel sur un match raté n'apprend rien — c'est la répétition qui
 * révèle un défaut. Un modèle qui annonce 80 % de certitude et n'en réussit que
 * 55 % ne se voit pas match par match ; il saute aux yeux sur cinquante.
 *
 * Chaque recommandation est donc une règle appliquée à un écart chiffré, et
 * elle porte toujours les nombres qui la justifient.
 */

import { createAdminClient } from './supabase-admin';

/** Issue d'un match. */
type Issue = 'team1' | 'team2' | 'draw';

export interface TrancheConfiance {
  libelle: string;
  min: number;
  max: number;
  nombre: number;
  /** Réussite réellement constatée dans cette tranche. */
  reussite: number | null;
  /** Confiance moyenne annoncée dans cette tranche. */
  confianceMoyenne: number | null;
  /** Confiance annoncée moins réussite constatée. Positif = surestimation. */
  ecart: number | null;
}

export interface PerformanceCompetition {
  competition: string;
  nombre: number;
  reussite: number;
  scoresExacts: number;
}

export interface TypeErreur {
  libelle: string;
  nombre: number;
  part: number;
  explication: string;
}

export interface Recommandation {
  /** Gravité : ce qui pèse le plus sur la fiabilité passe en premier. */
  gravite: 'critique' | 'important' | 'mineur';
  titre: string;
  /** Le constat chiffré qui déclenche la recommandation. */
  constat: string;
  /** Ce qu'il faut changer, formulé pour être appliqué tel quel. */
  correction: string;
}

export interface DiagnosticIA {
  /** Analyses confrontées à un résultat réel. */
  verifiees: number;
  enAttente: number;
  /** Vrai tant que l'échantillon ne permet aucune conclusion. */
  echantillonInsuffisant: boolean;

  reussiteVainqueur: number | null;
  reussiteScoreExact: number | null;
  confianceMoyenne: number | null;
  /** Confiance annoncée moins réussite réelle, sur l'ensemble. */
  surconfiance: number | null;

  tranches: TrancheConfiance[];
  competitions: PerformanceCompetition[];
  typesErreurs: TypeErreur[];

  /** Ce que l'application prédit, comparé à ce qui arrive. */
  repartition: {
    predit: Record<Issue, number>;
    reel: Record<Issue, number>;
  };

  /** Buts annoncés contre buts marqués. */
  butsMoyens: { predits: number | null; reels: number | null };

  recommandations: Recommandation[];
}

/** Seuil en dessous duquel aucun pourcentage n'est publié. */
export const MINIMUM_DIAGNOSTIC = 10;

/**
 * Tranches de TENDANCE annoncée pour l'issue retenue.
 *
 * Elles allaient de 60 % à 90 % et plus, parce qu'elles découpaient l'indice de
 * confiance. Ce n'est pas la bonne échelle : la tendance d'une issue de
 * football se situe presque toujours entre 35 % et 70 % — il y a trois issues
 * possibles, et un match reste un match. Découpées comme avant, quatre-vingt-dix
 * pour cent des rencontres tombaient dans une seule case.
 */
const TRANCHES: { libelle: string; min: number; max: number }[] = [
  { libelle: 'Moins de 40 %', min: 0, max: 40 },
  { libelle: '40 à 50 %', min: 40, max: 50 },
  { libelle: '50 à 60 %', min: 50, max: 60 },
  { libelle: '60 à 70 %', min: 60, max: 70 },
  { libelle: '70 % et plus', min: 70, max: 101 },
];

function pourcent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function lireButs(score: string | null): [number, number] | null {
  const m = (score ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * Établit le diagnostic complet.
 *
 * Ne renvoie aucun pourcentage tant que l'échantillon est trop mince : une
 * réussite calculée sur trois matchs décrit le hasard, et une recommandation
 * fondée dessus enverrait corriger un défaut inexistant.
 */
export async function getDiagnosticIA(): Promise<DiagnosticIA> {
  const sb = createAdminClient();

  const [{ data: verifiees, error }, attente] = await Promise.all([
    sb
      .from('analysis_history')
      .select('score, real_score, predicted_winner, real_winner, winner_correct, score_correct, confidence, win_prob, draw_prob, lose_prob, competition, fixture_id, team1_name, team2_name')
      .not('verified_at', 'is', null)
      .limit(2000),
    sb.from('analysis_history').select('id', { count: 'exact', head: true }).is('verified_at', null),
  ]);

  const vide: DiagnosticIA = {
    verifiees: 0,
    enAttente: attente.count ?? 0,
    echantillonInsuffisant: true,
    reussiteVainqueur: null,
    reussiteScoreExact: null,
    confianceMoyenne: null,
    surconfiance: null,
    tranches: [],
    competitions: [],
    typesErreurs: [],
    repartition: { predit: { team1: 0, team2: 0, draw: 0 }, reel: { team1: 0, team2: 0, draw: 0 } },
    butsMoyens: { predits: null, reels: null },
    recommandations: [],
  };

  if (error) {
    console.warn('[DIAGNOSTIC] Lecture impossible :', error.message);
    return vide;
  }

  // ── UN MATCH COMPTE POUR UN ────────────────────────────────────────────────
  //
  // Vingt personnes qui analysent la même rencontre ne fournissent pas vingt
  // observations : elles en fournissent UNE. Sans ce regroupement, une seule
  // affiche décide de tout le diagnostic.
  //
  // Constaté le 12 août 2026 : Paris Saint-Germain — Aston Villa pesait 42 des
  // 49 vérifications, soit 86 % de la mesure. Le match a fini 2-1, et le défaut
  // du « 2-1 par défaut » annonçait précisément 2-1 : vingt-cinq analyses ont
  // décroché le score exact par pur hasard, hissant ce taux à 67 % là où il
  // tourne autour de 10 % pour tout le monde dans ce métier. Les
  // recommandations affichées en dessous héritaient toutes de ce biais.
  //
  // Une rencontre donne donc une ligne, dont le verdict est celui de la
  // MAJORITÉ de ses analyses — ce que l'application a dit à ses membres sur ce
  // match-là. Les valeurs continues (confiance, buts annoncés) sont moyennées.
  const brutes = (verifiees ?? []) as any[];

  const parMatch = new Map<string, any[]>();
  for (const l of brutes) {
    const cle = l.fixture_id
      ? `f${l.fixture_id}`
      : [l.team1_name, l.team2_name].map((n: any) => String(n ?? '').toLowerCase()).sort().join('|');
    parMatch.set(cle, [...(parMatch.get(cle) ?? []), l]);
  }

  /** Valeur la plus fréquente d'un champ au sein d'une rencontre. */
  const majoritaire = (lot: any[], champ: string) => {
    const compte = new Map<any, number>();
    for (const l of lot) if (l[champ] != null) compte.set(l[champ], (compte.get(l[champ]) ?? 0) + 1);
    return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const moyenneDuChamp = (lot: any[], champ: string) => {
    const v = lot.map((l) => l[champ]).filter((x) => typeof x === 'number');
    return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null;
  };

  /**
   * La TENDANCE de l'issue annoncée — et non l'indice de confiance.
   *
   * CE QUE CE TABLEAU COMPARAIT, ET POURQUOI C'ÉTAIT FAUX
   *
   * Il confrontait l'indice de confiance à la réussite réelle et criait à la
   * surconfiance : 75,8 % annoncés, 46 % réussis. Mais ces deux nombres ne
   * répondent pas à la même question. La confiance dit « cette analyse
   * repose-t-elle sur quelque chose ? » — données disponibles, netteté de
   * l'écart. Elle peut valoir 90 % sur un match parfaitement documenté dont
   * l'issue reste indécise.
   *
   * Ce qui doit être confronté à la réussite, c'est la tendance de l'issue
   * annoncée : « le PSG gagne à 47 % ». Elle, elle promet quelque chose de
   * vérifiable, et c'est elle qu'on mesure ici.
   */
  const probaDeLIssueAnnoncee = (lot: any[]): number | null => {
    const valeurs = lot
      .map((l) => {
        const issue = l.predicted_winner;
        const p =
          issue === 'team1' ? l.win_prob : issue === 'draw' ? l.draw_prob : issue === 'team2' ? l.lose_prob : null;
        return typeof p === 'number' ? p : null;
      })
      .filter((p): p is number => p !== null);
    return valeurs.length ? valeurs.reduce((t, p) => t + p, 0) / valeurs.length : null;
  };

  const lignes = [...parMatch.values()].map((lot) => ({
    // Le verdict de la rencontre est celui de la majorité de ses analyses.
    winner_correct: lot.filter((l) => l.winner_correct).length * 2 > lot.length,
    score_correct: lot.filter((l) => l.score_correct).length * 2 > lot.length,
    // Conservé pour information : c'est la solidité de l'analyse, pas une promesse.
    indiceConfiance: moyenneDuChamp(lot, 'confidence'),
    confidence: probaDeLIssueAnnoncee(lot),
    competition: majoritaire(lot, 'competition'),
    predicted_winner: majoritaire(lot, 'predicted_winner'),
    real_winner: lot[0]?.real_winner ?? null,
    score: majoritaire(lot, 'score'),
    real_score: lot[0]?.real_score ?? null,
  }));

  const total = lignes.length;
  if (!total) return vide;

  const insuffisant = total < MINIMUM_DIAGNOSTIC;

  // ── Réussite d'ensemble ──
  const bonsVainqueurs = lignes.filter((l) => l.winner_correct).length;
  const bonsScores = lignes.filter((l) => l.score_correct).length;
  const reussiteVainqueur = pourcent(bonsVainqueurs, total);

  const confiances = lignes
    .map((l) => (typeof l.confidence === 'number' ? l.confidence : null))
    .filter((c): c is number => c !== null);
  const confianceMoyenne = confiances.length
    ? Math.round((confiances.reduce((t, c) => t + c, 0) / confiances.length) * 10) / 10
    : null;

  // ── Calibration : l'assurance annoncée tient-elle ses promesses ? ──
  // C'est le diagnostic le plus utile. Un modèle peut se tromper souvent sans
  // que ce soit grave, tant qu'il annonce lui-même son incertitude. Ce qui nuit
  // à un membre qui parie, c'est une certitude affichée qui ne se vérifie pas.
  const tranches: TrancheConfiance[] = TRANCHES.map((t) => {
    const dedans = lignes.filter(
      (l) => typeof l.confidence === 'number' && l.confidence >= t.min && l.confidence < t.max
    );
    if (!dedans.length) {
      return { ...t, nombre: 0, reussite: null, confianceMoyenne: null, ecart: null };
    }
    const reussite = pourcent(dedans.filter((l) => l.winner_correct).length, dedans.length);
    // La confiance d'une rencontre est la moyenne de ses analyses : elle peut
    // donc manquer si aucune ne l'a renseignée.
    const moyenne =
      Math.round((dedans.reduce((s, l) => s + (l.confidence ?? 0), 0) / dedans.length) * 10) / 10;
    return {
      ...t,
      nombre: dedans.length,
      reussite,
      confianceMoyenne: moyenne,
      ecart: Math.round((moyenne - reussite) * 10) / 10,
    };
  });

  // ── Par compétition ──
  const parCompetition = new Map<string, any[]>();
  for (const l of lignes) {
    const c = l.competition || 'Non précisée';
    parCompetition.set(c, [...(parCompetition.get(c) ?? []), l]);
  }
  const competitions: PerformanceCompetition[] = [...parCompetition.entries()]
    .map(([competition, items]) => ({
      competition,
      nombre: items.length,
      reussite: pourcent(items.filter((l) => l.winner_correct).length, items.length),
      scoresExacts: items.filter((l) => l.score_correct).length,
    }))
    .sort((a, b) => b.nombre - a.nombre);

  // ── Répartition des issues ──
  const predit: Record<Issue, number> = { team1: 0, team2: 0, draw: 0 };
  const reel: Record<Issue, number> = { team1: 0, team2: 0, draw: 0 };
  for (const l of lignes) {
    if (l.predicted_winner in predit) predit[l.predicted_winner as Issue]++;
    if (l.real_winner in reel) reel[l.real_winner as Issue]++;
  }

  // ── Typologie des échecs ──
  const rates = lignes.filter((l) => !l.winner_correct);
  const nulsRates = rates.filter((l) => l.real_winner === 'draw').length;
  const inversions = rates.filter(
    (l) => l.real_winner !== 'draw' && l.predicted_winner !== 'draw'
  ).length;
  const nulsPredits = rates.filter((l) => l.predicted_winner === 'draw').length;

  const typesErreurs: TypeErreur[] = [
    {
      libelle: 'Le match a fini sur un nul',
      nombre: nulsRates,
      part: pourcent(nulsRates, rates.length || 1),
      explication: "Un vainqueur était annoncé, les deux équipes se sont neutralisées.",
    },
    {
      libelle: 'Vainqueur inversé',
      nombre: inversions,
      part: pourcent(inversions, rates.length || 1),
      explication: "C'est l'autre équipe qui l'a emporté. L'erreur de lecture est complète.",
    },
    {
      libelle: 'Un nul était annoncé',
      nombre: nulsPredits,
      part: pourcent(nulsPredits, rates.length || 1),
      explication: 'Le match a été tranché alors que le partage était prévu.',
    },
  ].filter((t) => t.nombre > 0);

  // ── Buts annoncés contre buts marqués ──
  const butsPredits: number[] = [];
  const butsReels: number[] = [];
  for (const l of lignes) {
    const p = lireButs(l.score);
    const r = lireButs(l.real_score);
    if (p) butsPredits.push(p[0] + p[1]);
    if (r) butsReels.push(r[0] + r[1]);
  }
  const moyenne = (t: number[]) =>
    t.length ? Math.round((t.reduce((s, v) => s + v, 0) / t.length) * 100) / 100 : null;

  const surconfiance =
    confianceMoyenne !== null ? Math.round((confianceMoyenne - reussiteVainqueur) * 10) / 10 : null;

  const diagnostic: DiagnosticIA = {
    verifiees: total,
    enAttente: attente.count ?? 0,
    echantillonInsuffisant: insuffisant,
    reussiteVainqueur: insuffisant ? null : reussiteVainqueur,
    reussiteScoreExact: insuffisant ? null : pourcent(bonsScores, total),
    confianceMoyenne,
    surconfiance: insuffisant ? null : surconfiance,
    tranches,
    competitions,
    typesErreurs,
    repartition: { predit, reel },
    butsMoyens: { predits: moyenne(butsPredits), reels: moyenne(butsReels) },
    recommandations: [],
  };

  diagnostic.recommandations = construireRecommandations(diagnostic, lignes.length);
  return diagnostic;
}

/**
 * Traduit les écarts constatés en corrections applicables.
 *
 * Chaque règle exige un écart net ET un nombre d'observations suffisant : une
 * anomalie sur quatre matchs n'est pas un défaut, c'est du bruit. Corriger un
 * défaut inexistant abîmerait le modèle au lieu de l'améliorer.
 */
function construireRecommandations(d: DiagnosticIA, echantillon: number): Recommandation[] {
  const reco: Recommandation[] = [];
  if (d.echantillonInsuffisant) return reco;

  // 1. Surconfiance globale — le défaut qui nuit le plus à un parieur.
  if (d.surconfiance !== null && d.surconfiance >= 10) {
    reco.push({
      gravite: d.surconfiance >= 20 ? 'critique' : 'important',
      titre: "L'analyseur annonce plus de certitude qu'il n'en mérite",
      constat: `Tendance moyenne annoncée pour l'issue retenue : ${d.confianceMoyenne} %. Réussite réelle : ${d.reussiteVainqueur} %. Écart de ${d.surconfiance} points sur ${echantillon} matchs.`,
      correction: `Ce sont les TENDANCES du moteur qui sont mal calibrées, pas l'indice de confiance affiché — ce dernier mesure la solidité de l'analyse et n'a pas à égaler la réussite. Rejouer le banc d'essai (scripts/calibrage-confiance.mjs) pour vérifier la courbe annoncé/constaté, et corriger le calcul des tendances si l'écart s'y confirme.`,
    });
  } else if (d.surconfiance !== null && d.surconfiance <= -10) {
    reco.push({
      gravite: 'mineur',
      titre: "L'analyseur se sous-estime",
      constat: `Il annonce ${d.confianceMoyenne} % de confiance et réussit ${d.reussiteVainqueur} %.`,
      correction:
        "L'analyseur est plus fiable qu'il ne le dit. Relever ses indices de confiance rendrait ses verdicts plus utiles pour un membre qui suit le match.",
    });
  }

  // 2. Tranches de confiance qui ne tiennent pas leur promesse.
  // Vingt pronostics au minimum : sur cinq, un écart de quinze points ne
  // distingue pas un défaut d'une série malheureuse.
  const trancheFautive = d.tranches
    .filter((t) => t.nombre >= 20 && t.ecart !== null && t.ecart >= 15)
    .sort((a, b) => (b.ecart ?? 0) - (a.ecart ?? 0))[0];
  if (trancheFautive) {
    reco.push({
      gravite: 'important',
      titre: `Les analyses annoncées à ${trancheFautive.libelle.toLowerCase()} ne tiennent pas`,
      constat: `${trancheFautive.nombre} analyses dans cette tranche : ${trancheFautive.confianceMoyenne} % annoncés, ${trancheFautive.reussite} % réussis.`,
      correction:
        "C'est la tranche la plus trompeuse pour un membre : il y voit une quasi-certitude. Interdire à l'analyseur d'y recourir sans une raison chiffrée explicite dans son raisonnement.",
    });
  }

  // 3. Le nul — angle mort classique des modèles de prédiction.
  //
  // LA CORRECTION PROPOSÉE ICI A ÉTÉ RÉÉCRITE LE 18 AOÛT 2026.
  //
  // Elle conseillait d'annoncer davantage de nuls. C'était l'inverse de ce
  // qu'il faut faire, et la mesure est sans appel : forcer le moteur à annoncer
  // plus de nuls fait TOMBER la justesse de 50,6 % à 49,5 %, puis 48,4 % à
  // mesure qu'on insiste — essayé sur 2 305 rencontres.
  //
  // La raison tient en une phrase : annoncer l'issue la plus attendue est déjà
  // le meilleur choix possible. Si une victoire est à 40 % et le nul à 28 %,
  // annoncer le nul fait perdre douze points de réussite, même quand le nul
  // tombe plus souvent que le modèle ne le disait.
  //
  // Ce qui devait être corrigé, c'est la TENDANCE affichée, pas le
  // pronostic. C'est fait : la correction des petits scores porte la
  // tendance moyenne de nul de 23,4 % à 25,6 %, soit exactement le taux
  // réel constaté. Voir le module de calcul du score.
  const nulsReels = d.repartition.reel.draw;
  const nulsPredits = d.repartition.predit.draw;
  if (nulsReels >= 3 && nulsPredits < nulsReels / 2) {
    reco.push({
      gravite: 'mineur',
      titre: "L'analyseur annonce rarement le match nul",
      constat: `${nulsReels} match${nulsReels > 1 ? 's se sont' : ' s\'est'} terminé${nulsReels > 1 ? 's' : ''} sur un nul, pour ${nulsPredits} annoncé${nulsPredits > 1 ? 's' : ''}.`,
      correction:
        "Ce n'est pas un défaut à corriger : annoncer l'issue la plus attendue reste le meilleur choix, et forcer davantage de nuls a été mesuré comme faisant BAISSER la réussite (50,6 % → 48,4 % sur 2 305 rencontres). Ce qui compte est que la TENDANCE de nul affichée soit juste — elle l'est désormais, à 25,6 % contre 25,8 % constatés. Vérifier ce chiffre plutôt que le nombre de nuls annoncés.",
    });
  }

  // 4. Biais vers l'équipe interrogée en premier.
  const totalPredits = d.repartition.predit.team1 + d.repartition.predit.team2 + d.repartition.predit.draw;
  const totalReels = d.repartition.reel.team1 + d.repartition.reel.team2 + d.repartition.reel.draw;
  if (totalPredits >= 10 && totalReels > 0) {
    const partPredite = pourcent(d.repartition.predit.team1, totalPredits);
    const partReelle = pourcent(d.repartition.reel.team1, totalReels);
    if (partPredite - partReelle >= 20) {
      reco.push({
        gravite: 'important',
        titre: "L'analyseur favorise systématiquement la première équipe citée",
        constat: `Victoire de la première équipe annoncée dans ${partPredite} % des cas, constatée dans ${partReelle} %.`,
        correction:
          "L'ordre de saisie ne devrait avoir aucune influence. Rappeler dans les consignes que la première équipe nommée n'est pas nécessairement celle qui reçoit, et que l'avantage du terrain doit être établi à partir des données, pas de l'ordre des noms.",
      });
    }
  }

  // 5. Compétitions où le modèle échoue.
  //
  // LE SEUIL EST PASSÉ DE CINQ À VINGT MATCHS, ET C'EST UNE CORRECTION.
  //
  // « 28,6 % de réussite sur Eredivisie » reposait sur SEPT rencontres. Avec
  // sept matchs, une équipe qui gagne réellement une fois sur deux affiche deux
  // succès ou moins environ une fois sur sept — sans que rien n'aille mal. Le
  // tableau accusait donc des championnats au hasard, et invitait à brider la
  // confiance là où il n'y avait rien à corriger.
  //
  // Vingt matchs ne rendent pas le chiffre certain, mais en dessous il ne veut
  // rien dire du tout — et une alerte qui se trompe fait perdre du temps sur de
  // vrais défauts.
  const MATCHS_POUR_JUGER_UNE_COMPETITION = 20;
  for (const c of d.competitions) {
    if (c.nombre >= MATCHS_POUR_JUGER_UNE_COMPETITION && c.reussite < 40) {
      reco.push({
        gravite: c.reussite < 25 ? 'critique' : 'important',
        titre: `Résultats faibles sur ${c.competition}`,
        constat: `${c.reussite} % de réussite sur ${c.nombre} matchs analysés.`,
        correction: `Deux options : demander à l'analyseur davantage de prudence sur cette compétition — confiance plafonnée, verdict plus nuancé — ou vérifier que les données disponibles y sont complètes. Une compétition mal couverte produit des analyses mal fondées.`,
      });
    }
  }

  // 6. Inflation ou déflation des buts.
  const { predits, reels } = d.butsMoyens;
  if (predits !== null && reels !== null && echantillon >= 10) {
    const ecart = Math.round((predits - reels) * 100) / 100;
    if (Math.abs(ecart) >= 0.8) {
      reco.push({
        gravite: 'mineur',
        titre: ecart > 0 ? "L'analyseur annonce trop de buts" : "L'analyseur annonce trop peu de buts",
        constat: `${predits} buts annoncés en moyenne par match, ${reels} réellement marqués.`,
        correction: `Écart de ${Math.abs(ecart)} but par match. Corriger le calibrage des scores annoncés, qui fausse les paris sur le nombre de buts autant que sur le score exact.`,
      });
    }
  }

  // 7. Score exact : rappeler ce qui est réellement atteignable.
  if (d.reussiteScoreExact !== null && d.reussiteScoreExact < 8 && echantillon >= 20) {
    reco.push({
      gravite: 'mineur',
      titre: 'Le score exact est rarement trouvé',
      constat: `${d.reussiteScoreExact} % de scores exacts sur ${echantillon} matchs.`,
      correction:
        "C'est normal — personne n'annonce un score exact de façon fiable. Le présenter comme une estimation plutôt que comme une certitude éviterait de décevoir un membre qui le prendrait au pied de la lettre.",
    });
  }

  const ordre = { critique: 0, important: 1, mineur: 2 };
  return reco.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}
