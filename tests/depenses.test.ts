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
import {
  enFrancs,
  cleDeDepense,
  libelleDepense,
  TAUX_USD_XOF,
  tableauDuMois,
  sommeParDevise,
  FOURNISSEURS,
  type LigneDepense,
} from '../src/lib/depenses';
import { calculerEconomie } from '../src/lib/partenaires';

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
  // Le mois en cours est toujours présent, et ses outils aussi, à zéro.
  const vue = fs.readFileSync('src/app/admin/partenaires/VueDepenses.tsx', 'utf8');
  assert.match(vue, /titre="Frais de fonctionnement"/);
  const lecture = fs.readFileSync('src/app/admin/partenaires/BlocDepenses.tsx', 'utf8');
  assert.match(lecture, /new Set\(\[moisCourant, /, 'Le mois en cours ne s’affiche plus quand il est vide.');
});

/**
 * ── LE TABLEAU, TEL QUE LE PROPRIÉTAIRE L'A DEMANDÉ ───────────────────────
 *
 * « Tu commences par Claude, ensuite OpenRouter, Supabase, Vercel » — un outil
 * par ligne, du haut vers le bas, avec en face ce qui a été payé.
 */
const ligne = (p: Partial<LigneDepense>): LigneDepense =>
  ({
    jour: '2026-09-26',
    fournisseur: 'supabase',
    libelle: 'abonnement mensuel',
    montant: 25,
    devise: 'USD',
    taux: 600,
    montantXof: 15_000,
    recurrente: true,
    source: 'épreuve',
    reference: null,
    cle: `cle-${Math.round((p.montant ?? 25) * 100)}-${p.fournisseur ?? 'supabase'}-${p.jour ?? '2026-09-26'}`,
    inscriteLe: '2026-09-26T10:00:00Z',
    ...p,
  }) as LigneDepense;

test('★ ACQUIS — l’ordre demandé : Claude, OpenRouter, Supabase, Vercel, puis API-Football', () => {
  const t = tableauDuMois('2026-09', []);
  assert.deepEqual(
    t.rangees.map((r) => r.nom),
    ['Claude', 'OpenRouter', 'Supabase', 'Vercel', 'API-Football'],
    'L’ordre des outils n’est plus celui que le propriétaire a demandé.'
  );
  // Un mois vide affiche quand même chaque outil, à zéro.
  for (const r of t.rangees) {
    assert.equal(r.paye, '—');
    assert.equal(r.montantXof, 0);
  }
  assert.equal(t.totalXof, 0);
});

test('★ ACQUIS — chaque paiement tombe en face de son outil, et le total est exact au franc', () => {
  const lignes = [
    ligne({ fournisseur: 'supabase', montant: 25, montantXof: 15_000 }),
    ligne({ fournisseur: 'anthropic', libelle: 'abonnement Claude Code', montant: 20, montantXof: 12_000 }),
    ligne({ fournisseur: 'openrouter', libelle: 'crédits', montant: 10, montantXof: 6_000, jour: '2026-09-27' }),
    ligne({ fournisseur: 'openrouter', libelle: 'crédits', montant: 15.5, montantXof: 9_300, jour: '2026-09-29' }),
    // Un autre mois : ne doit rien changer à septembre.
    ligne({ fournisseur: 'vercel', montant: 20, montantXof: 12_000, jour: '2026-10-01' }),
  ];
  const t = tableauDuMois('2026-09', lignes);
  const par = Object.fromEntries(t.rangees.map((r) => [r.nom, r]));

  assert.equal(par.Claude.montantXof, 12_000);
  assert.equal(par.Claude.paye, '20 $');
  assert.equal(par.OpenRouter.montantXof, 15_300, '6 000 + 9 300.');
  assert.equal(par.OpenRouter.paye, '25,5 $');
  assert.equal(par.OpenRouter.paiements[0].jour, '2026-09-29', 'Le paiement le plus récent d’abord.');
  assert.equal(par.Supabase.montantXof, 15_000);
  assert.equal(par.Vercel.montantXof, 0, 'Un paiement d’octobre a été imputé à septembre.');

  assert.equal(t.totalXof, 42_300, '12 000 + 15 300 + 15 000.');
  assert.equal(t.totalXof, t.rangees.reduce((s, r) => s + r.montantXof, 0), 'Les lignes ne totalisent plus le total.');
  assert.equal(t.paye, '70,5 $');
});

