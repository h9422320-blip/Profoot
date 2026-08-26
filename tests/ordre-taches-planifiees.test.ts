/**
 * ★ ACQUIS — CE QUI COMPTE PASSE EN PREMIER DANS LES TÂCHES PLANIFIÉES.
 *
 * ── LE 26 AOÛT 2026 ───────────────────────────────────────────────────────
 *
 * `precision_quotidienne` s'écrit près de la fin de la tâche de minuit : c'est
 * donc un marqueur fiable de « la tâche est allée au bout ». Sur les douze
 * derniers jours, il n'y avait que CINQ lignes.
 *
 *     Jours sans enregistrement final : 26, 25, 22, 21, 18, 17, 16, 15 août
 *
 * Le 25 août est le cas parlant : la vérification a bien tourné — 1 214
 * écritures à minuit — et l'enregistrement final manque. La tâche démarre,
 * travaille, et se fait couper par la plateforme à `maxDuration`.
 *
 * ── UN SEUL DÉFAUT, TROIS SYMPTÔMES ───────────────────────────────────────
 *
 * On les croyait distincts :
 *
 *   — des journées entières sans aucune vérification de pronostic ;
 *   — 2 106 ventes sans le moindre diagnostic de paiement, ce qui rendait
 *     impossible de répondre à « je n'arrive pas à payer » ;
 *   — les trous du journal quotidien.
 *
 * C'était le même : l'ordre plaçait le passage le plus COÛTEUX en tête, et
 * tout ce qui compte derrière. Ce qui s'exécute en dernier est ce qu'on
 * accepte de perdre.
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 * L'ordre, et rien d'autre. Il n'a l'air de rien dans un diff — déplacer deux
 * lignes « pour la lisibilité » suffirait à tout ramener en arrière, sans
 * qu'aucun test de comportement ne bronche.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

/** Position du premier appel, en ignorant les commentaires et les imports. */
function position(source: string, appel: string): number {
  const sansCommentaires = source
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith('//') || l.trim().startsWith('*') ? '' : l))
    .join('\n');
  const i = sansCommentaires.indexOf(appel);
  assert.ok(i > 0, `L'appel \`${appel}\` a disparu de la tâche.`);
  return i;
}

test('★ ACQUIS — la tâche de minuit fait le précieux avant le coûteux', () => {
  const source = lire('src/app/api/cron/refresh/route.ts');

  // L'ordre attendu, du plus précieux par seconde dépensée au moins urgent.
  const etapes = [
    ['verifierPronostics(', 'la vérification des pronostics — 6,6 s, et tout en dépend'],
    ['construirePreuves(', 'le mur de preuves — ce que le public voit'],
    ['enregistrerPrecisionDuJour(', 'le journal du jour — le marqueur de fin de tâche'],
    ['reconcilierVentes(', "les ventes payées sans accès — quelqu'un a payé et n'a rien reçu"],
    ['rattraperAccesManquants(', 'le rattrapage des accès'],
    ['recalculerForcesChampionnats(', 'la hiérarchie des championnats — peut attendre un jour'],
    ['releverCotes(', 'le relevé des cotes — matière pour dans trois semaines'],
    ['getAllCompetitionStatuses(', 'le rafraîchissement des compétitions — le plus lourd'],
  ] as [string, string][];

  let precedent = -1;
  let nomPrecedent = 'le début';
  for (const [appel, role] of etapes) {
    const p = position(source, appel);
    assert.ok(
      p > precedent,
      `${role} passe désormais AVANT ${nomPrecedent}. ` +
        `Ce qui s'exécute en dernier est ce qu'on accepte de perdre quand la ` +
        `plateforme coupe la fonction : c'est ce qui a fait disparaître huit ` +
        `journées de travail entre le 15 et le 26 août 2026.`
    );
    precedent = p;
    nomPrecedent = role;
  }
});

test("★ ACQUIS — la tâche de minuit s'arrête d'elle-même au lieu d'être tuée", () => {
  const source = lire('src/app/api/cron/refresh/route.ts');

  // Un budget, sous la limite de la plateforme.
  const m = source.match(/const BUDGET_MS = ([\d_]+)/);
  assert.ok(m, 'La tâche de minuit n’a plus de budget de temps.');
  const budget = Number(m![1].replace(/_/g, ''));

  const d = source.match(/export const maxDuration = (\d+)/);
  assert.ok(d, 'La tâche de minuit n’a plus de `maxDuration`.');
  const limite = Number(d![1]) * 1000;

  assert.ok(
    budget < limite,
    `Le budget (${budget} ms) atteint la limite de la plateforme (${limite} ms) : ` +
      `la tâche serait de nouveau tuée sans rien écrire.`
  );

  // Et ce qui est abandonné doit se DIRE. Une tâche coupée ne laisse aucune
  // trace : c'est ce qui a permis à huit journées de disparaître sans alerte.
  assert.match(source, /ignores\.push\(/, 'Les étapes abandonnées ne sont plus retenues.');
  assert.match(source, /ÉTAPES IGNORÉES/, "Les étapes abandonnées ne sont plus journalisées.");
  assert.match(source, /\bignores,/, "Les étapes abandonnées ne sont plus rendues dans la réponse.");
});

test('★ ACQUIS — les étapes les plus lourdes sont soumises au budget', () => {
  const source = lire('src/app/api/cron/refresh/route.ts');
  for (const etape of [
    'hiérarchie des championnats',
    'relevé des cotes',
    'rafraîchissement des compétitions et effectifs',
  ]) {
    assert.ok(
      source.includes(`encoreLeTemps('${etape}'`),
      `« ${etape} » n'est plus soumis au budget de temps.`
    );
  }
});

test("★ ACQUIS — un relevé de paiement qui ne se fait pas le dit", () => {
  // La fonction rend `{ releves: 0, erreur: … }` sans lever d'exception quand
  // la clé de la boutique manque sur le serveur. La valeur de retour était
  // jetée : elle pouvait ne rien faire tous les jours en silence, et c'est
  // très exactement ce qui laissait 2 106 ventes sans aucun diagnostic.
  const source = lire('src/app/api/cron/audit/route.ts');
  const i = source.indexOf('rafraichirStatutsPaiement(40)');
  assert.ok(i > 0, "Le relevé des paiements a disparu de la tâche d'audit.");

  const bloc = source.slice(i - 200, i + 700);
  assert.match(
    bloc,
    /const r = await rafraichirStatutsPaiement\(40\)/,
    'Le résultat du relevé est de nouveau jeté : un échec repasserait inaperçu.'
  );
  assert.match(bloc, /r\.erreur/, "L'erreur rendue par le relevé n'est plus examinée.");
  assert.match(bloc, /console\.error/, "Un relevé non effectué n'est plus signalé.");
});
