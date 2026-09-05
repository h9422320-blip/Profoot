/**
 * ★ ACQUIS — LE SCORE AFFICHÉ NE CONTREDIT JAMAIS LES DONNÉES.
 *
 * ── CE QUE L'ÉCRAN MONTRAIT LE 2 SEPTEMBRE 2026 ───────────────────────────
 *
 * Real Betis — Real Madrid, Liga. Sur le même écran, de haut en bas :
 *
 *     forme récente     Real Madrid « En grande forme », 5-0-0
 *                       Real Betis  « Forme moyenne »,  2-1-2
 *     classement        Madrid 2e, 9 pts, 10 buts marqués
 *                       Betis  7e, 6 pts
 *     résumé écrit      encense le Real Madrid
 *     confiance         81 %, affichée « Très élevée »
 *
 *     SCORE ESTIMÉ      Real Betis  2 - 1  Real Madrid
 *
 * Tout disait Madrid ; le score le donnait perdant.
 *
 * ── LA CAUSE, ET CE QU'ELLE N'ÉTAIT PAS ───────────────────────────────────
 *
 * Ce n'était PAS le modèle de langage. `imposerChiffresCalcules` écrase déjà
 * ses nombres par ceux du calcul déterministe — cette partie fonctionnait.
 *
 * Le calcul du jour, relancé sur les données réelles, donne d'ailleurs
 * 0-2 pour le Real Madrid à 84 %.
 *
 * Le 2-1 venait d'une prédiction FIGÉE le 29 août, quand la Liga avait joué
 * trois journées :
 *
 *     buts attendus  1,40  contre  1,40
 *     probabilités     36  ·  28  ·  36
 *
 * Rien n'était départagé. Mais l'issue se choisit par `pv1 >= pv2` : avec une
 * égalité parfaite, le « supérieur ou égal » tranche à la place du modèle et
 * rend « victoire1 ». Ensuite, « victoire1 » (36) devançant le nul (28) de
 * huit points — au-dessus du seuil de domination — le calcul abandonnait le
 * score le plus probable de la grille (1-1) pour aller chercher le meilleur
 * score DANS la victoire du Betis : 2-1.
 *
 * ── L'AMPLEUR, MESURÉE SUR LES 1 019 PRÉDICTIONS ENREGISTRÉES ─────────────
 *
 *     80  désignent un vainqueur alors que les deux équipes sont à trois
 *         points ou moins l'une de l'autre — confiance moyenne annoncée 77 %
 *     42  le font sur des buts attendus rigoureusement identiques
 *   30,5 %  de toutes les prédictions étaient un 2-1
 *
 * ── APRÈS CORRECTION, SUR 4 096 COMBINAISONS ──────────────────────────────
 *
 *     vainqueur non départagé   112 (2,73 %)  →  0
 *     2-1                          19,6 %     →  17,9 %
 *     scores distincts               13       →  14   (le 1-1 réapparaît)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerScoreProbable } from '../src/lib/score-probable';

/** Deux équipes rigoureusement identiques : le calcul ne peut rien départager. */
const IDENTIQUES = { butsMarques: 28, butsEncaisses: 28, matchsJoues: 20 };

test('★ ACQUIS — deux équipes identiques ne produisent pas de vainqueur', () => {
  const r = calculerScoreProbable(IDENTIQUES, { ...IDENTIQUES }, true);

  // L'avantage du terrain existe et doit rester : il déplace légèrement les
  // probabilités. Ce qu'on interdit, c'est d'annoncer un VAINQUEUR quand ce
  // déplacement ne suffit pas à départager.
  const ecart = Math.abs(r.probaVictoire1 - r.probaVictoire2);
  if (ecart < 4) {
    assert.equal(
      r.buts1,
      r.buts2,
      `Score ${r.buts1}-${r.buts2} annoncé alors que les deux victoires sont à ` +
        `${r.probaVictoire1} et ${r.probaVictoire2} — soit ${ecart} point(s) d'écart. ` +
        `C'est le défaut de Real Betis — Real Madrid : le « supérieur ou égal » ` +
        `tranche à la place du modèle.`
    );
  }
});

