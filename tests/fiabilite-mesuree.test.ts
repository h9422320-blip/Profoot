/**
 * ★ ACQUIS — ON N'AFFICHE QUE CE QU'ON A MESURÉ.
 *
 * ── D'OÙ VIENT CE FICHIER ─────────────────────────────────────────────────
 *
 * L'écran d'analyse affichait « Confiance de l'IA : Très élevée » sur 89 % des
 * analyses — 2 555 sur 2 854 — pour 49,8 % de réussite réelle. Ce nombre ne
 * mentait pas : il mesurait la SOLIDITÉ de l'analyse, pas la chance de tomber
 * juste. Mais aucun client ne fait cette distinction, et deux d'entre eux l'ont
 * écrit le 4 septembre 2026 — « profoot AI nous envoie en brousse » sous une
 * publication, « les deux jours là, ils ratent beaucoup » sur WhatsApp.
 *
 * Le moteur sait pourtant se juger. Mesuré sur 3 467 rencontres jouées :
 *
 *     match très serré   867 matchs → 35,1 %
 *     léger favori     1 285 matchs → 47,5 %
 *     favori net         926 matchs → 55,9 %
 *     favori écrasant    389 matchs → 67,9 %
 *
 * Du simple au double. C'est ce fait-là qu'on affiche désormais.
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 * Une seule chose, et elle vaut toute la crédibilité du produit : ce chiffre
 * est MESURÉ. Le jour où il serait estimé, arrondi vers le haut, ou affiché
 * sur trois rencontres, il vaudrait moins que l'ancienne note — parce qu'il
 * porte une promesse de vérité que l'autre n'avait pas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  trancheDe,
  fiabilitePour,
  MATCHS_MINIMUM_LIGUE,
  MATCHS_MINIMUM_GLOBAL,
  TRANCHES,
} from '../src/lib/fiabilite-apprise';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── LE CLASSEMENT DES MATCHS ───────────────────────────────────────────────

test('★ ACQUIS — un match se range par l’écart entre les deux issues de tête', () => {
  // C'est cet écart, et lui seul, qui sépare 35 % de réussite de 68 %.
  // ── LE CLASSEMENT SUIT LA CONFIANCE, ET NON PLUS L'ÉCART ───────────────
  //
  // Changé le 5 septembre 2026. L'écart entre les deux premières
  // probabilités était une approximation : 45/28/27 et 70/15/15 tombaient
  // dans la même famille alors que le second est bien plus sûr. On classe
  // désormais par la probabilité de l'issue annoncée, ce qui donne des
  // paliers mesurés autrement plus nets — de 58,5 % à 76,0 %.
  assert.equal(trancheDe(36, 30, 34), 'incertain', '36 % de confiance : rien n’est joué.');
  assert.equal(trancheDe(55, 25, 20), 'marque', '55 % : tendance marquée.');
  assert.equal(trancheDe(78, 14, 8), 'tresforte', '78 % : tendance très forte.');
  assert.equal(trancheDe(45, 30, 25), 'penche', '45 % : la rencontre penche.');
  assert.equal(trancheDe(64, 20, 16), 'nette', '64 % : tendance nette.');
  assert.equal(trancheDe(70, 18, 12), 'forte', '70 % : tendance forte.');

  // L'écart se mesure entre la PREMIÈRE et la DEUXIÈME, quelle qu'elle soit —
  // y compris quand c'est le nul. Comparer la victoire à domicile à la
  // victoire extérieure ferait passer un nul très probable pour un match net.
  assert.equal(
    trancheDe(40, 38, 22),
    'incertain',
    'Quarante pour cent au mieux : la rencontre reste incertaine.'
  );
});

// ── LE SILENCE PLUTÔT QUE L'À-PEU-PRÈS ─────────────────────────────────────

test('★ ACQUIS — sans matière, on n’affiche RIEN', () => {
  // « 100 % de réussite » mesuré sur trois rencontres est pire que rien : il
  // se retourne contre nous au premier match perdu.
  const maigre = {
    global: { incertain: { justes: 8, total: 10 } },
    parLigue: {},
    total: 10,
    calculeLe: new Date().toISOString(),
  } as any;
  assert.equal(fiabilitePour(maigre, 36, 30, 34, 'Ligue 1'), null);
  assert.equal(fiabilitePour(null, 36, 30, 34, 'Ligue 1'), null, 'Un relevé absent doit rester muet.');
  assert.ok(MATCHS_MINIMUM_GLOBAL >= 100, 'Le seuil global est descendu sous cent rencontres.');
});

test('★ ACQUIS — le championnat prime, mais seulement s’il a de quoi', () => {
  // La Premier League et la Jupiler Pro League n'ont pas la même
  // prévisibilité : 57,3 % contre 29,2 % sur les matchs serrés. Le chiffre
  // local est donc plus juste — tant qu'il repose sur assez de rencontres.
  const releve = {
    global: { incertain: { justes: 300, total: 867 } },
    parLigue: {
      'Ligue 1|incertain': { justes: 14, total: 59 },
      'Coupe du Bénin|incertain': { justes: 3, total: 4 },
    },
    total: 3467,
    calculeLe: new Date().toISOString(),
  } as any;

  const local = fiabilitePour(releve, 36, 30, 34, 'Ligue 1');
  assert.equal(local?.ligue, 'Ligue 1');
  assert.equal(local?.matchs, 59);
  assert.equal(local?.taux, 24);

  // Quatre rencontres ne font pas un taux : on retombe sur le global.
  const repli = fiabilitePour(releve, 36, 30, 34, 'Coupe du Bénin');
  assert.equal(repli?.ligue, null, 'Un championnat sans matière doit rendre la main au global.');
  assert.equal(repli?.matchs, 867);

  assert.ok(MATCHS_MINIMUM_LIGUE >= 40, 'Le seuil par championnat est descendu sous quarante.');
});

test('★ ACQUIS — le taux affiché est celui qui a été compté', () => {
  // Aucun arrondi complaisant, aucun plancher : 24 % s'affiche 24 %, même si
  // c'est le chiffre qui fait le moins vendre.
  const releve = {
    global: { incertain: { justes: 300, total: 867 } },
    parLigue: {},
    total: 867,
    calculeLe: new Date().toISOString(),
  } as any;
  const r = fiabilitePour(releve, 36, 30, 34, null);
  assert.equal(r?.taux, Math.round((100 * 300) / 867));
});

// ── L'ÉCRAN ────────────────────────────────────────────────────────────────

test('★ ACQUIS — l’écran retombe sur l’ancien affichage quand le chiffre manque', () => {
  // Une analyse ne doit jamais perdre son bloc parce qu'un championnat neuf
  // n'a pas encore de matière.
  const ecran = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));
  assert.match(ecran, /\{result\.fiabilite \? \(/, 'Le bloc de fiabilité mesurée a disparu.');
  assert.match(
    ecran,
    /\) : result\.confidence \? \(/,
    'Le repli sur l’ancien affichage a sauté : un match sans matière n’aurait plus rien.'
  );
  assert.match(ecran, /Fiabilité mesurée/, 'Le titre du bloc a changé.');
  assert.match(
    ecran,
    /fiabilite: data\.fiabilite \?\? null/,
    'Le champ ne voyage plus depuis le serveur.'
  );
});

test('★ ACQUIS — le serveur pose la fiabilité sur chaque analyse', () => {
  const route = sansCommentaires(lire('src/app/api/analyze/route.ts'));
  assert.match(route, /donnees\.fiabilite = fiabilitePour\(/, 'Le serveur ne calcule plus la fiabilité.');
  assert.match(
    route,
    /const releveFiabilite = await lireReleve\(\)/,
    'Le relevé n’est plus lu — ou il l’est dans une fonction non asynchrone.'
  );
});

// ── LES PALIERS SUIVENT LA CONFIANCE, ET LE SEUIL VISE LES QUATRE SUR CINQ ──

test('★ ACQUIS — les familles se lisent sur la confiance de l’issue annoncée', () => {
  /*
   * Mesuré le 5 septembre 2026 sur les 3 467 rencontres jugées, une fois le
   * classement passé de l'écart à la confiance :
   *
   *     Issue incertaine     1 309 matchs → 38,6 %
   *     La rencontre penche  1 113 matchs → 49,1 %
   *     Tendance marquée       481 matchs → 56,5 %
   *     Tendance nette         251 matchs → 61,0 %
   *     Tendance forte         145 matchs → 64,1 %
   *     Tendance très forte    168 matchs → 75,6 %
   *
   * Du simple au double. L'ancien classement par écart mélangeait 45/28/27 et
   * 70/15/15 dans la même famille, alors que le second est bien plus sûr.
   */
  const bornes = TRANCHES.map((t) => t.min);
  assert.deepEqual(
    bornes,
    [0, 45, 55, 62, 68, 74],
    'Les bornes des familles ont changé — les remesurer sur les jugements avant de les bouger.'
  );
  assert.equal(trancheDe(80, 12, 8), 'tresforte', '80 % de confiance : tendance très forte.');
  assert.equal(trancheDe(38, 30, 32), 'incertain', '38 % au mieux : rien n’est joué.');
});

