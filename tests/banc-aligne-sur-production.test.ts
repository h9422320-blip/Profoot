/**
 * ★ ACQUIS — LE BANC D'ESSAI MESURE CE QUE LA PRODUCTION FAIT VRAIMENT.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────
 *
 * Le 12 septembre 2026, la mémoire des clubs est passée en production : là où
 * les occasions manquent, le moteur reprend son avis sur qui domine. Si le
 * « moteur de référence » du challenger ignorait ce changement, chaque couche
 * serait comparée à un moteur qui n'existe plus — et une couche qui ne fait que
 * retrouver ce que la production sait déjà paraîtrait gagnante.
 *
 * De même, le fichier des tirs du challenger contient désormais quatre
 * championnats à l'essai (Roumanie, Serbie, Irlande, Finlande) que le relevé de
 * production NE CONNAÎT PAS. Le relevé du moteur de référence doit les écarter,
 * sinon il serait meilleur que le vrai.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Le moteur de référence reçoit l'avis de la mémoire sur les matchs aveugles.
 * 2. Le relevé de référence inclut les championnats que la production connaît
 *    — les quatre ajoutés le 12 septembre 2026 compris — et la mécanique
 *    d'essai (`TIRS_EN_PLUS` + couche `tirs-elargis`) reste en place pour la
 *    prochaine vague.
 * 3. Les mêmes conditions qu'en production : occasions absentes, et cinq
 *    rencontres au moins pour chaque club.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const source = () => sansCommentaires(fs.readFileSync('scripts/challenger/evaluer.mts', 'utf8'));

test('★ ACQUIS — le moteur de référence du banc inclut la mémoire des clubs', () => {
  const s = source();
  assert.match(s, /const avisDeLaProduction = /, 'Le banc ne connaît plus l’avis de la production.');
  assert.match(
    s,
    /calculerScoreProbable\(s1, s2, true, false, classementsDe\(m\), forcesDe\(m\), undefined, croisePour\(m\), rapportPour\(m\), occ, corrEnLigne\(m\), avisDeLaProduction\(m\)\)/,
    'Le moteur de référence doit recevoir l’avis de la mémoire, comme la production depuis le 12 septembre 2026.'
  );
});

test('★ ACQUIS — le moteur de référence porte l’élan, le terrain et le repos', () => {
  // ── CE QUI EST ARRIVÉ, ET QUI A DURÉ CINQ NUITS ─────────────────────────
  //
  // Le 16 septembre 2026, l'élan, le terrain par championnat et le repos sont
  // passés en production, au onzième point d'entrée du moteur. Le moteur de
  // référence du banc, lui, y passait `null` : il était AMPUTÉ de sa première
  // couche.
  //
  // Mesuré le 21 septembre sur 3 548 rencontres des cinq grands championnats :
  // le vrai moteur trouve 1 827 vainqueurs justes, l'amputé 1 817. Dix matchs
  // d'avance offerts à n'importe quelle couche — et le challenger a proposé
  // trois nuits de suite une couche qui, pour l'essentiel, ne faisait que
  // remettre ce que le banc avait enlevé.
  //
  // Une couche qui écrivait la correction DE ZÉRO effaçait au passage l'élan,
  // le terrain et le repos. Elle n'était donc pas mesurée « en plus » mais
  // « à la place » — exactement la famille d'erreurs que `corrEnLigne` avait
  // été écrit pour clore.
  const s = source();
  assert.match(s, /function corrEnLigne\(/, 'La correction de production a disparu du banc.');
  assert.doesNotMatch(
    s,
    /rapportPour\(m\), occ, null,/,
    'Une variante repasse `null` au onzième point d’entrée : elle efface l’élan, le terrain et le repos de la production.'
  );
  assert.match(s, /function sommerCorrections\(/, 'Les couches ne savent plus s’ajouter à la correction de production.');
});

test('★ ACQUIS — le banc applique les mêmes conditions que la production', () => {
  const s = source();
  // Le 14 septembre 2026, l’avis de la mémoire a commencé à être CALCULÉ pour
  // tous les matchs, afin qu’une couche à l’essai puisse le consulter ailleurs.
  // La garantie ci-dessous n’a pas bougé d’un pouce, elle est seulement dite
  // plus directement : ce que le MOTEUR DE RÉFÉRENCE consulte, lui, reste
  // réservé aux matchs sans occasions, comme la production.
  assert.match(
    s,
    /if \(!occ\) avisProduction\.set\(/,
    'L’avis de la production doit être réservé aux matchs SANS occasions.'
  );
  // Et rien d’autre ne doit alimenter cette table : une seule porte d’entrée,
  // sinon la garantie ci-dessus se contourne sans que personne ne le voie.
  assert.equal(
    (s.match(/avisProduction\.set\(/g) ?? []).length,
    1,
    'L’avis de la production ne doit être posé qu’à un seul endroit, sous la condition des matchs aveugles.'
  );
  assert.match(s, /< 5 \|\| \(joues\.get\(m\.ext\) \?\? 0\) < 5/, 'Le seuil de cinq rencontres par club doit être le même qu’en production.');
  assert.match(s, /const PART_PRODUCTION = 0\.6;/, 'La part de la mémoire doit être celle de la production (0,6).');
});

test('★ ACQUIS — le banc ancre les statistiques comme la production', () => {
  // ── CE QUE CE GARDE-FOU A COÛTÉ AVANT D’EXISTER ─────────────────
  //
  // Le 14 septembre 2026, une couche qui donnait aux clubs peu vus un passé
  // de huit mois gagnait +12 et +12 vainqueurs justes. Elle allait être mise
  // en ligne.
  //
  // Elle ne gagnait rien. Le banc jugeait les clubs sur la SEULE saison en
  // cours, quand la production mélange depuis toujours les douze derniers
  // matchs toutes compétitions confondues, avec un poids de cinq. La couche
  // ne faisait que rattraper une ancre que le vrai moteur avait déjà. Une
  // fois l’ancre posée au banc, le même essai tombe à −2 et +2.
  //
  // Sans ancre, le banc décrit un moteur plus faible que le vrai sur toutes
  // les rencontres de début de saison. Toute couche qui apporte du passé y
  // paraît gagnante. C’est la mesure elle-même qui ment, et aucune porte ne
  // peut rattraper cela.
  const s = source();
  assert.match(
    s,
    /melangerStatistiques\(brut1, referenceAvant\(m\.dom, m\)\)/,
    'Le banc doit mélanger les statistiques de saison à l’ancre, comme la production.'
  );
  assert.match(
    s,
    /const REFERENCE_DERNIERS = 12;/,
    'L’ancre doit porter sur les douze derniers matchs, comme `?team=&last=12` en production.'
  );
  // Et la fenêtre doit rester toutes compétitions confondues : `parEquipe`
  // porte toutes les rencontres, là où `statsAvant` filtre ligue et saison.
  assert.match(
    s,
    /function referenceAvant\(equipe: number, m: any\) \{\s*\n\s*const liste = parEquipe\.get\(equipe\)/,
    'L’ancre doit lire toutes les compétitions, pas le seul championnat de la rencontre.'
  );
});

test('★ ACQUIS — le banc passe le classement, comme la production', () => {
  // Deuxième écart de la même famille que l’ancre, trouvé le 14 septembre 2026.
  // La production passe à `calculerScoreProbable` le classement des deux clubs
  // (`{ points, pointsMoyens }`), dont `forceDepuisClassement` tire un
  // multiplicateur borné à ±15 % sur la force de chaque équipe. Le banc passait
  // `undefined` : il ignorait jusqu’à trente points d’écart entre un premier et
  // un dernier de championnat.
  //
  // ET LE CHAMPIONNAT LU EST CELUI DU CLUB, JAMAIS CELUI DE LA RENCONTRE.
  // `t1League` vient de `resoudreChampionnat`, qui ne retient que les
  // compétitions de type « League ». Pour une Ligue des champions, la
  // production lit la Liga pour l’un et la Bundesliga pour l’autre, jamais la
  // table du groupe européen.
  //
  // Ce détail décide d’une mise en ligne : classement pris sur la compétition
  // du MATCH, la couche élan + terrain tombe à +10/−2 et serait retirée à tort ;
  // pris sur le championnat du CLUB, elle rend +10/+1 et passe la porte.
  const s = source();
  assert.ok(
    !/true, false, undefined/.test(s),
    'Aucun appel du banc ne doit laisser le classement vide.'
  );
  assert.match(
    s,
    /const ligue = championnatDuClub\.get\(String\(equipe\)/,
    'Le classement doit être lu dans le championnat du CLUB, pas dans la compétition de la rencontre.'
  );
  // Et sans fuite : la rencontre n’entre dans la table qu’APRÈS avoir été jugée.
  const i = s.indexOf('classementDe.set(Number(m.id)');
  const j = s.indexOf('pointsDuClub.set(cd,');
  assert.ok(i > 0 && j > i, 'Les points de la rencontre doivent être encaissés APRÈS la lecture du classement, sinon le banc connaît le résultat.');
});

test('★ ACQUIS — le banc ajuste les forces à l’adversaire, comme la production', () => {
  // Troisième écart de la même famille, trouvé le 14 septembre 2026.
  //
  // La production appelle `lireForcesLigue(ligue, saison)` et, quand le
  // résultat est fiable pour les DEUX clubs, passe ces forces à
  // `calculerScoreProbable`, où elles REMPLACENT les moyennes brutes. Une
  // force d’attaque et de défense par club, corrigée de la force des
  // adversaires réellement rencontrés, avec la saison précédente pour socle.
  // Le banc passait `null` : il ignorait tout un moteur.
  //
  // Ce que cet oubli a coûté : la couche `force-adversaire` du 14 septembre
  // essayait exactement cela, et perdait — elle perdait parce que la
  // production le faisait déjà, en mieux.
  const s = source();
  assert.ok(
    !/classementsDe\(m\), null,/.test(s),
    'Aucun appel du banc ne doit laisser les forces ajustées à `null`.'
  );
  assert.match(
    s,
    /if \(!f\?\.fiable \|\| !f1 \|\| !f2\) return null;/,
    'Sans socle fiable pour les DEUX clubs, le banc ne doit pas basculer — même condition qu’en production.'
  );
  // Et la limite de temps doit rester antérieure à la rencontre jugée.
  assert.match(
    s,
    /\.filter\(\(x\) => Date\.parse\(x\.date\) < limite\)/,
    'Les forces ne doivent être bâties que sur ce qui précède la limite, sinon le banc connaît l’avenir.'
  );
});

test('★ ACQUIS — le banc connaît les rencontres entre championnats', () => {
  // Quatrième et cinquième écarts, trouvés le 14 septembre 2026 en comparant
  // les douze arguments de `calculerScoreProbable` un à un.
  //
  // La production passe `comparaisonCroisee` (les deux clubs jouent-ils dans
  // le même championnat ?) et `rapportEntreChampionnats` (ce que vaut celui de
  // l'un face à celui de l'autre, mesuré sur 34 101 rencontres). Le banc
  // passait `false` et `1` : pour lui, une finale de Ligue des champions était
  // un match de championnat entre deux pays équivalents.
  const s = source();
  assert.ok(
    !/undefined, false, 1,/.test(s),
    'Aucun appel du banc ne doit supposer deux championnats équivalents.'
  );
  assert.match(
    s,
    // `hierarchieEnCours()` (21 septembre 2026) rend celle de la production,
    // sauf pour une variante qui en mesure une autre.
    /rapportEntreChampionnats\((hierarchie|hierarchieEnCours\(\)) as any, ligueDuClubPour\(m, Number\(m\.dom\)\), ligueDuClubPour\(m, Number\(m\.ext\)\)\)/,
    'Le rapport doit se lire entre les championnats des deux CLUBS, comme `t1League` et `t2League` en production.'
  );
});

test('★ ACQUIS — le relevé de référence inclut ce que la production connaît', () => {
  // Les quatre championnats ajoutés le 12 septembre 2026 (Roumanie, Serbie,
  // Irlande, Finlande) sont en production depuis le commit 5819d10. Un moteur de
  // référence qui les ignorerait serait PLUS FAIBLE que le vrai, et toute couche
  // paraîtrait meilleure qu'elle n'est.
  const s = source();
  const iDefaut = s.indexOf('function releveLaVeille');
  const bloc = s.slice(iDefaut, iDefaut + 300);
  assert.match(
    bloc,
    /construireReleve\(jour, false\)/,
    'Le relevé de référence ne doit contenir QUE ce que la production connaît : TIRS_EN_PLUS porte la vague à l’essai, pas celle qui est déjà en ligne.'
  );
  // Et la mécanique d'essai reste disponible pour la vague suivante.
  assert.match(s, /const NOMS_EN_PLUS = new Set\(Object\.values\(TIRS_EN_PLUS\)\)/, 'La mécanique d’essai des nouveaux championnats a disparu.');
  assert.match(
    s,
    /avecLesQuatre \|\| !NOMS_EN_PLUS\.has\(String\(t\.ligue\)\)/,
    'Le relevé doit pouvoir ÉCARTER les championnats à l’essai : c’est ainsi qu’on mesure ce qu’ils apportent avant de les mettre en ligne.'
  );
});
