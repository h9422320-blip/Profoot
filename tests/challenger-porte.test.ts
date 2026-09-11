/**
 * ★ ACQUIS — LE CHALLENGER DE NUIT NE PROPOSE QUE CE QUI EST PROUVÉ,
 * ET IL NE MET JAMAIS RIEN EN LIGNE TOUT SEUL.
 *
 * ── CE QUE C'EST ──────────────────────────────────────────────────────────
 *
 * Demandé par le propriétaire le 11 septembre 2026 : un moteur qui cherche
 * lui-même à s'améliorer, chaque nuit, sur son ordinateur. Il rejoue des
 * variantes de ses propres réglages sur des matchs qu'il n'a jamais vus, et
 * propose celles qui battent le moteur actuel.
 *
 * ── LES DEUX DANGERS QUE CES ASSERTIONS ÉCARTENT ──────────────────────────
 *
 *   1. PROPOSER DU BRUIT. Sur ce projet, une douzaine d'idées séduisantes
 *      ont été tuées par le contrôle hors échantillon ; la plupart gagnaient
 *      sur une moitié et perdaient sur l'autre. Une porte trop lâche ferait
 *      proposer chaque nuit un « progrès » qui n'en est pas un.
 *   2. AGIR SANS CONTRÔLE. Un processus qui tourne seul à trois heures du
 *      matin ne doit ni modifier le moteur, ni pousser sur GitHub, ni mettre
 *      en ligne : la règle du propriétaire est que rien ne régresse, et seule
 *      la chaîne complète — garanties ★ ACQUIS, compilation, déploiement
 *      vérifié — le garantit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  mesurer,
  moities,
  verdict,
  aProposer,
  MATCHS_MINIMUM_PAR_MOITIE,
  type Mesure,
  type Pronostic,
} from '../scripts/challenger/porte';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** `n` pronostics dont les `justes` premiers ont le bon vainqueur. */
function lot(n: number, justes: number): Pronostic[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    date: `2026-03-${String(1 + (i % 28)).padStart(2, '0')}T15:00:00Z`,
    ligue: 39,
    reel: 0,
    parScore: i < justes ? 0 : 2,
    probas: i < justes ? [0.55, 0.25, 0.2] : [0.2, 0.25, 0.55],
  }));
}
const m = (justes: number, brier: number, n = 200): Mesure => ({ n, justes, brier, surs: 0, sursJustes: 0 });

test('★ ACQUIS — un gain sur une seule moitié ne suffit pas', () => {
  const champion: [Mesure, Mesure] = [mesurer(lot(200, 100)), mesurer(lot(200, 100))];
  const challenger: [Mesure, Mesure] = [mesurer(lot(200, 115)), mesurer(lot(200, 100))];
  const v = verdict(champion, challenger);
  assert.equal(v.gagne, false, 'Une variante qui ne gagne que sur une moitié serait proposée.');
});

test('★ ACQUIS — des vainqueurs gagnés au prix des pourcentages sont refusés', () => {
  const v = verdict([m(100, 0.6), m(100, 0.6)], [m(106, 0.65), m(106, 0.65)]);
  assert.equal(v.gagne, false, 'Un Brier dégradé passe la porte.');
  assert.ok(v.raisons.some((r) => r.includes('Brier')), 'Le refus ne dit pas pourquoi.');
});

test('★ ACQUIS — un échantillon maigre ne prouve rien', () => {
  const petit = MATCHS_MINIMUM_PAR_MOITIE - 1;
  const v = verdict([m(40, 0.6, petit), m(40, 0.6, petit)], [m(50, 0.5, petit), m(50, 0.5, petit)]);
  assert.equal(v.gagne, false, `${petit} matchs par moitié suffisent à proposer un réglage.`);
});

test('★ ACQUIS — les matchs sûrs ne doivent pas reculer', () => {
  const a: Mesure = { n: 200, justes: 100, brier: 0.6, surs: 50, sursJustes: 38 };
  const b: Mesure = { n: 200, justes: 103, brier: 0.59, surs: 50, sursJustes: 33 };
  assert.equal(verdict([a, a], [b, b]).gagne, false, 'Les matchs où le moteur est sûr de lui peuvent se dégrader.');
});

test('★ ACQUIS — mieux dans les deux moitiés, sans rien dégrader : la porte s’ouvre', () => {
  const v = verdict([m(100, 0.6), m(100, 0.6)], [m(104, 0.59), m(103, 0.6)]);
  assert.equal(v.gagne, true, 'Une variante réellement meilleure est refusée.');
});

test('★ ACQUIS — une seule nuit gagnée ne suffit pas pour proposer', () => {
  const h = [
    { nuit: '2026-09-12', variante: 'X', gagne: false },
    { nuit: '2026-09-13', variante: 'X', gagne: false },
    { nuit: '2026-09-14', variante: 'X', gagne: true },
  ];
  assert.equal(aProposer(h, 'X'), false, 'Une nuit heureuse suffit à proposer.');
  h[1].gagne = true;
  assert.equal(aProposer(h, 'X'), true, 'Deux nuits gagnées sur les trois dernières ne suffisent pas.');
});

test('★ ACQUIS — les deux moitiés se découpent toujours pareil', () => {
  const l = lot(300, 150);
  const melange = [...l].reverse();
  assert.deepEqual(
    moities(l).map((x) => x.map((p) => p.id)),
    moities(melange).map((x) => x.map((p) => p.id)),
    'Le découpage dépend de l’ordre d’arrivée : champion et variante pourraient être jugés sur des moitiés différentes.'
  );
});

test('★ ACQUIS — sans réglage demandé, le relevé garde ses valeurs de production', () => {
  const s = fs.readFileSync('src/lib/forme-occasions.ts', 'utf8');
  assert.match(s, /const DEMI_VIE = Number\(process\.env\.BANC_DEMI_VIE\) \|\| 8;/, 'La demi-vie de production a changé.');
  assert.match(s, /const RETRAIT = Number\(process\.env\.BANC_RETRAIT\) \|\| 4;/, 'Le lissage de production a changé.');
  assert.match(
    s,
    /const MINIMUM_RENCONTRES = Number\(process\.env\.BANC_MINIMUM_RENCONTRES\) \|\| 8;/,
    'Le minimum de matchs de production a changé.'
  );
});

test('★ ACQUIS — le challenger propose, il ne met jamais rien en ligne', () => {
  for (const f of ['scripts/challenger/nuit.mts', 'scripts/challenger/evaluer.mts', 'scripts/challenger/donnees.mts']) {
    const s = sansCommentaires(fs.readFileSync(f, 'utf8'));
    assert.doesNotMatch(s, /spawnSync\(\s*['"]git|execSync\(|\bexec\(/, `${f} lance une commande qui pourrait pousser du code.`);
    assert.doesNotMatch(s, /vercel/i, `${f} parle à l’hébergeur.`);
    assert.doesNotMatch(s, /writeFileSync\([^)]*src[\\/]/, `${f} écrit dans le code du moteur.`);
  }
});

test('★ ACQUIS — la nuit est bien lancée par le planificateur', () => {
  const cmd = fs.readFileSync('scripts/challenger/lancer-la-nuit.cmd', 'utf8');
  assert.match(cmd, /scripts\\challenger\\nuit\.mts/, 'Le lanceur de nuit ne lance plus le challenger.');
  assert.match(cmd, /journal\.log/, 'La nuit ne laisse plus de journal.');
  const ignore = fs.readFileSync('.gitignore', 'utf8');
  assert.match(ignore, /^\/\.challenger\/$/m, 'Les données de nuit du propriétaire partiraient sur GitHub.');
});