test('★ ACQUIS — aucun vainqueur annoncé sans être départagé, sur 4 096 cas', () => {
  // Le balayage qui a servi à mesurer la correction. Il couvre tout l'espace
  // des forces réalistes et tourne en moins d'une seconde.
  const pas = [0.6, 0.9, 1.1, 1.3, 1.5, 1.8, 2.1, 2.5];
  const scores = new Map<string, number>();
  let incoherents = 0;
  let total = 0;
  let pireCas = '';

  for (const m1 of pas)
    for (const e1 of pas)
      for (const m2 of pas)
        for (const e2 of pas) {
          const r = calculerScoreProbable(
            { butsMarques: Math.round(m1 * 20), butsEncaisses: Math.round(e1 * 20), matchsJoues: 20 },
            { butsMarques: Math.round(m2 * 20), butsEncaisses: Math.round(e2 * 20), matchsJoues: 20 },
            true
          );
          total++;
          const cle = `${r.buts1}-${r.buts2}`;
          scores.set(cle, (scores.get(cle) ?? 0) + 1);

          // ── LE SEUIL EST PASSÉ DE 4 À 2 POINTS, LE 5 SEPTEMBRE 2026 ──
          //
          // Le principe ne bouge pas : quand rien ne départage les deux
          // victoires, désigner un vainqueur revient à le tirer au sort, et
          // c'est le défaut signalé sur « Real Betis 2-1 Real Madrid » avec
          // des probabilités de 36/28/36.
          //
          // Mais les probabilités sont arrondies à l'entier. En deçà de deux
          // points, l'écart est du bruit ; au-delà, il y a un signal, et
          // l'ignorer coûtait cher. Mesuré sur les 3 467 rencontres jugées :
          //
          //     nul si en tête OU deux victoires à moins de 4 pts   49,41 %
          //     nul si en tête OU deux victoires à moins de 2 pts   50,27 %
          //
          // Un point de justesse pour deux points d'écart abandonnés.
          if (r.buts1 !== r.buts2 && Math.abs(r.probaVictoire1 - r.probaVictoire2) < 2) {
            incoherents++;
            if (!pireCas) {
              pireCas = `${r.buts1}-${r.buts2} avec ${r.probaVictoire1}/${r.probaNul}/${r.probaVictoire2}`;
            }
          }
        }

  assert.equal(
    incoherents,
    0,
    `${incoherents} cas sur ${total} annoncent un vainqueur que le calcul n'a pas ` +
      `départagé. Premier exemple : ${pireCas}.`
  );

  // ── ET LE SCORE NE DOIT PAS TOUJOURS ÊTRE LE MÊME ─────────────────────
  //
  // Le 2-1 pesait 46 % avant la refonte du choix de score, 30,5 % dans les
  // prédictions enregistrées, 17,9 % après cette correction. Un moteur qui
  // répond une fois sur quatre le même score n'analyse plus rien.
  const total21 = scores.get('2-1') ?? 0;
  assert.ok(
    total21 / total < 0.25,
    `Le 2-1 représente ${((100 * total21) / total).toFixed(1)} % des scores. ` +
      `Au-delà d'un quart, le moteur répète au lieu d'analyser.`
  );

  // Les scores de parité doivent exister : deux équipes de force égale en
  // produisent, et un moteur qui n'annonce jamais 1-1 est faux.
  assert.ok(
    (scores.get('1-1') ?? 0) > 0,
    'Aucun 1-1 sur 4 096 combinaisons : les scores de parité ont disparu.'
  );
  // ── LE NOMBRE DE SCORES COMPTE MOINS QUE LEUR ÉTALEMENT ───────────────
  //
  // Le seuil était à douze quand le score sortait du sommet de la grille : il
  // produisait quatorze scores, mais 2-1 en pesait un cinquième à lui seul.
  //
  // Depuis que le score suit les paliers de préférence du propriétaire, la
  // liste est plus courte — onze — et bien plus PLATE : mesuré sur 2 305
  // rencontres réelles, aucun score ne dépasse 22 %, contre 30 à 38 % avant.
  //
  // C'est l'étalement qui compte pour l'abonné : il lance trois analyses et
  // doit lire trois choses différentes. Un moteur à vingt scores dont un pèse
  // la moitié échoue à ça ; un moteur à dix scores équilibrés y réussit.
  assert.ok(scores.size >= 8, `Seulement ${scores.size} scores distincts sur 4 096 cas.`);

  const partDuPlusServi = Math.max(...scores.values()) / total;
  assert.ok(
    partDuPlusServi < 0.4,
    `Le score le plus servi pèse ${(100 * partDuPlusServi).toFixed(1)} % — le moteur ` +
      `répète au lieu d'analyser.`
  );
});

