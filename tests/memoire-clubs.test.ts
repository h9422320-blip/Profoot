/**
 * ★ ACQUIS — LA MÉMOIRE DES CLUBS : ANCRÉE, OU MUETTE.
 *
 * ── LE TROU QU'ELLE BOUCHE ───────────────────────────────────────────────
 *
 * Le relevé des tirs ne couvre pas tous les championnats. Dès qu'un club en
 * sort, `butsAttendusOccasions` rend `null` et le moteur perd TOUTE la moitié
 * occasions de son calcul : 50 % des matchs de Ligue des champions, 41 % de
 * l'Europa League (mesuré le 12 septembre 2026).
 *
 * ── CE QUI S'EST PASSÉ LE 12 SEPTEMBRE 2026 ──────────────────────────────
 *
 * Une première version, branchée le matin, gagnait 31 vainqueurs sur 4 922
 * matchs aveugles — mais annonçait Sabah vainqueur de Manchester United (réel
 * 4-0). Une note de type Elo gonfle pour le champion d'un championnat faible,
 * faute de matchs entre pays. Elle a été retirée le même jour.
 *
 * La version ancrée recentre chaque note sur la moyenne de son championnat,
 * puis l'ancre au niveau MESURÉ de ce championnat (`forces-championnats`).
 * Mesurée : +1 et +28 vainqueurs justes, 72,0 / 68,9 % quand le moteur est sûr
 * de lui contre 64,0 %, +7 et +2 dans les coupes d'Europe, et le cas
 * Manchester United — Sabah est retrouvé.
 *
 * ── CE QUI EST GARANTI ICI ───────────────────────────────────────────────
 *
 * 1. Une mémoire SANS ancrage se tait. C'est le verrou central : la lecture de
 *    la hiérarchie peut échouer en silence sur son garde-temps de 1,5 s.
 * 2. Mémoire absente, périmée, club inconnu, club vu moins de cinq fois : elle
 *    se tait aussi.
 * 3. L'ancrage fait son travail : à dynamique interne identique, le club du
 *    championnat le mieux coté est donné favori.
 * 4. Le moteur ne bouge pas d'un centième quand l'avis est nul.
 * 5. La production ne la consulte que là où les occasions manquent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  avisDeLaMemoire,
  calculerMemoireClubs,
  ECHELLE_HIERARCHIE,
  PART_MEMOIRE,
  PART_MEMOIRE_HAUTE,
  MATCHS_POUR_PART_PLEINE,
  partDeLaMemoire,
  type MemoireClubs,
} from '../src/lib/memoire-clubs';
import { calculerScoreProbable } from '../src/lib/score-probable';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** n rencontres d'un championnat où le club `fort` bat toujours le club `faible`. */
const serie = (ligue: number, fort: number, faible: number, n: number) => {
  const l = [];
  for (let i = 0; i < n; i++)
    l.push({ date: `2026-0${1 + (i % 9)}-1${i % 9}T12:00:00+00:00`, ligue, dom: fort, ext: faible, bd: 2, be: 0 });
  return l;
};

/** Deux championnats, l'un coté 1,60 et l'autre 1,00, même dynamique interne. */
const deuxChampionnats = () =>
  calculerMemoireClubs([...serie(39, 1, 2, 10), ...serie(419, 3, 4, 10)], {
    coefficients: { '39': 1.6, '419': 1.0 },
  });

test('★ ACQUIS — une mémoire SANS ancrage se tait', () => {
  // Exactement le cas du 12 septembre au matin : la hiérarchie n'avait pas été
  // lue (garde-temps de 1,5 s), la mémoire notait Sabah devant Manchester
  // United, et elle a été branchée.
  const sansAncrage = calculerMemoireClubs(serie(39, 1, 2, 10), { coefficients: null });
  assert.equal(sansAncrage.championnatsAncres, 0, 'Sans coefficients, aucun championnat ne peut être ancré.');
  assert.equal(
    avisDeLaMemoire(sansAncrage, 1, 2),
    null,
    'Une mémoire non ancrée DOIT se taire : sans le niveau des championnats, elle met le champion d’un petit pays devant Manchester United.'
  );
});

test('★ ACQUIS — mémoire absente, périmée, club inconnu ou trop peu vu : elle se tait', () => {
  assert.equal(avisDeLaMemoire(null, 1, 2), null);
  assert.equal(avisDeLaMemoire(undefined, 1, 2), null);

  const memoire = deuxChampionnats();
  assert.ok(avisDeLaMemoire(memoire, 1, 2), 'Deux clubs bien connus et ancrés devraient donner un avis.');
  assert.equal(avisDeLaMemoire(memoire, 1, 999), null, 'Un club inconnu doit faire taire la mémoire.');

  const maigre = calculerMemoireClubs([...serie(39, 1, 2, 3), ...serie(419, 3, 4, 10)], {
    coefficients: { '39': 1.6, '419': 1.0 },
  });
  assert.equal(avisDeLaMemoire(maigre, 1, 2), null, 'Moins de cinq rencontres : la note ne décrit rien.');

  const vieille: MemoireClubs = { ...memoire, calculeLe: new Date(Date.now() - 60 * 24 * 3600_000).toISOString() };
  assert.equal(avisDeLaMemoire(vieille, 1, 2), null, 'Une mémoire de deux mois ne parle plus des équipes d’aujourd’hui.');
});

