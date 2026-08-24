import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ★ ACQUIS — CE QUI DOIT TOURNER SEUL TOURNE BIEN CÔTÉ SERVEUR.
 *
 * ── LA QUESTION QUI A RÉVÉLÉ CES TROUS ────────────────────────────────────
 *
 * Le 24 août 2026, le propriétaire a demandé une chose simple : « le relevé
 * des cotes, le mur de preuves et la relance e-mail tournent-ils tout seuls,
 * application fermée ? »
 *
 * Deux réponses sur trois étaient non.
 *
 *   — Le relevé des cotes tournait bien sur le serveur, mais parcourait
 *     toujours la liste des championnats dans le même ordre. Le budget de
 *     quatre-vingt-dix secondes coupant au milieu — 36 championnats sur 63 —
 *     les vingt-sept derniers n'étaient pas « relevés plus tard » : ils ne
 *     l'étaient JAMAIS.
 *
 *   — L'e-mail prévenant un client dont l'accès a été rouvert partait d'un
 *     seul endroit : la page publique du mur de preuves. Il ne partait donc
 *     que si un visiteur ouvrait cette page. Quelqu'un pouvait payer, voir son
 *     accès rouvert par la tâche de minuit, et ne jamais l'apprendre.
 *
 * Une tâche qui dépend d'une visite n'est pas une tâche automatique.
 */

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

const REFRESH = 'src/app/api/cron/refresh/route.ts';
const AUDIT = 'src/app/api/cron/audit/route.ts';

test('★ ACQUIS — les deux taches sont declarees chez l hebergeur', () => {
  const config = JSON.parse(lire('vercel.json'));
  const chemins = (config.crons ?? []).map((c: any) => c.path);

  for (const attendu of ['/api/cron/refresh', '/api/cron/audit']) {
    assert.ok(
      chemins.includes(attendu),
      `${attendu} n'est plus planifiée. Sans déclaration chez l'hébergeur, la ` +
        'route existe mais personne ne l’appelle : tout ce qu’elle fait cesse ' +
        'silencieusement.'
    );
  }
});

test('★ ACQUIS — le releve des cotes tourne sur le serveur', () => {
  assert.ok(
    lire(REFRESH).includes('await releverCotes()'),
    'Le relevé des cotes a quitté la tâche quotidienne. Le fournisseur ne garde ' +
      'pas les cotes passées : chaque jour non relevé est perdu pour toujours.'
  );
});

test('★ ACQUIS — le releve ne repart pas toujours des memes championnats', () => {
  const src = lire('src/lib/cotes-marche.ts');

  assert.ok(
    src.includes('const depart =') && src.includes('jourAbsolu'),
    'La rotation a disparu. Le budget coupe le relevé au milieu : sans point de ' +
      'départ qui avance chaque jour, la fin de la liste n’est jamais atteinte — ' +
      'pas « plus tard », jamais.'
  );

  assert.ok(
    src.includes('...toutes.slice(depart), ...toutes.slice(0, depart)'),
    'La liste doit être pivotée, pas seulement décalée : les championnats sautés ' +
      'aujourd’hui doivent passer en tête un autre jour.'
  );
});

test('★ ACQUIS — le mur de preuves se reconstruit sur le serveur, deux fois par jour', () => {
  for (const fichier of [REFRESH, AUDIT]) {
    const src = lire(fichier);
    assert.ok(
      src.includes('await construirePreuves()'),
      `${fichier} ne reconstruit plus le mur de preuves. Les deux tâches le font ` +
        'à des heures différentes : si l’une échoue, l’autre rattrape dans la journée.'
    );
    assert.ok(
      src.includes('await enregistrerPrecisionDuJour()'),
      `${fichier} n'enregistre plus la précision du jour.`
    );
    assert.ok(
      src.includes('verifierPronostics('),
      `${fichier} ne confronte plus les pronostics aux résultats. Sans ce passage, ` +
        'aucun taux ne peut être mesuré et il faudrait en inventer un.'
    );
  }
});

test('★ ACQUIS — le client prevenu par courriel ne depend plus d une visite', () => {
  const src = lire(REFRESH);

  assert.ok(
    src.includes('rattraperAccesManquants'),
    'Le rattrapage des accès a quitté la tâche serveur. Il ne vivait auparavant ' +
      'que dans `entretien-quotidien.ts`, appelé par la page publique du mur de ' +
      'preuves : l’e-mail ne partait que si un visiteur ouvrait cette page. ' +
      'Personne ne l’ouvre un mardi matin.'
  );

  assert.ok(
    src.includes('reconcilierVentes'),
    'La réconciliation des ventes a quitté la tâche serveur. Elle rouvre l’accès ; ' +
      'le rattrapage, lui, prévient le client. Les deux sont nécessaires.'
  );
});

test('★ ACQUIS — chaque etape est isolee : une panne n en emporte pas une autre', () => {
  const src = lire(REFRESH);

  // Chacune de ces étapes appelle le fournisseur ou la boutique, donc chacune
  // peut tomber. Une seule chute ne doit pas priver les autres de leur passage.
  // On cherche l'APPEL, pas l'import : `releverCotes` figure aussi en haut du
  // fichier, où aucun try/catch ne l'entoure et ne doit en entourer.
  for (const etape of ['releverCotes', 'construirePreuves', 'reconcilierVentes', 'rattraperAccesManquants']) {
    const position = src.indexOf(`${etape}(`, src.indexOf('const debut = Date.now()'));
    assert.ok(position > 0, `${etape} n'est pas appelée dans la tâche quotidienne.`);

    const avant = src.slice(Math.max(0, position - 1200), position);
    assert.ok(
      avant.lastIndexOf('try {') > avant.lastIndexOf('} catch'),
      `${etape} n'est plus protégée par son propre try/catch. Une panne du ` +
        'fournisseur emporterait alors tout ce qui suit dans la tâche.'
    );
  }
});
