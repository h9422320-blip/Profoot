/**
 * ★ ACQUIS — LE BLOC « MOTEURS FBREF & STATSBOMB » NE MONTRE QUE DU MESURÉ.
 *
 * ── CE QUE L'ABONNÉ LISAIT ────────────────────────────────────────────────
 *
 * Quand le fournisseur ne donne pas la possession, le serveur retombe sur
 * « 50 » des deux côtés ; sur « 10 » pour le pressing ; et la menace attendue
 * recopie les buts attendus. Ces valeurs partaient telles quelles à l'écran,
 * sous un titre qui les présente comme des mesures de FBref et StatsBomb.
 *
 * Mesuré le 4 septembre 2026 sur les 4 423 analyses portant ce bloc : 2 594
 * affichaient « 50 % / 50 % », soit 58,6 %. Inter Milan contre Real Madrid en
 * faisait partie — juste sous un texte expliquant lequel des deux confisque le
 * ballon. Deux affirmations contradictoires dans le même écran, chez quelqu'un
 * qui a payé pour ça.
 *
 * On ne remplace rien et on n'invente rien : ce qui n'a pas été mesuré ne
 * s'affiche pas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ecran = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));

test('★ ACQUIS — une possession de repli ne s’affiche pas', () => {
  assert.match(
    ecran,
    /const possessionMesuree = !\(nombre\(m\.possession\?\.team1\) === 50 && nombre\(m\.possession\?\.team2\) === 50\)/,
    'La possession de repli (50/50) repart à l’écran comme une mesure.'
  );
  assert.match(ecran, /\{possessionMesuree && \(/, 'La ligne de possession n’est plus conditionnée.');
});

test('★ ACQUIS — un pressing de repli ne s’affiche pas', () => {
  assert.match(
    ecran,
    /const pressingMesure = !\(nombre\(m\.ppda\?\.team1\) === 10 && nombre\(m\.ppda\?\.team2\) === 10\)/,
    'Le pressing de repli (10/10) repart à l’écran comme une mesure.'
  );
  assert.match(ecran, /\{pressingMesure && \(/, 'La ligne de pressing n’est plus conditionnée.');
});

test('★ ACQUIS — la menace attendue ne recopie plus les buts attendus', () => {
  // En repli, xT vaut exactement xG : deux lignes identiques, présentées comme
  // deux mesures différentes.
  assert.match(
    ecran,
    /nombre\(m\.xT\?\.team1\) !== nombre\(m\.xG\?\.team1\)/,
    'La menace attendue s’affiche de nouveau quand elle recopie les buts attendus.'
  );
  assert.match(ecran, /\{menaceMesuree && \(/, 'La ligne de menace n’est plus conditionnée.');
});

test('★ ACQUIS — un bloc entièrement en repli disparaît', () => {
  // Il ne resterait que les buts attendus : un « modèle tactique avancé » à une
  // seule ligne annonce plus qu'il ne tient.
  assert.match(
    ecran,
    /if \(lignes <= 1\) return null;/,
    'Un bloc réduit aux seuls buts attendus s’affiche de nouveau.'
  );
});

test('★ ACQUIS — les buts attendus, eux, restent toujours', () => {
  // Ils viennent du calcul de score, pas d'un repli : c'est la seule des quatre
  // lignes qui est toujours réelle.
  const bloc = ecran.slice(ecran.indexOf('const possessionMesuree'));
  const xg = bloc.indexOf('label="Expected Goals (xG)"');
  assert.ok(xg > 0, 'La ligne des buts attendus a disparu.');
  const avant = bloc.slice(Math.max(0, xg - 120), xg);
  assert.doesNotMatch(avant, /&& \($/, 'Les buts attendus ont été rendus conditionnels.');
});