test('★ ACQUIS — l’ancrage place les championnats à leur niveau mesuré', () => {
  const memoire = deuxChampionnats();
  assert.equal(memoire.echelle, ECHELLE_HIERARCHIE);
  assert.equal(memoire.championnatsAncres, 2);

  const fortDansGrandChampionnat = Number(memoire.notes['1']);
  const fortDansPetitChampionnat = Number(memoire.notes['3']);
  assert.ok(
    fortDansGrandChampionnat > fortDansPetitChampionnat,
    'À dynamique interne identique, le club du championnat le mieux coté doit être mieux noté : c’est tout l’objet de l’ancrage.'
  );

  // Et l'écart doit valoir l'ancrage : 400 × ln(1,6 / 1,0) ≈ 188 points.
  const attendu = ECHELLE_HIERARCHIE * Math.log(1.6);
  assert.ok(
    Math.abs(fortDansGrandChampionnat - fortDansPetitChampionnat - attendu) < 1,
    `L’écart entre les deux championnats devrait valoir ${attendu.toFixed(0)} points.`
  );

  const avis = avisDeLaMemoire(memoire, 1, 3)!;
  assert.ok(avis.dom > avis.ext, 'Le club du championnat le mieux coté, qui reçoit, doit être favori.');
  assert.ok(Math.abs(avis.dom + avis.nul + avis.ext - 1) < 1e-9, 'Les trois parts doivent faire 100 %.');
  assert.equal(avis.poids, PART_MEMOIRE);
});

test('★ ACQUIS — le moteur ne bouge pas d’un centième quand la mémoire est absente', () => {
  const s1 = { butsMarques: 20, butsEncaisses: 12, matchsJoues: 10 };
  const s2 = { butsMarques: 14, butsEncaisses: 16, matchsJoues: 10 };
  const avant: any = calculerScoreProbable(s1 as any, s2 as any, true, false, undefined, null, undefined, false, 1, null);
  const apres: any = calculerScoreProbable(s1 as any, s2 as any, true, false, undefined, null, undefined, false, 1, null, null, null);
  assert.equal(apres.buts1, avant.buts1);
  assert.equal(apres.buts2, avant.buts2);
  assert.equal(apres.probaVictoire1, avant.probaVictoire1);
  assert.equal(apres.probaNul, avant.probaNul);
  assert.equal(apres.probaVictoire2, avant.probaVictoire2);
});

test('★ ACQUIS — la production ne consulte la mémoire que si les occasions manquent', () => {
  for (const f of ['src/app/api/analyze/route.ts', 'src/lib/precalcul-selection.ts']) {
    const s = sansCommentaires(fs.readFileSync(f, 'utf8'));
    assert.match(s, /avisDeLaMemoire/, `${f} ne consulte plus la mémoire des clubs.`);
    assert.match(
      s,
      /occasionsDuMatch\s*\r?\n?\s*\?\s*null\s*\r?\n?\s*:\s*avisDeLaMemoire|occasionsDuMatch \? null : avisDeLaMemoire/,
      `${f} doit passer la mémoire UNIQUEMENT quand les occasions manquent : appliquée partout, elle dégrade le pronostic (couche Elo refusée le 11 septembre 2026).`
    );
  }
});

test('★ ACQUIS — la part de la mémoire monte quand le moteur sait moins', () => {
  // ── POURQUOI ────────────────────────────────────────────────────────────
  //
  // Sur Manchester United — Sabah du 10 septembre 2026, United n'avait joué
  // AUCUN match de la compétition : les moyennes du moteur venaient d'un
  // complément, et la mémoire n'entrait pourtant qu'à 60 %. Mesuré sur 4 042
  // matchs : part pleine sous cinq matchs connus, +11 vainqueurs justes et
  // 71,9 / 70,6 % de réussite quand le moteur est sûr de lui contre 67,5 %.
  // Les deux fenêtres de mesure passent la porte du challenger.
  assert.equal(partDeLaMemoire(0), PART_MEMOIRE_HAUTE, 'Aucun match connu : la mémoire doit prendre toute la place.');
  assert.equal(partDeLaMemoire(null), PART_MEMOIRE_HAUTE, 'Sans information, la mémoire doit prendre toute la place.');
  assert.equal(partDeLaMemoire(MATCHS_POUR_PART_PLEINE), PART_MEMOIRE, 'Au seuil, on revient à la part ordinaire.');
  assert.equal(partDeLaMemoire(25), PART_MEMOIRE, 'Bien renseigné, le moteur garde la main.');

  const entreDeux = partDeLaMemoire(2);
  assert.ok(
    entreDeux < PART_MEMOIRE_HAUTE && entreDeux > PART_MEMOIRE,
    'Entre les deux, la part doit descendre en dégradé et non d’un coup.'
  );
  assert.ok(partDeLaMemoire(1) > partDeLaMemoire(4), 'Plus le moteur en sait, moins la mémoire pèse.');
});

test('★ ACQUIS — la production calcule cette part à partir des matchs connus', () => {
  for (const f of ['src/app/api/analyze/route.ts', 'src/lib/precalcul-selection.ts']) {
    const s = sansCommentaires(fs.readFileSync(f, 'utf8'));
    assert.match(s, /partDeLaMemoire\(Math\.min\(/, `${f} ne règle plus la part selon ce que le moteur sait du match.`);
  }
});
