/**
 * LES BUGS QU'ON A DÉJÀ PAYÉS, ET QUI NE DOIVENT PLUS REVENIR.
 *
 * CE QUE CE FICHIER N'EST PAS
 *
 * Ce n'est pas une couverture de tests. Chaque cas ici correspond à un défaut
 * RÉELLEMENT SURVENU, daté, qui a coûté des heures ou de l'argent. On ne teste
 * pas ce qui pourrait casser un jour : on verrouille ce qui a déjà cassé.
 *
 * Un test qui échoue ici veut dire qu'un défaut connu est revenu. C'est la
 * seule promesse qu'il fait, et elle vaut mieux qu'une longue liste de tests
 * décoratifs.
 *
 *   npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { calculerScoreProbable } from '../src/lib/score-probable';
import { normaliser, brierDe, issueDe, facteursPour } from '../src/lib/calibrage';

const racine = path.join(import.meta.dirname, '..');
const lire = (p: string) => fs.readFileSync(path.join(racine, p), 'utf8');

const stats = (marques: number, encaisses: number, matchs = 30) => ({
  butsMarques: Math.round(marques * matchs),
  butsEncaisses: Math.round(encaisses * matchs),
  matchsJoues: matchs,
});

// ═══════════════════════════════════════════════════════════════════════════
//  20 AOÛT 2026 — LE MOTEUR RÉPONDAIT 2-1 À TOUT
// ═══════════════════════════════════════════════════════════════════════════
//
//  Un abonné lançait trois analyses dans trois championnats différents et
//  lisait trois fois le même score. Mesuré sur 4 096 combinaisons d'équipes :
//  2-1 sortait 46,2 % du temps, 1-2 32,9 % — 79 % à eux deux — quand 1-1 ne
//  sortait que 1 % et 0-0 jamais.
//
//  Cause : le score était choisi parmi les seuls scores de l'issue en tête. Le
//  nul n'étant presque jamais en tête, tous les scores de parité étaient
//  éliminés avant même d'être comparés.

test('aucun score ne domine plus de 40 % des pronostics', () => {
  const PROFILS = [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 2.0, 2.3];
  const compte = new Map<string, number>();
  let total = 0;

  for (const m1 of PROFILS)
    for (const e1 of PROFILS)
      for (const m2 of PROFILS)
        for (const e2 of PROFILS) {
          const r = calculerScoreProbable(stats(m1, e1), stats(m2, e2), true, false);
          const cle = `${r.buts1}-${r.buts2}`;
          compte.set(cle, (compte.get(cle) ?? 0) + 1);
          total++;
        }

  const [scoreDominant, n] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
  const part = (100 * n) / total;

  assert.ok(
    part < 40,
    `Le score ${scoreDominant} sort dans ${part.toFixed(1)} % des cas. ` +
      `Au-dessus de 40 %, le moteur a l'air en panne aux yeux d'un abonné.`
  );
});

test('les scores de parité restent possibles', () => {
  // 1-1 est l'un des scores les plus fréquents du football réel. Un moteur qui
  // ne le produit jamais est faux, quelle que soit sa justesse par ailleurs.
  const PROFILS = [0.9, 1.1, 1.3, 1.5];
  let nuls = 0, total = 0;

  for (const m of PROFILS)
    for (const e of PROFILS) {
      // Deux équipes de force identique : le nul doit pouvoir sortir.
      const r = calculerScoreProbable(stats(m, e), stats(m, e), true, false);
      if (r.buts1 === r.buts2) nuls++;
      total++;
    }

  assert.ok(nuls > 0, `Aucun nul sur ${total} affiches entre équipes identiques.`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  19 AOÛT 2026 — LA CONFIANCE ÉTAIT DESCENDUE SOUS 70 %
// ═══════════════════════════════════════════════════════════════════════════
//
//  Une recalibration l'avait fait tomber à 48 %. C'est un choix commercial
//  assumé du propriétaire : elle ne descend jamais sous 70, ne dépasse jamais
//  95. Toute modification du calcul doit respecter cette borne.

test('la confiance reste toujours entre 70 et 95', () => {
  const CAS: [number, number, number, number][] = [
    [2.4, 0.6, 0.7, 2.3],  // écrasante
    [1.2, 1.2, 1.2, 1.2],  // parfaitement égales
    [0.7, 2.3, 2.4, 0.6],  // écrasante dans l'autre sens
    [1.5, 1.1, 1.4, 1.2],  // serrée
  ];

  for (const [m1, e1, m2, e2] of CAS) {
    for (const domicile of [true, false, null]) {
      const r = calculerScoreProbable(stats(m1, e1), stats(m2, e2), domicile, false);
      assert.ok(
        r.confiance >= 70 && r.confiance <= 95,
        `Confiance ${r.confiance} hors des bornes 70–95 (cas ${m1}/${e1} vs ${m2}/${e2}).`
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  19 AOÛT 2026 — UN NaN TRAVERSAIT TOUT LE CALCUL
// ═══════════════════════════════════════════════════════════════════════════
//
//  Un club obscur renvoyait des statistiques incohérentes : champ absent,
//  chaîne vide devenue NaN, nombre négatif. Un seul NaN ressortait en
//  confiance NaN, devenue null côté navigateur — l'abonné voyait une analyse
//  amputée sans qu'aucune erreur n'apparaisse nulle part.

test('des statistiques absurdes ne produisent jamais de NaN', () => {
  const ABSURDES: any[] = [
    { butsMarques: NaN, butsEncaisses: 10, matchsJoues: 5 },
    { butsMarques: -5, butsEncaisses: -3, matchsJoues: 10 },
    { butsMarques: undefined, butsEncaisses: null, matchsJoues: 0 },
    { butsMarques: '12' as any, butsEncaisses: '' as any, matchsJoues: '3' as any },
    {},
  ];

  for (const a of ABSURDES)
    for (const b of ABSURDES) {
      const r = calculerScoreProbable(a, b, true, false);
      for (const [nom, v] of Object.entries({
        buts1: r.buts1, buts2: r.buts2, confiance: r.confiance,
        probaVictoire1: r.probaVictoire1, probaNul: r.probaNul, probaVictoire2: r.probaVictoire2,
      }))
        assert.ok(Number.isFinite(v as number), `${nom} vaut ${v} sur des statistiques absurdes.`);
    }
});

test('les trois probabilités totalisent toujours 100', () => {
  const r = calculerScoreProbable(stats(1.8, 1.0), stats(1.1, 1.6), true, false);
  const somme = r.probaVictoire1 + r.probaNul + r.probaVictoire2;
  assert.equal(somme, 100, `Les probabilités affichées totalisent ${somme} au lieu de 100.`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  20 AOÛT 2026 — UN TIRET LONG BLOQUAIT CHAQUE APPEL À L'IA
// ═══════════════════════════════════════════════════════════════════════════
//
//  L'en-tête X-Title contenait un tiret cadratin (code 8212). Un en-tête HTTP
//  ne transporte que des octets : tout caractère au-delà de 255 fait échouer la
//  requête AVANT l'envoi, avec un TypeError qui ne ressemble à aucune erreur
//  réseau. L'Agent VIP répondait « le réseau semble instable » à chaque
//  question, en neuf millisecondes, sur toutes les passerelles.

test("aucun en-tête HTTP ne contient de caractère hors ASCII", () => {
  const FICHIERS = ['src/lib/passerelle-claude.ts', 'src/lib/openrouter.ts'];

  for (const fichier of FICHIERS) {
    const source = lire(fichier);
    // Les valeurs de chaîne posées sur une clé d'en-tête HTTP connue.
    const motif = /['"](?:X-Title|HTTP-Referer|Authorization|User-Agent|x-apisports-key)['"]\s*:\s*[`'"]([^`'"]*)[`'"]/gi;
    for (const m of source.matchAll(motif)) {
      const valeur = m[1];
      const fautif = [...valeur].find((c) => c.charCodeAt(0) > 255);
      assert.ok(
        !fautif,
        `${fichier} : l'en-tête contient « ${fautif} » (code ${fautif?.charCodeAt(0)}), ` +
          `qui fait échouer la requête avant l'envoi.`
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  20 AOÛT 2026 — L'ADRESSE OPENROUTER ÉTAIT DOUBLÉE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Le SDK Anthropic ajoute lui-même /v1/messages à l'adresse de base. Lui
//  donner .../api/v1 produisait .../api/v1/v1/messages — une adresse
//  inexistante, et un 404 renvoyé en HTML que rien ne distinguait d'une panne.

test("l'adresse de base d'OpenRouter ne se termine pas par /v1", () => {
  const source = lire('src/lib/passerelle-claude.ts');
  const m = source.match(/URL_OPENROUTER\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(m, 'URL_OPENROUTER introuvable.');
  assert.ok(
    !m![1].endsWith('/v1'),
    `URL_OPENROUTER vaut « ${m![1]} » : le SDK y ajoutera /v1/messages, ` +
      `ce qui donne une adresse doublée et un 404.`
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  21 AOÛT 2026 — L'APPRENTISSAGE NE DOIT JAMAIS AGIR SANS MATIÈRE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Corriger un biais mesuré sur trois matchs, c'est prendre le hasard pour une
//  tendance. Le seuil de trente rencontres est le garde-fou : sous ce seuil,
//  les facteurs sont connus mais NON appliqués.

test('un calibrage sans matière suffisante ne corrige rien', () => {
  const maigre = new Map([
    ['premierleague', {
      ligue: 'Premier League', facteurButs: 1.25, facteurDomicile: 1.2,
      facteurExterieur: 0.8, matchsObserves: 2, justesse: 50, brier: 0.6,
      justesseAvant: 50, brierAvant: 0.6, actif: false,
    }],
  ]);

  const f = facteursPour(maigre as any, 'Premier League');
  assert.equal(f.domicile, 1, 'Un calibrage sur 2 matchs ne doit pas corriger.');
  assert.equal(f.exterieur, 1, 'Un calibrage sur 2 matchs ne doit pas corriger.');
});

test('un calibrage neutre laisse le calcul rigoureusement inchangé', () => {
  const sans = calculerScoreProbable(stats(1.8, 1.0), stats(1.1, 1.6), true, false, undefined, null);
  const avec = calculerScoreProbable(stats(1.8, 1.0), stats(1.1, 1.6), true, false, undefined, null, {
    domicile: 1,
    exterieur: 1,
  });

  assert.equal(avec.buts1, sans.buts1);
  assert.equal(avec.buts2, sans.buts2);
  assert.equal(avec.confiance, sans.confiance);
  assert.equal(avec.probaVictoire1, sans.probaVictoire1);
});

test('les noms de championnat se normalisent vers la même clé', () => {
  // Sans cela, « La Liga », « LaLiga » et « Primera División » auraient trois
  // lignes de calibrage, chacune avec trois fois moins de matière.
  assert.equal(normaliser('La Liga'), normaliser('LaLiga'));
  assert.equal(normaliser('Ligue 1'), normaliser('ligue-1'));
  assert.equal(normaliser(null), '');
});

// ═══════════════════════════════════════════════════════════════════════════
//  LES OUTILS DE MESURE DOIVENT ÊTRE JUSTES
// ═══════════════════════════════════════════════════════════════════════════

test('le score de Brier récompense la certitude justifiée', () => {
  const certainEtJuste = brierDe({ domicile: 100, nul: 0, exterieur: 0 }, 'domicile');
  const certainEtFaux = brierDe({ domicile: 100, nul: 0, exterieur: 0 }, 'exterieur');
  const prudent = brierDe({ domicile: 34, nul: 33, exterieur: 33 }, 'domicile');

  assert.equal(certainEtJuste, 0, 'Une certitude qui tombe juste doit coûter 0.');
  assert.ok(certainEtFaux > prudent, 'Se tromper en étant sûr doit coûter plus que rester prudent.');
});

test("l'issue se déduit correctement du score", () => {
  assert.equal(issueDe(2, 1), 'domicile');
  assert.equal(issueDe(1, 1), 'nul');
  assert.equal(issueDe(0, 3), 'exterieur');
});

// ═══════════════════════════════════════════════════════════════════════════
//  16 AOÛT 2026 — LE MUR PUBLIC A AFFICHÉ UN RATÉ COMME UNE RÉUSSITE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Une carte annonçait « pronostic Getafe 1-0 » à côté de « résultat 0-3 »,
//  présentée comme une réussite. Un visiteur n'a pas besoin d'être expert pour
//  voir le mensonge, et c'est précisément ce mur qui doit inspirer confiance.
//
//  La règle est absolue : `publiee` ne peut jamais valoir vrai si
//  `issue_correcte` est faux. On la vérifie ici sur le code lui-même.

test('le code ne publie jamais une preuve dont l\'issue est fausse', () => {
  const source = lire('src/lib/preuves.ts');

  assert.ok(
    /valeurs\.publiee\s*=\s*issueCorrecte\s*&&/.test(source),
    "La publication doit rester conditionnée à `issueCorrecte`. " +
      "Si cette ligne change, un raté peut réapparaître sur le mur public."
  );

  assert.ok(
    /issue_correcte/.test(source) && /Un pronostic raté ne peut pas être publié/.test(source),
    'Le garde-fou de publication manuelle a disparu.'
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  21 AOÛT 2026 — L'APERÇU GRATUIT DONNAIT TOUTE LA RÉPONSE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Les ventes se sont arrêtées net. Un visiteur sans abonnement recevait :
//  le « Résumé rapide » qui nomme le favori et cite les buts attendus chiffrés
//  (« penchent vers Marseille : 1.9 contre 1.36 »), le premier scénario
//  complet avec buteur, minute et score final (« scelle la victoire 2-1 »), et
//  la jauge de confiance avec son libellé. Il n'avait plus aucune raison de
//  payer.
//
//  Ces trois tests couvrent les DEUX portes par lesquelles l'analyse sortait :
//  la route d'analyse (`toTeaser`) et la route d'historique.

// La CONFIANCE n'est plus dans cette liste, et c'est une décision assumée du
// 21 août : elle indique la solidité des données du match, pas l'issue. La
// montrer fait sentir qu'un verdict net existe derrière le mur sans livrer la
// moindre donnée sur laquelle parier.
//
// La règle qui gouverne le découpage : on donne du RÉCIT et des INDICATEURS,
// jamais des CHIFFRES EXPLOITABLES.
const CHAMPS_VERROUILLES = [
  'predictedScore', 'winner', 'winProb', 'drawProb', 'loseProb',
  'expectedGoals', 'scenarios', 'scenario', 'sections', 'quickSummary',
];

const analyseComplete = (t1: string, t2: string, f1: any, f2: any) => ({
  team1: { name: t1 }, team2: { name: t2 },
  competition: 'Ligue 1', globalForm: { team1: f1, team2: f2 },
  quickSummary: `Les buts attendus penchent vers ${t1} : 1.9 contre 1.36.`,
  predictedScore: '2-1', winner: t1,
  winProb: 52, drawProb: 26, loseProb: 22,
  confidence: 88, confidenceLabel: 'Très élevée',
  expectedGoals: { team1: 1.9, team2: 1.36 },
  scenarios: [`${t1} ouvre par Mendy (8/10) et scelle la victoire 2-1.`, 'B', 'C'],
  sections: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ titre: `S${n}` })),
});

const FORME_FORTE = { recentMatches: ['W','W','W','W','D'], goalsScored: 12, goalsConceded: 3, cleanSheets: 3, avgPossession: 62, winStreak: 4 };
const FORME_FAIBLE = { recentMatches: ['L','L','L','L','D'], goalsScored: 2, goalsConceded: 11, cleanSheets: 0, avgPossession: 38, winStreak: 0 };
const FORME_MOYENNE = { recentMatches: ['W','D','W','L','W'], goalsScored: 8, goalsConceded: 6, cleanSheets: 2, avgPossession: 47, winStreak: 1 };

test("un compte gratuit ne reçoit AUCUN champ verrouillé", async () => {
  const { toTeaser } = await import('../src/lib/analysis-teaser');

  for (const [t1, t2, f1, f2] of [
    ['Real Madrid', 'Espanyol', FORME_FORTE, FORME_FAIBLE],
    ['Arsenal', 'Coventry', FORME_FORTE, FORME_MOYENNE],
    ['Marseille', 'Strasbourg', FORME_MOYENNE, FORME_FAIBLE],
  ] as [string, string, any, any][]) {
    const gratuit = await toTeaser(analyseComplete(t1, t2, f1, f2)) as Record<string, unknown>;

    for (const champ of CHAMPS_VERROUILLES)
      assert.ok(
        !(champ in gratuit),
        `${t1} — ${t2} : le champ « ${champ} » part vers un compte gratuit. ` +
          `Le visiteur a la réponse sans payer.`
      );
  }
});

test("aucune valeur payante ne subsiste dans le JSON servi au gratuit", async () => {
  const { toTeaser } = await import('../src/lib/analysis-teaser');
  const json = JSON.stringify(await toTeaser(analyseComplete('Marseille', 'Strasbourg', FORME_MOYENNE, FORME_FAIBLE)));

  // On cherche les VALEURS, pas les noms de champs : un score peut ressortir
  // dans un texte libre sans qu'aucun champ interdit ne soit présent.
  for (const [quoi, motif] of [
    ['le score prédit', /\b2\s*-\s*1\b/],
    ['les buts attendus', /\b1\.9\b|\b1\.36\b/],
    ['une probabilité', /\b52\b|\b26\b.*%|\b22\b.*%/],
    ['un nom de buteur', /mendy/i],
    ["l'expression « buts attendus »", /buts attendus/i],
  ] as [string, RegExp][])
    assert.ok(!motif.test(json), `${quoi} apparaît dans la réponse servie à un compte gratuit.`);
});

test("l'aperçu gratuit est spécifique à chaque affiche", async () => {
  const { toTeaser } = await import('../src/lib/analysis-teaser');

  const AFFICHES = ([
    ['Real Madrid', 'Espanyol', FORME_FORTE, FORME_FAIBLE],
    ['Arsenal', 'Coventry', FORME_FORTE, FORME_MOYENNE],
    ['Marseille', 'Strasbourg', FORME_MOYENNE, FORME_FAIBLE],
    ['Lens', 'Monaco', FORME_MOYENNE, FORME_FORTE],
  ] as [string, string, any, any][]);

  const textes: string[] = [];
  for (const [t1, t2, f1, f2] of AFFICHES)
    textes.push(String((await toTeaser(analyseComplete(t1, t2, f1, f2)) as any).apercuResume));

  assert.equal(
    new Set(textes).size,
    textes.length,
    'Deux affiches produisent le même aperçu : un texte générique ne vend rien.'
  );

  for (const t of textes) {
    assert.ok(t.length > 120, `Aperçu trop court pour donner envie : « ${t} »`);
    assert.ok(
      /Débloquez l'analyse complète/.test(t),
      "L'aperçu ne se termine plus par l'appel à l'action."
    );
  }
});

test("la route d'historique retire les colonnes payantes", () => {
  const source = lire('src/app/api/history/route.ts');

  assert.ok(
    /guard\.entitlements\.premium/.test(source),
    "La route d'historique ne regarde plus les droits : elle rendait select('*') " +
      'et servait score, probabilités, confiance et analysis_data à tout le monde.'
  );

  for (const colonne of ['win_prob', 'draw_prob', 'lose_prob', 'analysis_data', 'confidence'])
    assert.ok(
      new RegExp(`'${colonne}'`).test(source),
      `La colonne payante « ${colonne} » n'est plus dans la liste retirée aux comptes gratuits.`
    );
});

test("la liste des champs autorisés n'accueille plus le verdict", () => {
  const source = lire('src/lib/analysis-teaser.ts');
  const bloc = source.slice(source.indexOf('TEASER_FIELDS'), source.indexOf('] as const'));

  // Ces trois-là donnaient la réponse : le résumé nomme le favori et cite les
  // buts attendus, le scénario finit par le score, et la liste des scénarios
  // contient buteurs et minutes.
  for (const interdit of ['quickSummary', 'scenario', 'scenarios', 'predictedScore', 'winProb', 'expectedGoals'])
    assert.ok(
      !new RegExp(`^\\s*'${interdit}',`, 'm').test(bloc),
      `« ${interdit} » est revenu dans les champs servis aux comptes gratuits.`
    );

  // La confiance, elle, est autorisée depuis le 21 août : elle dit la solidité
  // des données, pas l'issue. Si elle disparaît, l'avant-goût perd le signal
  // qui fait sentir qu'un verdict net attend derrière le mur.
  assert.ok(
    /^\s*'confidence',/m.test(bloc),
    "La confiance a été retirée des champs gratuits : l'avant-goût perd ce qui donne envie de payer."
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  LE GARDE-FOU CONTRE UN MODÈLE QUI DÉRAPE
// ═══════════════════════════════════════════════════════════════════════════
//
//  L'aperçu est maintenant rédigé par le modèle le moins cher de la chaîne.
//  Un modèle bon marché à qui l'on interdit d'annoncer un vainqueur finit par
//  écrire « logiquement remporté par le favori ». Toute sortie passe donc un
//  contrôle avant d'atteindre le visiteur : au moindre score, pourcentage ou
//  verdict, le texte est rejeté et le gabarit prend le relais.
//
//  Ces cas sont de vraies formulations que produit ce genre de modèle.

test('le garde-fou rejette tout texte qui trahit le verdict', async () => {
  const { trahitLeVerdict } = await import('../src/lib/apercu-ia');

  const DOIVENT_ETRE_REJETES = [
    "Le Real part avec les faveurs des pronostics et devrait s'imposer sans trembler face à un Espanyol en difficulté cette saison encore.",
    "Marseille reste sur une bonne série. Notre analyse donne un score probable de 2-1 pour les Phocéens à domicile ce dimanche soir.",
    "Arsenal domine les débats avec 62 % de possession et une attaque en feu, Coventry tentera de résister comme il le pourra ce soir.",
    "Les buts attendus penchent nettement vers les Merengues au vu des attaques et des défenses en présence dans cette rencontre.",
    "La confiance de l'IA est très élevée sur cette rencontre au vu de la forme des deux équipes engagées ce week-end en championnat.",
    "Le favori de cette affiche est clairement identifié par nos modèles statistiques après examen des dernières journées disputées.",
    "Trop court.",
  ];

  for (const texte of DOIVENT_ETRE_REJETES)
    assert.ok(
      trahitLeVerdict(texte) !== null,
      `Ce texte passe le garde-fou alors qu'il trahit le verdict : « ${texte.slice(0, 70)}… »`
    );
});

test('le garde-fou laisse passer une bande-annonce honnête', async () => {
  const { trahitLeVerdict } = await import('../src/lib/apercu-ia');

  const DOIVENT_PASSER = [
    "Marseille arrive avec le plein de confiance après une série encourageante et une attaque qui trouve régulièrement le chemin des filets. En face, Strasbourg traverse une passe délicate mais reste redoutable quand il peut se projeter vite vers l'avant. Deux visages opposés du championnat se croisent, et notre analyse complète détaille ce qui devrait se jouer.",
    "Le Real s'appuie sur une défense difficile à manœuvrer et sur des attaquants en réussite depuis plusieurs journées. L'Espanyol, lui, mise sur la solidarité collective et sur sa capacité à frapper en transition quand l'espace s'ouvre. Deux approches du jeu radicalement différentes se répondent dans cette affiche.",
  ];

  for (const texte of DOIVENT_PASSER) {
    const faute = trahitLeVerdict(texte);
    assert.equal(
      faute,
      null,
      `Ce texte honnête est rejeté à tort (« ${faute} ») : « ${texte.slice(0, 70)}… »`
    );
  }
});

test("l'aperçu est mis en réserve pour n'être écrit qu'une fois par match", () => {
  const source = lire('src/lib/apercu-ia.ts');

  assert.ok(/lireReserve/.test(source), "L'aperçu ne relit plus la réserve : il serait régénéré à chaque visite.");
  assert.ok(/ecrireReserve/.test(source), "L'aperçu n'est plus mis en réserve : chaque visiteur ferait payer une génération.");
  assert.ok(
    /\.sort\(\)/.test(source),
    "La clé de réserve n'est plus triée : « Lens — PSG » et « PSG — Lens » seraient générés deux fois."
  );
  assert.ok(
    /MODELE_ECONOMIQUE/.test(source),
    "L'aperçu n'utilise plus le modèle le moins cher de la chaîne."
  );
});

test("le prompt de l'aperçu ne reçoit jamais le verdict", () => {
  const source = lire('src/lib/apercu-ia.ts');
  const debut = source.indexOf('function resumerForme');
  const fin = source.indexOf('export interface ResultatApercu');
  const bloc = source.slice(debut, fin);

  // La protection principale n'est pas le prompt, c'est ce qu'on ne transmet
  // pas. On vérifie donc que les champs du verdict n'entrent pas dans le
  // résumé envoyé au modèle.
  for (const interdit of ['predictedScore', 'winProb', 'drawProb', 'loseProb', 'scenarios', 'confidence'])
    assert.ok(
      !new RegExp(interdit).test(bloc),
      `Le champ « ${interdit} » est transmis au modèle : il pourrait le recracher.`
    );
});

test('le gabarit de secours passe son propre garde-fou', async () => {
  // Découvert en produisant la preuve : le gabarit écrivait « notre analyse
  // complète donne le favori, le score attendu… ». Le contrôle anti-fuite le
  // rejetait — à raison. Un filet de secours qui échoue à son propre contrôle
  // laisse passer, le jour où il sert, ce qu'il devait retenir.
  const { composerApercu } = await import('../src/lib/apercu-vendeur');
  const { trahitLeVerdict } = await import('../src/lib/apercu-ia');

  const AFFICHES: [string, string, any, any][] = [
    ['Real Madrid', 'Espanyol', FORME_FORTE, FORME_FAIBLE],
    ['Arsenal', 'Coventry', FORME_FORTE, FORME_MOYENNE],
    ['Marseille', 'Strasbourg', FORME_MOYENNE, FORME_FAIBLE],
    ['Lens', 'Monaco', FORME_MOYENNE, FORME_FORTE],
    ['Lille', 'Nice', FORME_FAIBLE, FORME_FAIBLE],
    ['Brest', 'Reims', FORME_MOYENNE, FORME_MOYENNE],
  ];

  for (const [t1, t2, f1, f2] of AFFICHES) {
    const texte = composerApercu(t1, t2, f1, f2);
    const faute = trahitLeVerdict(texte);
    assert.equal(
      faute,
      null,
      `Le gabarit de ${t1} — ${t2} trahit « ${faute} » : « ${texte.slice(0, 90)}… »`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  21 AOÛT 2026 — L'APERÇU AFFICHAIT DES ABSURDITÉS EN PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════
//
//  Texte réellement affiché à un compte gratuit sur Rennes — PSG :
//
//    « La première équipe reste sur 17 victoires de rang, et son attaque
//      tourne à 11.8 buts par match. Face à lui, La seconde reste sur 24
//      victoires de rang… »
//
//  Trois défauts distincts, tous visibles par n'importe quel amateur :
//
//    1. Les noms manquaient — l'analyse ne porte pas de champ `team1` au
//       premier niveau, seulement `globalForm.team1`.
//    2. « 17 victoires de rang » sous un bilan de 1-1-3 : `winStreak` donne le
//       TOTAL de victoires de la saison, pas une série en cours.
//    3. « 11.8 buts par match » : `goalsScored` compte toute la saison et
//       était divisé par cinq matchs.

test("l'aperçu nomme toujours les deux équipes", async () => {
  const { composerApercu } = await import('../src/lib/apercu-vendeur');

  // Données telles que l'API les rend : totaux de saison.
  const RENNES = { recentMatches: ['W','D','L','L','L'], goalsScored: 59, goalsConceded: 48, cleanSheets: 8, avgPossession: 52, winStreak: 17, played: 38 };
  const CITY = { recentMatches: ['L','D','W','W','L'], goalsScored: 96, goalsConceded: 34, cleanSheets: 15, avgPossession: 65, winStreak: 28, played: 38 };

  for (const [a, b, f1, f2] of [
    ['Rennes', 'Paris Saint Germain', RENNES, CITY],
    ['Manchester City', 'Rennes', CITY, RENNES],
  ] as [string, string, any, any][]) {
    const t = composerApercu(a, b, f1, f2, { competition: 'Ligue 1', stade: 'Roazhon Park' });
    assert.ok(t.includes(a), `« ${a} » n'est pas nommé dans son propre aperçu.`);
    assert.ok(t.includes(b), `« ${b} » n'est pas nommé dans son propre aperçu.`);
    assert.ok(
      !/La première équipe|La seconde/.test(t),
      `Le repli générique s'affiche alors que les noms sont connus : « ${t.slice(0, 90)}… »`
    );
  }
});

test("l'aperçu n'annonce jamais de chiffre absurde", async () => {
  const { composerApercu } = await import('../src/lib/apercu-vendeur');

  const EQUIPES = [
    { recentMatches: ['W','D','L','L','L'], goalsScored: 59, goalsConceded: 48, cleanSheets: 8, avgPossession: 52, winStreak: 17, played: 38 },
    { recentMatches: ['W','W','W','W','W'], goalsScored: 96, goalsConceded: 20, cleanSheets: 20, avgPossession: 68, winStreak: 30, played: 38 },
    { recentMatches: ['L','L','L','L','L'], goalsScored: 12, goalsConceded: 70, cleanSheets: 0, avgPossession: 35, winStreak: 2, played: 38 },
    // Début de saison : deux matchs joués, totaux minuscules.
    { recentMatches: ['W','D'], goalsScored: 4, goalsConceded: 2, cleanSheets: 1, avgPossession: 50, winStreak: 1, played: 2 },
  ];

  for (const f1 of EQUIPES)
    for (const f2 of EQUIPES) {
      const t = composerApercu('Alpha', 'Beta', f1 as any, f2 as any);

      // Une série ne peut pas dépasser le nombre de matchs de forme observés.
      const serie = t.match(/reste sur (\d+) victoires consécutives/);
      if (serie)
        assert.ok(
          Number(serie[1]) <= 5,
          `Série de ${serie[1]} victoires annoncée alors que la forme n'en montre que 5 au plus.`
        );

      // Aucune équipe ne marque 4 buts par match sur une saison.
      const moyenne = t.match(/tourne à ([\d.]+) buts par match/);
      if (moyenne)
        assert.ok(
          Number(moyenne[1]) < 4,
          `Moyenne de ${moyenne[1]} buts par match : le diviseur est faux.`
        );
    }
});

test('le garde-fou ne confond pas un bilan V-N-D avec un score', async () => {
  const { trahitLeVerdict } = await import('../src/lib/apercu-ia');

  // Un bilan à trois nombres est légitime dans une bande-annonce ; le rejeter
  // faisait retomber sur le gabarit sans raison, et l'on croyait le modèle
  // défaillant alors qu'il écrivait correctement.
  const AVEC_BILAN =
    "Rennes traverse une passe difficile (1-1-3 sur ses 5 derniers matchs) mais garde une attaque capable de faire la différence. Paris Saint Germain accroche régulièrement le nul (1-2-2) tout en trouvant la faille presque à chaque sortie de son côté.";
  assert.equal(trahitLeVerdict(AVEC_BILAN), null, 'Un bilan V-N-D est pris pour un score.');

  // Un vrai score, lui, doit toujours être rejeté.
  const AVEC_SCORE =
    "Rennes traverse une passe difficile mais garde une attaque capable de faire la différence face au Paris Saint Germain. Le match devrait se terminer sur un 2-1 au vu des dernières sorties des deux formations engagées.";
  assert.equal(trahitLeVerdict(AVEC_SCORE), 'un score', 'Un vrai score passe le garde-fou.');
});

// ═══════════════════════════════════════════════════════════════════════════
//  21 AOÛT 2026 — LA FORME RÉCENTE ÉTAIT LUE À VIDE
// ═══════════════════════════════════════════════════════════════════════════
//
//  `recentMatches` existe sous DEUX formats selon le chemin de code : des
//  lettres brutes (« W ») ou des objets { opponent, score, result }. La lecture
//  ne gérait que les lettres. Sur le format objet, chaque entrée devenait
//  « [object Object] », aucune ne commençait par W, et toute équipe ressortait
//  avec un bilan de 0-0-0.
//
//  Rien ne plantait : la forme devenait simplement muette, et le texte se
//  rabattait sur des formules vagues sans que personne ne sache pourquoi.

test('la forme récente se lit dans les deux formats', async () => {
  const { composerApercu } = await import('../src/lib/apercu-vendeur');

  const EN_LETTRES = { recentMatches: ['W','W','W','D','L'], goalsScored: 40, goalsConceded: 20, cleanSheets: 6, avgPossession: 55, played: 20 };
  const EN_OBJETS = {
    recentMatches: [
      { opponent: 'A', score: '2-0', result: 'W' },
      { opponent: 'B', score: '1-0', result: 'W' },
      { opponent: 'C', score: '3-1', result: 'W' },
      { opponent: 'D', score: '1-1', result: 'D' },
      { opponent: 'E', score: '0-2', result: 'L' },
    ],
    goalsScored: 40, goalsConceded: 20, cleanSheets: 6, avgPossession: 55, played: 20,
  };

  const adversaire = { recentMatches: ['L','L','D','L','W'], goalsScored: 15, goalsConceded: 35, cleanSheets: 1, avgPossession: 42, played: 20 };

  const avecLettres = composerApercu('Alpha', 'Beta', EN_LETTRES as any, adversaire as any);
  const avecObjets = composerApercu('Alpha', 'Beta', EN_OBJETS as any, adversaire as any);

  assert.equal(
    avecObjets,
    avecLettres,
    'Les deux formats de forme doivent produire exactement le même texte.'
  );

  // Trois victoires de suite : la série doit être vue dans les deux cas.
  assert.ok(
    /3 victoires consécutives/.test(avecObjets),
    `La série n'est pas détectée sur le format objet : « ${avecObjets.slice(0, 100)}… »`
  );
});

test("l'abonné ne reçoit jamais moins de texte que le visiteur gratuit", () => {
  const source = lire('src/app/api/analyze/route.ts');

  // Le repli servi à l'abonné doit employer le MÊME rédacteur que l'avant-goût.
  // Sinon on retombe sur « Les buts attendus penchent vers X » et un scénario
  // où l'adversaire n'est même pas nommé — vu en production sur un PRO ELITE.
  assert.ok(
    /quickSummary:\s*composerApercuVendeur\(/.test(source),
    "Le repli de l'abonné n'utilise plus le rédacteur de l'avant-goût : il servira une phrase sèche."
  );
  assert.ok(
    /content:\s*scenarioGabarit\(/.test(source),
    "Le scénario de repli n'utilise plus le rédacteur commun : l'adversaire redeviendra anonyme."
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  ★ L'ACQUIS SCELLÉ — VALIDÉ PAR LE PROPRIÉTAIRE LE 21 AOÛT 2026 ★
// ═══════════════════════════════════════════════════════════════════════════
//
//  Le propriétaire a lu ces deux textes sur Atalanta — Sassuolo et les a
//  validés à cent pour cent, après une nuit entière de corrections. C'est la
//  référence : le ton, la structure, l'équilibre entre les deux équipes.
//
//  CE TEST EST DIFFÉRENT DES AUTRES.
//
//  Les autres vérifient qu'un défaut connu n'est pas revenu. Celui-ci vérifie
//  qu'un ACQUIS n'a pas bougé. Il compare le texte mot pour mot.
//
//  S'IL ÉCHOUE, LISEZ LA DIFFÉRENCE AVANT DE TOUCHER À QUOI QUE CE SOIT.
//  Deux cas seulement :
//
//    • Le changement est une amélioration voulue et mesurée — alors mettez la
//      référence à jour ci-dessous, en connaissance de cause.
//    • Le changement est un effet de bord — alors c'est le code qu'il faut
//      corriger, pas la référence.
//
//  Ne mettez JAMAIS la référence à jour simplement pour faire passer le test.
//  Ce serait retirer le cadenas au lieu d'ouvrir la porte.

const ATALANTA = { recentMatches: ['D','W','L','W','W'], goalsScored: 74, goalsConceded: 42, cleanSheets: 13, avgPossession: 56, winStreak: 22, played: 38, name: 'Atalanta BC' };
const SASSUOLO = { recentMatches: ['L','D','L','L','W'], goalsScored: 44, goalsConceded: 73, cleanSheets: 8, avgPossession: 47, winStreak: 9, played: 38, name: 'Sassuolo' };

const RESUME_VALIDE =
  "Atalanta BC reçoit Sassuolo pour un match de Serie A. Atalanta BC arrive lancé avec 3 victoires sur ses 5 derniers matchs, et son attaque trouve la faille presque à chaque sortie. De son côté, Sassuolo traverse une passe difficile (1-1-3 sur ses 5 derniers), et son attaque reste capable de faire la différence. Difficile de départager ces deux-là à l'œil nu — notre IA a passé la rencontre au crible, minute par minute. Débloquez l'analyse complète pour tout voir.";

const SCENARIO_VALIDE =
  "Atalanta BC misera sur son volume offensif et cherchera à peser haut sur la défense adverse. De l'autre côté, Sassuolo devra d'abord resserrer ses lignes avant de songer à se projeter. La rencontre se jouera sur la capacité de chacun à imposer son plan et à contrarier celui d'en face.";

test('★ ACQUIS SCELLÉ — le Résumé rapide validé n\'a pas bougé', async () => {
  const { composerApercu } = await import('../src/lib/apercu-vendeur');
  const obtenu = composerApercu('Atalanta BC', 'Sassuolo', ATALANTA as any, SASSUOLO as any, {
    competition: 'Serie A',
    stade: null,
  });

  assert.equal(
    obtenu,
    RESUME_VALIDE,
    "\n\n  Le Résumé rapide a changé depuis sa validation.\n" +
      `  ATTENDU : ${RESUME_VALIDE}\n` +
      `  OBTENU  : ${obtenu}\n`
  );
});

test('★ ACQUIS SCELLÉ — le Scénario validé n\'a pas bougé', async () => {
  const { scenarioGabarit } = await import('../src/lib/apercu-ia');
  const obtenu = scenarioGabarit('Atalanta BC', 'Sassuolo', ATALANTA as any, SASSUOLO as any);

  assert.equal(
    obtenu,
    SCENARIO_VALIDE,
    "\n\n  Le Scénario a changé depuis sa validation.\n" +
      `  ATTENDU : ${SCENARIO_VALIDE}\n` +
      `  OBTENU  : ${obtenu}\n`
  );
});

test('★ ACQUIS SCELLÉ — aucun nom de club ne perd sa majuscule', async () => {
  // « De l'autre côté, sassuolo devra… » a été affiché en production. Un club
  // en minuscule, c'est ce qu'aucun lecteur ne pardonne à une application qui
  // se dit sérieuse.
  const { scenarioGabarit } = await import('../src/lib/apercu-ia');

  for (const [a, b] of [
    ['Atalanta BC', 'Sassuolo'],
    ['Real Madrid', 'Espanyol'],
    ['Paris Saint Germain', 'Rennes'],
  ] as [string, string][]) {
    const t = scenarioGabarit(a, b, ATALANTA as any, SASSUOLO as any);
    for (const nom of [a, b]) {
      const enMinuscule = nom.charAt(0).toLowerCase() + nom.slice(1);
      assert.ok(
        !t.includes(enMinuscule) || t.includes(nom),
        `« ${enMinuscule} » apparaît sans sa majuscule : « ${t.slice(0, 120)}… »`
      );
    }
  }
});
