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

          if (r.buts1 !== r.buts2 && Math.abs(r.probaVictoire1 - r.probaVictoire2) < 4) {
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
  assert.ok(scores.size >= 12, `Seulement ${scores.size} scores distincts sur 4 096 cas.`);
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