test('★ ACQUIS — aucune dépense ne se perd : le total du tableau est celui que le partage retire', () => {
  // Une ligne d'un fournisseur que la liste ne connaît pas — une ancienne
  // écriture, une faute de frappe — doit rester comptée ET visible.
  const lignes = [
    ligne({ fournisseur: 'supabase', montantXof: 15_000 }),
    ligne({ fournisseur: 'inconnu' as any, libelle: 'nom de domaine', montant: 12, montantXof: 7_200 }),
    ligne({ fournisseur: 'meta', libelle: 'publicité', montant: 10_000, devise: 'XOF', montantXof: 10_000 }),
  ];
  const t = tableauDuMois('2026-09', lignes);
  assert.equal(t.totalXof, 32_200);
  assert.equal(t.rangees.reduce((s, r) => s + r.montantXof, 0), 32_200, 'Une dépense retirée du partage n’apparaît pas dans le tableau.');
  // Les outils optionnels n'apparaissent que payés, après les cinq de tous les mois.
  assert.deepEqual(
    t.rangees.map((r) => r.nom),
    ['Claude', 'OpenRouter', 'Supabase', 'Vercel', 'API-Football', 'Meta', 'Autre dépense']
  );
  assert.equal(t.paye.replace(/\s/g, ' '), '37 $ + 10 000 FCFA', 'Ce qui a été payé doit rester lisible dans sa devise d’origine.');
});

test('★ ACQUIS — la commission MakeTou ne peut pas être retirée deux fois', () => {
  assert.equal(
    Object.prototype.hasOwnProperty.call(FOURNISSEURS, 'maketou'),
    false,
    'MakeTou est déjà retiré comme frais de boutique : l’inscrire ici le retirerait deux fois.'
  );
  const src = fs.readFileSync('src/lib/depenses.ts', 'utf8');
  assert.match(src, /if \(!Object\.prototype\.hasOwnProperty\.call\(FOURNISSEURS, d\.fournisseur\)\) return 'refusee';/);
  assert.match(src, /if \(String\(d\.jour\) < DEBUT_DU_SUIVI\) return 'refusee';/, 'Une dépense antérieure au suivi modifierait un partage déjà annoncé.');
});

test('★ ACQUIS — les sommes par devise ne montrent jamais d’erreur d’arrondi', () => {
  assert.equal(sommeParDevise([{ montant: 0.1, devise: 'USD' }, { montant: 0.2, devise: 'USD' }]), '0,3 $');
  assert.equal(sommeParDevise([]), '—');
  assert.equal(sommeParDevise([{ montant: -5, devise: 'USD' }, { montant: Number.NaN, devise: 'USD' }]), '—');
  // Le séparateur des milliers en français est une espace fine insécable.
  assert.equal(
    sommeParDevise([{ montant: 15, devise: 'EUR' }, { montant: 1500.4, devise: 'XOF' }]).replace(/\s/g, ' '),
    '15 € + 1 500 FCFA'
  );
});

/**
 * ── CE QUE LA REVUE DU 26 SEPTEMBRE 2026 A TROUVÉ ─────────────────────────
 *
 * Quatre relecteurs indépendants, chaque constat contre-vérifié. Chacun de ces
 * tests garde un défaut qui aurait faussé les comptes ou menti au propriétaire.
 */
