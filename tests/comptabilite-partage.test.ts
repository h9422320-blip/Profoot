/**
 * ★ ACQUIS — LA COMPTABILITÉ DU PARTAGE, AU FRANC PRÈS.
 *
 * Cahier des charges du propriétaire, le 26 septembre 2026 :
 *
 *     bénéfice = chiffre d'affaires − commission boutique − dépenses
 *     part du partenaire = bénéfice × son pourcentage
 *
 * Son exemple, qui sert d'épreuve : 2 000 000 de recettes, 200 000 de
 * dépenses → 1 800 000 de bénéfice. « Aucun calcul faux n'est acceptable. »
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { partagerLeMois, dernierJourDuMois, moisClos } from '../src/lib/partage';

test('★ ACQUIS — l’exemple du propriétaire : 2 000 000 − 200 000 = 1 800 000', () => {
  const r = partagerLeMois({ recettesXof: 2_000_000, depensesXof: 200_000, partPct: 35 });
  assert.equal(r.beneficeXof, 1_800_000, 'Le bénéfice annoncé n’est pas celui du cahier des charges.');
  assert.equal(r.duPartenaireXof, 630_000, '35 % de 1 800 000 font 630 000.');
  assert.equal(r.restantFondateurXof, 1_170_000);
  // Les deux parts doivent TOUJOURS totaliser le bénéfice, au franc près.
  assert.equal(r.duPartenaireXof + r.restantFondateurXof, r.beneficeXof);
});

test('★ ACQUIS — la commission de la boutique se retire aussi, et dans cet ordre', () => {
  const r = partagerLeMois({
    recettesXof: 2_000_000,
    fraisBoutiqueXof: 100_000,
    depensesXof: 200_000,
    partPct: 35,
  });
  assert.equal(r.beneficeXof, 1_700_000);
  assert.equal(r.duPartenaireXof, 595_000);
});

test('★ ACQUIS — aucun arrondi ne fait disparaître un franc', () => {
  // Un bénéfice impair et un pourcentage qui tombe mal : la somme des deux
  // parts doit rester égale au bénéfice, sinon un franc se perd chaque mois.
  for (const benefice of [1, 3, 7, 999, 1_234_567, 2_000_001]) {
    for (const pct of [1, 7.5, 33.33, 35, 50, 66.67, 99]) {
      const r = partagerLeMois({ recettesXof: benefice, partPct: pct });
      assert.equal(
        r.duPartenaireXof + r.restantFondateurXof,
        r.beneficeXof,
        `${benefice} francs à ${pct} % : les deux parts ne totalisent plus le bénéfice.`
      );
      assert.ok(r.duPartenaireXof >= 0 && r.restantFondateurXof >= 0);
    }
  }
});

test('★ ACQUIS — un mois qui coûte plus qu’il ne rapporte ne crée pas de dette', () => {
  const r = partagerLeMois({ recettesXof: 100_000, depensesXof: 250_000, partPct: 35 });
  assert.equal(r.beneficeXof, 0, 'Le bénéfice ne peut pas être négatif.');
  assert.equal(r.duPartenaireXof, 0, 'On ne réclame rien au partenaire.');
});

test('★ ACQUIS — les entrées absurdes ne polluent pas les comptes', () => {
  const r = partagerLeMois({
    recettesXof: Number.NaN as unknown as number,
    depensesXof: -500 as unknown as number,
    partPct: 250,
  });
  assert.equal(r.recettesXof, 0);
  assert.equal(r.depensesXof, 0);
  assert.equal(r.partPct, 100, 'Un pourcentage au-delà de 100 est une faute de saisie, pas une consigne.');
});

test('★ ACQUIS — le partage se fait le dernier jour du mois, février compris', () => {
  assert.equal(dernierJourDuMois('2026-09'), '2026-09-30');
  assert.equal(dernierJourDuMois('2026-10'), '2026-10-31');
  assert.equal(dernierJourDuMois('2027-02'), '2027-02-28');
  assert.equal(dernierJourDuMois('2028-02'), '2028-02-29', 'Année bissextile.');
  // Un mois en cours n'est pas payable : son montant peut encore monter.
  assert.equal(moisClos('2026-09', new Date('2026-09-26T12:00:00Z')), false);
  assert.equal(moisClos('2026-08', new Date('2026-09-26T12:00:00Z')), true);
});

test('★ ACQUIS — le partenaire LIT, le fondateur seul ÉCRIT', () => {
  const actions = fs.readFileSync('src/app/admin/partenaires/actions.ts', 'utf8');
  // Les trois écritures passent par la garde du fondateur, et non par la
  // simple garde admin — le partenaire EST administrateur.
  for (const action of ['ajouterDepense', 'supprimerDepense', 'reglerTauxDollar']) {
    const bloc = actions.slice(actions.indexOf(`export async function ${action}`));
    const debut = bloc.slice(0, 220);
    assert.match(
      debut,
      /if \(!\(await verifierFondateur\(\)\)\) return;/,
      `${action} peut être appelée par le partenaire : il pourrait modifier sa propre part.`
    );
  }
  assert.match(actions, /async function verifierFondateur\(\)/);
  assert.match(actions, /return estFondateur\(user\?\.email\);/);

  // Et la page ne montre les formulaires qu'au fondateur.
  const page = fs.readFileSync('src/app/admin/partenaires/[id]/page.tsx', 'utf8');
  assert.match(page, /const fondateur = estFondateur\(user\?\.email\);/);
  assert.match(page, /\{fondateur && \(\s*<form\s+action=\{ajouterDepense\}/);
  assert.match(page, /Lecture seule/, 'Le partenaire doit savoir pourquoi il ne peut rien modifier.');
});

test('★ ACQUIS — le taux est modifiable, et le passé ne se réécrit pas', () => {
  const src = fs.readFileSync('src/lib/depenses.ts', 'utf8');
  assert.match(src, /export async function definirTauxUsdXof/);
  assert.match(src, /t < 100 \|\| t > 2000/, 'Un taux absurde doit être refusé.');
  // Chaque dépense garde le taux qui lui a été appliqué.
  assert.match(src, /taux: number;/);
  assert.match(src, /const montantXof = enFrancs\(d\.montant, d\.devise, taux\);/);
});