test('★ ACQUIS — la sélection ne descend pas sous 70 % de fiabilité', async () => {
  /*
   * Objectif du propriétaire, le 5 septembre 2026 : que l'utilisateur qui
   * lance cinq analyses en trouve quatre justes.
   *
   * Ce seuil est la seule façon honnête d'en approcher. À 58, la sélection
   * acceptait des rencontres à 58,5 % de réussite — une sur deux, ce qui
   * n'est pas une sélection. À 70, elle ne retient que des matchs où
   * l'application a réellement raison sept à huit fois sur dix.
   *
   * Elle en propose forcément moins. C'est le prix, et c'est le bon.
   */
  const { FIABILITE_MINIMUM } = await import('../src/lib/selection-du-jour');
  assert.ok(
    FIABILITE_MINIMUM >= 70,
    `Le seuil de la sélection est retombé à ${FIABILITE_MINIMUM} : elle proposerait de nouveau des matchs qu’on rate une fois sur deux.`
  );
});

test('★ ACQUIS — la clé du relevé est versionnée', () => {
  // Le relevé range ses compteurs sous les noms des familles. Le jour où
  // celles-ci changent, un relevé rangé sous les anciennes serait relu sans
  // erreur et ne répondrait plus à rien : la fiabilité disparaîtrait de
  // l'écran pendant six heures, en silence.
  const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/fiabilite-apprise.ts'), 'utf8');
  assert.match(
    src,
    /const CLE = 'fiabilite:apprise-v\d+'/,
    'La clé de réserve a perdu son numéro de version.'
  );
});