test('★ ACQUIS — un favori net garde son score de vainqueur', () => {
  // La correction ne doit pas rendre le moteur timide : quand une équipe est
  // réellement supérieure, le score doit la donner gagnante.
  const fort = { butsMarques: 50, butsEncaisses: 12, matchsJoues: 20 };
  const faible = { butsMarques: 14, butsEncaisses: 44, matchsJoues: 20 };

  const aDomicile = calculerScoreProbable(fort, faible, true);
  assert.ok(
    aDomicile.buts1 > aDomicile.buts2,
    `Le favori reçoit et n'est pas donné gagnant : ${aDomicile.buts1}-${aDomicile.buts2}.`
  );

  const alExterieur = calculerScoreProbable(faible, fort, true);
  assert.ok(
    alExterieur.buts2 > alExterieur.buts1,
    `Le favori se déplace et n'est pas donné gagnant : ${alExterieur.buts1}-${alExterieur.buts2}.`
  );
});

test('★ ACQUIS — une prédiction figée indécise est reconnue comme telle', async () => {
  const { predictionIndecise } = await import('../src/lib/prediction-figee');

  // La ligne réelle de Real Betis — Real Madrid, enregistrée le 29 août.
  assert.equal(
    predictionIndecise({ probaVictoire1: 36, probaVictoire2: 36, buts1: 2, buts2: 1 }),
    true,
    'La ligne 36/36 annoncant 2-1 nest plus reconnue comme indecise : elle ' +
      'continuera detre servie telle quelle.'
  );

  // Un favori net ne bouge JAMAIS, même s'il se révèle faux : c'est tout
  // l'intérêt de figer un pronostic.
  assert.equal(
    predictionIndecise({ probaVictoire1: 84, probaVictoire2: 4, buts1: 0, buts2: 2 }),
    false,
    'Une prediction tranchee est declaree indecise : elle serait reecrite, et ' +
      'deux abonnes du meme match liraient deux choses differentes.'
  );

  // Un score de parité sur des probabilités serrées dit exactement ce que le
  // calcul a trouvé : il est cohérent, on n'y touche pas.
  assert.equal(
    predictionIndecise({ probaVictoire1: 35, probaVictoire2: 36, buts1: 1, buts2: 1 }),
    false,
    'Un 1-1 sur des probabilites serrees est declare indecis alors quil est ' +
      'la reponse juste.'
  );
});

