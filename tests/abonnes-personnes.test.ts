/**
 * ★ ACQUIS — « ABONNÉS » VEUT DIRE DES PERSONNES.
 *
 * ── CE QUE LE TABLEAU DE BORD ANNONÇAIT ───────────────────────────────────
 *
 * La carte « Abonnés actifs » affichait le nombre d'ABONNEMENTS. Un abonné qui
 * rachète en possède plusieurs : le 1er septembre 2026, 475 abonnements pour
 * 420 personnes. Les 55 de différence sont des rachats.
 *
 * Le mot « abonnés » et le sous-titre « des comptes inscrits » parlent tous
 * deux de personnes. Compter les lignes gonflait donc :
 *
 *   abonnés actifs      420  ->  475   (+13 %)
 *   taux de conversion  6,0 %  ->  6,8 %
 *   recette par abonné  3 502  ->  3 097 FCFA   (sous-estimée)
 *
 * Le propriétaire lit ces trois chiffres pour piloter le projet, et il en
 * parle à son associé — dont la rémunération est un pourcentage du chiffre
 * d'affaires. Un compteur qui se trompe de treize pour cent ne peut pas servir
 * à ça.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const METRIQUES = 'src/lib/admin-metrics.ts';

test('★ ACQUIS — le nombre d’abonnés compte des personnes distinctes', () => {
  const s = sansCommentaires(lire(METRIQUES));
  assert.match(
    s,
    /const abonnesActifs = new Set\(abosActifs\.map\(\(s\) => s\.userId\)\)\.size;/,
    'Le nombre d’abonnés recompte des lignes d’abonnement.'
  );
  // Les deux restent exposés : un rachat est une bonne nouvelle, il faut
  // pouvoir la lire.
  assert.match(s, /actifs: abosActifs\.length,/, 'Le nombre d’abonnements a disparu.');
  assert.match(s, /personnes: abonnesActifs,/, 'Le nombre de personnes n’est plus exposé.');
});

test('★ ACQUIS — la conversion et la recette par abonné suivent les personnes', () => {
  // Rapporter des abonnements à des comptes inscrits n'a aucun sens : les deux
  // termes ne comptent pas la même chose.
  const s = sansCommentaires(lire(METRIQUES));
  assert.match(s, /tauxConversion: pourcent\(abonnesActifs, comptes\.length\)/, 'La conversion ne suit plus les personnes.');
  assert.match(s, /revenuParAbonne: abonnesActifs \?/, 'La recette par abonné ne suit plus les personnes.');
});

test('★ ACQUIS — partout où l’on écrit « abonnés », on affiche des personnes', () => {
  for (const [page, extraits] of [
    ['src/app/admin/page.tsx', ['valeur={m.abonnements.personnes}', '${m.abonnements.personnes} abonnés sur']],
    ['src/app/admin/users/page.tsx', ['${m.abonnements.personnes} abonné$']],
  ] as [string, string[]][]) {
    const s = sansCommentaires(lire(page));
    for (const bout of extraits) {
      assert.ok(s.includes(bout), `${page} : « ${bout} » a disparu — le mot « abonnés » recompte des abonnements.`);
    }
  }

  // La page des finances, elle, parle bien d'ABONNEMENTS : elle garde son
  // compte de lignes, et c'est juste.
  const f = sansCommentaires(lire('src/app/admin/finances/page.tsx'));
  assert.match(f, /libelle="Abonnements actifs" valeur=\{m\.abonnements\.actifs\}/, 'La page des finances ne compte plus les abonnements.');
});
