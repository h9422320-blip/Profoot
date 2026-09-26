/**
 * ★ ACQUIS — LES FRAIS DE FONCTIONNEMENT SE RETIRENT AVANT LE PARTAGE.
 *
 * Décision du propriétaire, le 25 septembre 2026 : Supabase, Vercel,
 * OpenRouter et Anthropic sont des frais de l'entreprise, pas des frais
 * personnels. Ils sortent du chiffre d'affaires du mois comme la commission de
 * la boutique — et le partenaire, qui participe donc aux frais à hauteur de sa
 * part, doit pouvoir lire chaque ligne.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { enFrancs, cleDeDepense, libelleDepense, TAUX_USD_XOF } from '../src/lib/depenses';

test('★ ACQUIS — la conversion en francs est exacte et sans décimale', () => {
  assert.equal(enFrancs(25, 'USD', 600), 15_000);
  assert.equal(enFrancs(25, 'USD'), 25 * TAUX_USD_XOF);
  assert.equal(enFrancs(10_000, 'XOF'), 10_000, 'Des francs ne se convertissent pas.');
  assert.equal(enFrancs(1, 'EUR'), 656, 'Le franc CFA est arrimé à l’euro : 655,957.');
  // Rien d'absurde ne doit entrer dans les comptes.
  for (const mauvais of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(enFrancs(mauvais as number, 'USD'), 0, `${mauvais} ne doit rien valoir.`);
  }
});

test('★ ACQUIS — la même facture ne peut pas être comptée deux fois', () => {
  const base = { jour: '2026-09-26', fournisseur: 'supabase' as const, montant: 25, devise: 'USD' as const };
  assert.equal(cleDeDepense(base), cleDeDepense({ ...base, jour: '2026-09-29' }), 'Même mois, même montant : même facture.');
  assert.notEqual(cleDeDepense(base), cleDeDepense({ ...base, montant: 30 }));
  assert.notEqual(cleDeDepense(base), cleDeDepense({ ...base, fournisseur: 'vercel' }));
  assert.notEqual(cleDeDepense(base), cleDeDepense({ ...base, jour: '2026-10-26' }));
  // La clé sert d'identifiant unique en base : elle ne doit jamais être vide.
  assert.ok(cleDeDepense(base).startsWith('depense-'));
});

test('★ ACQUIS — la ligne lue par le partenaire nomme le fournisseur et la somme', () => {
  const texte = libelleDepense({ fournisseur: 'supabase', libelle: 'abonnement mensuel', montant: 25, devise: 'USD' });
  assert.match(texte, /Supabase/);
  assert.match(texte, /abonnement mensuel/);
  assert.match(texte, /25 \$/, 'Le montant d’origine doit rester lisible.');
});

test('★ ACQUIS — le net retire la boutique ET les frais de fonctionnement', () => {
  const src = fs.readFileSync('src/lib/partenaires.ts', 'utf8');
  assert.match(
    src,
    /depensesXof: sorties\?\.totalXof \?\? 0,/,
    'Le partage ne retire plus les frais de fonctionnement : le propriétaire les paierait de nouveau seul.'
  );
  // Et la soustraction elle-même, là où elle vit depuis le 26 septembre 2026.
  const partage = fs.readFileSync('src/lib/partage.ts', 'utf8');
  assert.match(
    partage,
    /Math\.max\(0, recettesXof - fraisBoutiqueXof - depensesXof\)/,
    'Le bénéfice ne retire plus les dépenses.'
  );
  assert.match(src, /depensesXof: number;/);
  assert.match(src, /depenses: LigneDepense\[\];/, 'Le détail doit voyager avec le total, sinon le partenaire ne peut pas vérifier.');
});

test('★ ACQUIS — le partenaire voit le détail, pas seulement un total', () => {
  const fiche = fs.readFileSync('src/app/admin/partenaires/[id]/page.tsx', 'utf8');
  assert.match(fiche, /de frais de fonctionnement/);
  assert.match(fiche, /m\.depenses\.map\(\(d\) => \(/, 'Les lignes de dépense ne sont plus affichées une par une.');
  assert.match(fiche, /libelleDepense\(d\)/);
});

/**
 * ── L'ÉPREUVE NÉE D'UNE ERREUR ────────────────────────────────────────────
 *
 * Le 26 septembre 2026, le bloc des dépenses avait été écrit UNIQUEMENT sur la
 * fiche d'un partenaire. Le propriétaire a ouvert « Partenaires », n'a rien vu,
 * et a eu raison : c'est cette page-là qu'on ouvre en premier. Une
 * fonctionnalité invisible là où on la cherche n'existe pas.
 */
test('★ ACQUIS — le bloc des dépenses est sur la page « Partenaires », pas seulement sur une fiche', () => {
  const liste = fs.readFileSync('src/app/admin/partenaires/page.tsx', 'utf8');
  assert.match(liste, /<BlocDepenses \/>/, 'La page qu’on ouvre en premier n’affiche plus les frais de fonctionnement.');
  assert.match(liste, /import BlocDepenses from "\.\/BlocDepenses"/);

  const fiche = fs.readFileSync('src/app/admin/partenaires/[id]/page.tsx', 'utf8');
  assert.match(fiche, /<BlocDepenses \/>/, 'La fiche et la liste doivent montrer le même bloc.');

  // Et le bloc s'affiche MÊME SANS UN SEUL CHIFFRE : « même si les chiffres ne
  // sont pas là pour le moment, il faut qu'il y ait cette partie quand même ».
  const bloc = fs.readFileSync('src/app/admin/partenaires/VueDepenses.tsx', 'utf8');
  assert.match(bloc, /Aucune dépense inscrite pour l’instant/, 'L’état vide a disparu : le bloc redevient invisible quand il n’y a rien.');
  assert.match(bloc, /titre="Frais de fonctionnement"/);
  assert.match(bloc, /fondateur && \(/, 'Le formulaire d’écriture n’est plus réservé au fondateur.');

  // La vue ne décide de rien : c'est la lecture qui tranche qui est le fondateur.
  const lecture = fs.readFileSync('src/app/admin/partenaires/BlocDepenses.tsx', 'utf8');
  assert.match(lecture, /fondateur=\{estFondateur\(user\?\.email\)\}/,'La garde du fondateur a sauté : le partenaire pourrait inscrire des dépenses.');
});
