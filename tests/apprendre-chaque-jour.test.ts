/**
 * ★ ACQUIS — LE MOTEUR APPREND DE SES PRONOSTICS TOUS LES JOURS.
 *
 * ── SEPT JOURS À DIRE LA MÊME PHRASE ──────────────────────────────────────
 *
 * Relevé le 10 septembre 2026 dans la trace de l'entretien quotidien, du 4 au
 * 10 septembre, sans une exception :
 *
 *     Juger les rencontres terminées : 0 nouvelle(s) sur 414 examinée(s)
 *     Juger les rencontres terminées : 0 nouvelle(s) sur 800 examinée(s)
 *     Juger les rencontres terminées : 0 nouvelle(s) sur 104 examinée(s)
 *
 * Le dernier match appris datait du 2 septembre. 757 rencontres
 * pronostiquées n'avaient jamais été confrontées à leur résultat — dont la
 * soirée de Ligue des champions du 9 septembre, cinq pronostics justes sur
 * six, précisément le résultat que le propriétaire veut voir se répéter.
 *
 * La même fonction, lancée à la main depuis un poste, en a jugé 382 sur 568.
 * Le quota du fournisseur n'y était pour rien : 1 902 appels sur 150 000.
 *
 * ── TROIS DÉFAUTS QUI RENDAIENT TOUS LES TROIS « ZÉRO » ───────────────────
 *
 *   LA FILE SE BOUCHE   Prise du plus ancien au plus récent et plafonnée à
 *                       800, elle se remplissait de rencontres qui ne seront
 *                       JAMAIS terminées — reportées, retirées du
 *                       fournisseur. Elles revenaient à chaque passage et ne
 *                       laissaient jamais la place à ce qui venait de se
 *                       jouer.
 *
 *   UN FETCH NU         L'appel au fournisseur était un `fetch` brut : ni
 *                       délai d'attente, ni réserve, ni lecture du corps
 *                       d'erreur que le fournisseur renvoie parfois avec un
 *                       code 200. Ses trois modes d'échec rendaient exactement
 *                       la même chose qu'une journée sans match.
 *
 *   AUCUN BUDGET        L'hébergeur coupe à soixante secondes, et les
 *                       jugements ne sont écrits qu'à la toute fin. Coupé en
 *                       chemin, le passage perdait TOUT ce qu'il avait
 *                       rassemblé.
 *
 * ── ET POURQUOI PERSONNE NE L'A VU ────────────────────────────────────────
 *
 * Parce que « 0 jugée » n'est pas une erreur. C'est la phrase d'une journée
 * sans match, d'un fournisseur muet et d'une clé refusée à la fois. La trace
 * dit désormais laquelle des trois.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const calibrage = sansCommentaires(lire('src/lib/calibrage.ts'));
const tache = sansCommentaires(lire('src/app/api/cron/apprendre/route.ts'));
const entretien = sansCommentaires(lire('src/lib/entretien-quotidien.ts'));
const figee = sansCommentaires(lire('src/lib/prediction-figee.ts'));

// ── LA FILE ────────────────────────────────────────────────────────────────

test('★ ACQUIS — la file de jugement se prend par les DEUX bouts', () => {
  // Sans cela, quelques centaines de rencontres jamais terminées suffisent à
  // empêcher le moteur d'apprendre quoi que ce soit, indéfiniment, sans
  // qu'aucune erreur ne soit levée.
  assert.match(
    calibrage,
    /const anciens = eligibles\.slice\(0, Math\.ceil\(plafond \/ 2\)\)/,
    'La moitié du budget réservée à l’arriéré a disparu.'
  );
  assert.match(
    calibrage,
    /const recents = \[\.\.\.eligibles\]\s*\.reverse\(\)/,
    'La moitié réservée à ce qui vient de se jouer a disparu : une tête de file bouchée ' +
      'suffira de nouveau à arrêter l’apprentissage en silence.'
  );
  // Les récents passent en PREMIER : sous un budget de temps, ce sont eux qui
  // doivent être jugés, pas l'arriéré.
  assert.match(
    calibrage,
    /const aExaminer = \[\.\.\.recents, \.\.\.anciens\]/,
    'L’arriéré est repassé devant les matchs du jour.'
  );
});

test('★ ACQUIS — la date du match décide, quand elle est connue', () => {
  // Deux heures et demie après le coup d'envoi, un match est fini. C'est à la
  // fois plus tôt que l'ancien délai de grâce pour ce qui est joué, et plus
  // tard pour ce qui ne l'est pas : le quota cesse de partir dans des
  // rencontres à venir.
  assert.match(
    calibrage,
    /const DUREE_DUNE_RENCONTRE_MS = 2\.5 \* 60 \* 60 \* 1000/,
    'La durée d’une rencontre a disparu du filtre.'
  );
  assert.match(
    calibrage,
    /if \(Number\.isFinite\(coupDEnvoi\)\) return coupDEnvoi <= finieDepuis/,
    'La date du match ne décide plus : l’apprentissage repart avec deux jours de retard.'
  );
  // L'ancienne règle reste le filet pour les lignes sans date.
  assert.match(
    calibrage,
    /const DELAI_DE_GRACE_MS = 48 \* 60 \* 60 \* 1000/,
    'Le délai de grâce a été supprimé au lieu d’être complété.'
  );
});

// ── L'APPEL AU FOURNISSEUR ─────────────────────────────────────────────────

test('★ ACQUIS — le jugement passe par le chemin éprouvé, pas par un fetch nu', () => {
  assert.match(
    calibrage,
    /await apiFootball<any>\(\s*`\/fixtures\?ids=/,
    'Le jugement est revenu à un appel brut : ses échecs redeviendront indiscernables ' +
      'd’une journée sans match.'
  );
  assert.doesNotMatch(
    calibrage,
    /fetch\(\s*`https:\/\/v3\.football\.api-sports\.io/,
    'Un fetch brut vers le fournisseur est réapparu dans le calibrage.'
  );
});

test('★ ACQUIS — « zéro jugée » doit dire POURQUOI', () => {
  // C'est ce seul manque qui a permis au défaut de durer sept jours.
  for (const compteur of ['lotsSansReponse', 'fichesRecues', 'absentes', 'pasTerminees']) {
    assert.match(calibrage, new RegExp(`let ${compteur} = 0`), `Le compteur ${compteur} a sauté.`);
  }
  assert.match(calibrage, /pourquoi: string/, 'Le diagnostic a quitté la valeur de retour.');
  assert.match(
    entretien,
    /\$\{r\.pourquoi\}/,
    'L’entretien quotidien ne reporte plus le diagnostic dans sa trace.'
  );
});

// ── LE BUDGET DE TEMPS ─────────────────────────────────────────────────────

test('★ ACQUIS — le jugement s’arrête AVANT la coupure de l’hébergeur', () => {
  // Les jugements ne sont écrits qu'à la fin. Une coupure en plein milieu ne
  // perd pas un lot : elle perd tout le passage.
  assert.match(
    calibrage,
    /const tempsEcoule = \(\) => budgetMs > 0 && Date\.now\(\) - debut > budgetMs/,
    'Le garde-temps du jugement a disparu.'
  );
  assert.match(
    calibrage,
    /if \(tempsEcoule\(\)\) \{\s*arreteParLeTemps = true;\s*break;/,
    'La boucle ne s’arrête plus sur son budget.'
  );
  // Zéro veut dire « pas de limite » : les scripts lancés à la main gardent
  // leur comportement.
  assert.match(calibrage, /budgetMs = 0/, 'Le budget n’est plus facultatif.');
  assert.match(
    entretien,
    /jugerRencontresTerminees\(40, 25_000\)/,
    'L’entretien quotidien a perdu son budget : une coupure lui fera de nouveau perdre ' +
      'le jugement ET les douze étapes suivantes.'
  );
});

// ── LA TÂCHE DÉDIÉE ────────────────────────────────────────────────────────

test('★ ACQUIS — l’apprentissage a sa propre tâche, et elle est gardée', () => {
  // Il vivait en DERNIÈRE position d'un audit qui demandait 106 à 218 secondes
  // pour une coupure à soixante. Il n'était jamais atteint.
  assert.match(tache, /autoriserCron\(request, 'apprendre'\)/, 'La tâche n’est plus gardée.');
  assert.match(tache, /export const maxDuration = 60/, 'Le budget déclaré a changé.');
  assert.match(tache, /export const dynamic = 'force-dynamic'/, 'La tâche peut être mise en cache.');
  assert.match(
    tache,
    /jugerRencontresTerminees\(40, BUDGET_JUGEMENT_MS\)/,
    'La tâche ne borne plus son jugement.'
  );

  // L'agrégation n'a de sens qu'entière : un calibrage calculé sur la moitié
  // de la matière est pire que pas de calibrage.
  assert.match(
    tache,
    /if \(restant\(\) > RESERVE_CALIBRAGE_MS\)/,
    'Le calibrage peut de nouveau être coupé au milieu.'
  );

  const planification = JSON.parse(lire('vercel.json'));
  const passages = (planification.crons ?? []).filter(
    (c: any) => c.path === '/api/cron/apprendre'
  );
  assert.ok(passages.length >= 2, 'L’apprentissage n’est plus planifié qu’une fois par jour, ou pas du tout.');
});

test('★ ACQUIS — l’audit garde son propre bloc d’apprentissage', () => {
  // Deux filets valent mieux qu'un. La tâche dédiée ne remplace pas le bloc
  // de l'audit, elle le double.
  const audit = sansCommentaires(lire('src/app/api/cron/audit/route.ts'));
  assert.match(
    audit,
    /jugerRencontresTerminees, recalculerCalibrages/,
    'Le bloc d’apprentissage a été retiré de l’audit.'
  );
  assert.match(
    entretien,
    /'Juger les rencontres terminées'/,
    'L’étape de jugement a quitté l’entretien quotidien, le seul que les visites garantissent.'
  );
});

// ── CE QUI REND TOUT CELA POSSIBLE ─────────────────────────────────────────

test('★ ACQUIS — un pronostic figé retient la date de son match', () => {
  // Un pronostic sur 1 455 la portait, le 10 septembre 2026. Sans elle,
  // impossible de savoir qu'un match est jouable : la boucle se rabattait sur
  // l'âge du pronostic, deux jours de retard.
  assert.match(figee, /dateMatch\?: string \| null/, 'La date du match a quitté le pronostic figé.');
  assert.match(figee, /competition\?: string \| null/, 'La compétition a quitté le pronostic figé.');
  assert.match(
    figee,
    /\.\.\.\(p\.dateMatch \? \{ date_match: p\.dateMatch \} : \{\}\)/,
    'La date n’est plus enregistrée.'
  );

  // ── LE PRONOSTIC PASSE AVANT SES RENSEIGNEMENTS ─────────────────────────
  //
  // Si la base refuse une colonne, elle refuse toute la ligne — et l'analyse
  // en cours perd son pronostic figé, donc deux abonnés du même match lisent
  // deux choses différentes. C'est le principe même de ce fichier.
  assert.match(
    figee,
    /Object\.keys\(renseignements\)\.length > 0 && \/date_match\|competition\/\.test\(error\.message\)/,
    'Le repli sans les deux colonnes a disparu : une colonne absente fera perdre le pronostic.'
  );
  assert.match(
    figee,
    /from\('predictions_match'\)\.insert\(socle\)/,
    'Le second essai n’insère plus le pronostic seul.'
  );

  // Les deux endroits qui figent doivent renseigner la date.
  for (const chemin of ['src/lib/precalcul-selection.ts', 'src/app/api/analyze/route.ts']) {
    assert.match(
      sansCommentaires(lire(chemin)),
      /dateMatch:/,
      `${chemin} fige des pronostics sans la date de leur match.`
    );
  }
});