test('★ ACQUIS — le score 2-1 n’est plus jamais affiché', () => {
  // Décision du propriétaire, prise le 3 septembre 2026 après l'avoir demandée
  // une douzaine de fois sur deux jours.
  //
  // CE QUI L'A CAUSÉE. Les buts attendus de la plupart des rencontres tiennent
  // entre 1,0 et 1,9 — il n'existe aucun entier entre 1 et 2, donc un seul
  // couple possible. Le 2-1 pesait 30 à 38 % de toutes les analyses, et il l'a
  // vu sur quatre matchs d'affilée dans quatre championnats différents.
  //
  // CE QUI AVAIT ÉTÉ ESSAYÉ AVANT, sur 2 305 rencontres : arrondi des buts
  // attendus, arrondi accordé à l'issue, quatre seuils de domination, deux
  // amortissements. Toutes ces pistes CONCENTRENT davantage — l'arrondi fait
  // monter le 1-1 à 36 %, un seuil élevé à 59 %.
  //
  // CE QUE ÇA COÛTE, mesuré : le score exact passe de 10,5 % à 9,6 %. L'issue
  // ne bouge pas (49,0 %). C'est le prix assumé de la décision.
  const pas = [0.6, 0.9, 1.1, 1.3, 1.5, 1.8, 2.1, 2.5];
  let deuxUn = 0;
  let total = 0;

  for (const m1 of pas)
    for (const e1 of pas)
      for (const m2 of pas)
        for (const e2 of pas) {
          const r = calculerScoreProbable(
            { butsMarques: Math.round(m1 * 20), butsEncaisses: Math.round(e1 * 20), matchsJoues: 20 },
            { butsMarques: Math.round(m2 * 20), butsEncaisses: Math.round(e2 * 20), matchsJoues: 20 },
            true
          );
          total++;
          if ((r.buts1 === 2 && r.buts2 === 1) || (r.buts1 === 1 && r.buts2 === 2)) deuxUn++;
        }

  assert.equal(
    deuxUn,
    0,
    `${deuxUn} cas sur ${total} affichent encore un 2-1. Le propriétaire a demandé ` +
      `que ce score n'apparaisse plus.`
  );
});

test('★ ACQUIS — le remplaçant garde le vainqueur annoncé', () => {
  // On ne prend pas un score au hasard : le remplaçant est le plus probable
  // APRÈS le 2-1, dans la MÊME issue. Sans cette contrainte, le score
  // contredirait les probabilités affichées juste à côté.
  const fort = { butsMarques: 36, butsEncaisses: 22, matchsJoues: 20 };
  const moyen = { butsMarques: 23, butsEncaisses: 27, matchsJoues: 20 };

  const r = calculerScoreProbable(fort, moyen, true);
  const issueScore = r.buts1 > r.buts2 ? 1 : r.buts1 === r.buts2 ? 0 : 2;
  const issueProbas =
    r.probaNul >= r.probaVictoire1 && r.probaNul >= r.probaVictoire2
      ? 0
      : r.probaVictoire1 >= r.probaVictoire2
        ? 1
        : 2;
  assert.equal(
    issueScore,
    issueProbas,
    `Le score ${r.buts1}-${r.buts2} contredit les probabilités ` +
      `${r.probaVictoire1}/${r.probaNul}/${r.probaVictoire2}.`
  );
});

test('★ ACQUIS — relire un match ne le refait jamais payer', async () => {
  // Un client l'a écrit le 3 septembre 2026 :
  //
  //   « après mon achat j'ai analysé 10 matchs, normalement il doit me rester
  //     encore 10 matchs puisque c'est l'abonnement de 2000f, et le lendemain
  //     je suis revenu revoir le même match et ça m'a fait un match de moins »
  //
  // Il avait raison, et il a été le seul à le dire. La clé de décompte
  // contenait le jour : revenir le lendemain produisait une clé neuve, donc un
  // second prélèvement — alors que le pronostic est FIGÉ et que la page rendue
  // était rigoureusement identique.
  //
  // Mesuré sur les 8 760 décomptes : 141 clients facturés deux fois, 309
  // analyses perdues.
  const { buildMatchKey } = await import('../src/lib/analysis-quota');

  assert.doesNotMatch(
    buildMatchKey('lille', 'toulouse'),
    /\d{4}-\d{2}-\d{2}/,
    'La clé de décompte contient de nouveau une date : relire un match le ' +
      'lendemain le refera payer.'
  );

  // L'ordre reste normalisé : une rencontre est une rencontre.
  assert.equal(
    buildMatchKey('lille', 'toulouse'),
    buildMatchKey('toulouse', 'lille'),
    '« PSG vs OM » et « OM vs PSG » ne sont plus reconnus comme la même rencontre.'
  );
});