test('★ ACQUIS — un second paiement réel du même montant peut s’inscrire', () => {
  const base = { jour: '2026-09-27', fournisseur: 'openrouter' as const, montant: 10, devise: 'USD' as const };
  // Sans référence : la clé d'avant, inchangée (les lignes en base gardent la leur).
  assert.equal(cleDeDepense(base), 'depense-openrouter-2026-09-USD-1000');
  // Deux recharges distinctes, deux clés.
  assert.notEqual(
    cleDeDepense({ ...base, reference: '2026-09-27' }),
    cleDeDepense({ ...base, jour: '2026-09-29', reference: '2026-09-29' }),
    'Deux paiements réels de 10 $ dans le même mois : le second serait refusé comme doublon.'
  );
  // La même facture relue deux fois garde la même clé.
  assert.equal(cleDeDepense({ ...base, reference: 'INV-4411' }), cleDeDepense({ ...base, reference: ' inv-4411 ' }));

  // Et un doublon n'est JAMAIS annoncé comme un succès.
  const script = fs.readFileSync('scripts/depense.mts', 'utf8');
  assert.match(script, /if \(resultat === 'deja-connue'\) \{\s*arreter\(/, 'Un doublon refusé serait annoncé « inscrit ».');
});

test('★ ACQUIS — le script ne laisse passer aucune faute de frappe, et ne plante pas sous Windows', () => {
  const script = fs.readFileSync('scripts/depense.mts', 'utf8');
  assert.match(script, /Option inconnue/, '« --essais » inscrirait pour de vrai.');
  // process.exit pendant la fermeture de la connexion fait planter Node sous Windows.
  assert.doesNotMatch(script.replace(/\/\*[\s\S]*?\*\//g, ''), /process\.exit\(/);
  assert.match(script, /process\.exitCode = 1;/);
});

test('★ ACQUIS — chaque paiement montre son montant d’origine et SON taux', () => {
  const vue = fs.readFileSync('src/app/admin/partenaires/VueDepenses.tsx', 'utf8');
  assert.match(vue, /\{jourCourt\(p\.jour\)\} · \{p\.libelle\} · \{conversion\(p\)\}/);
  assert.match(vue, /\$\{Number\(p\.taux\)\.toLocaleString\("fr-FR"\)\}/, 'Le taux du jour du paiement n’est plus affiché.');
  assert.match(vue, /FCFA pour les prochains paiements/, 'Le taux actuel se lirait comme celui des mois passés.');
  // La colonne du nom ne doit pas pouvoir se réduire sous le nom lui-même.
  assert.doesNotMatch(vue, /<span className="min-w-0">/, 'Le nom de l’outil s’écrirait par-dessus le montant sur téléphone.');
});

test('★ ACQUIS — le bandeau « Partage du mois » retire les frais de fonctionnement', () => {
  // L'exemple du propriétaire : 2 000 000 de recettes, 200 000 de dépenses,
  // 35 % → 630 000 au partenaire, 1 170 000 au projet.
  const mois = {
    mois: new Date().toISOString().slice(0, 7),
    recettesXof: 2_000_000,
    fraisBoutiqueXof: 0,
    depensesXof: 200_000,
  };
  const p: any = {
    mois: [mois],
    duMoisEnCoursXof: 630_000,
    duCumuleXof: 630_000,
    part_ca_pct: 35,
    paid: false,
  };
  const eco = calculerEconomie([p]);
  assert.equal(eco.depensesMoisXof, 200_000);
  assert.equal(eco.netMoisXof, 1_800_000, 'Le bandeau annoncerait 2 000 000 « nets » sous une part de 35 % de 1 800 000.');
  assert.equal(eco.resteAuProjetMoisXof, 1_170_000, 'Le reste au projet ne retire pas les dépenses.');

  // Deux partenaires ne font pas compter deux fois les mêmes dépenses.
  const deux = calculerEconomie([p, { ...p, duMoisEnCoursXof: 0, part_ca_pct: 0 }]);
  assert.equal(deux.depensesMoisXof, 200_000);

  // Et la page l'écrit, là où le partenaire refait la soustraction.
  const page = fs.readFileSync('src/app/admin/partenaires/page.tsx', 'utf8');
  assert.match(page, /−\{fcfa\(eco\.depensesMoisXof\)\} de frais de fonctionnement/);
  assert.match(page, /&minus; \{fcfa\(m\.depensesXof\)\} de frais de fonctionnement/, 'L’historique mois par mois ne montre pas les dépenses.');
});
