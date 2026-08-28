/**
 * ★ ACQUIS — DEUX PERSONNES SE PARTAGENT CET ARGENT.
 *
 * ── CE QUI EST EN JEU ─────────────────────────────────────────────────────
 *
 * Un influenceur touche 35 % des recettes, le propriétaire garde le reste. Une
 * erreur de calcul ici ne produit pas un écran de travers : elle fait perdre
 * de l'argent réel à l'un des deux, et ni l'un ni l'autre n'a les moyens de
 * s'en apercevoir.
 *
 * Le 28 août 2026, deux défauts se sont succédé sur cette page :
 *
 *   1. Toute l'administration est tombée à ZÉRO le jour où l'on a débranché
 *      Chariow, parce que sa seule source d'argent vivait chez ce tiers.
 *   2. Un écart de 2 000 francs sur la journée du 27 a été repéré à l'œil par
 *      le propriétaire : une vente créée le 26 au soir et réglée le 27 au
 *      matin était comptée du mauvais côté de minuit.
 *
 * ── LA RÈGLE, TELLE QU'ÉNONCÉE PAR LE PROPRIÉTAIRE ────────────────────────
 *
 * « Il prend ses 35 % quand tous les frais sont pris en compte. » Sur la seule
 * période d'août, la différence entre les deux lectures possibles atteint
 * 55 387 FCFA.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  HISTOIRE_CHARIOW,
  TAUX_CHARIOW,
  DERNIER_JOUR_CHARIOW,
  totalChariow,
} from '../src/lib/recettes-histoire';
import { totalEntre, parMois, netApresFrais, tauxMaketou } from '../src/lib/recettes-boutique';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ── L'HISTOIRE NE PEUT PLUS DISPARAÎTRE ────────────────────────────────────

test('★ ACQUIS — les recettes de la boutique fermée sont figées dans le code', () => {
  // Un cache a le droit de disparaître ; l'argent déjà gagné, non. Le 28 août,
  // la page affichait zéro parce que sa source vivait chez un tiers qu'on
  // venait de débrancher.
  const total = totalChariow();
  assert.equal(total.xof, 1094200, 'Le total encaissé chez Chariow a changé.');
  assert.equal(total.ventes, 358, 'Le nombre de ventes Chariow a changé.');
});

test('★ ACQUIS — la période du contrat vaut exactement ce qui a été encaissé', () => {
  // Confirmé de mémoire par le propriétaire AVANT tout calcul : 1 055 000.
  let contrat = 0;
  for (const [jour, j] of Object.entries(HISTOIRE_CHARIOW)) {
    if (jour >= '2026-08-16') contrat += j.xof;
  }
  assert.equal(contrat, 1055000);
});

test('★ ACQUIS — chaque journée est datée de la CRÉATION de la vente', () => {
  // Vérifié contre l'écran de Chariow : le 27 août affiche 11 ventes et
  // 38 000 FCFA. Classées par date d'encaissement, on en trouvait 12 et
  // 40 000 — une vente créée le 26 à 17 h 58 réglée le 27 à 02 h 40.
  assert.deepEqual(HISTOIRE_CHARIOW['2026-08-27'], { xof: 38000, ventes: 11 });
  assert.deepEqual(HISTOIRE_CHARIOW['2026-08-26'], { xof: 131000, ventes: 47 });
});

test('★ ACQUIS — l’histoire s’arrête au jour où la boutique a fermé', () => {
  const jours = Object.keys(HISTOIRE_CHARIOW).sort();
  assert.equal(jours[jours.length - 1], DERNIER_JOUR_CHARIOW);
});

// ── LES FRAIS SE COMPTENT AU TAUX DE CHAQUE BOUTIQUE ───────────────────────

test('★ ACQUIS — chaque journée porte les frais de la boutique qui l’a encaissée', () => {
  // Les taux diffèrent : 15 % chez Chariow, un autre chez MakeTou. Un taux
  // moyen appliqué au total donnerait un prélèvement que personne n'a opéré.
  const parJour = {
    '2026-08-20': { xof: 53000, ventes: 22, fraisXof: Math.round(53000 * TAUX_CHARIOW) },
    '2026-08-28': { xof: 36000, ventes: 18, fraisXof: Math.round(36000 * tauxMaketou()) },
  };
  const t = totalEntre(parJour);
  assert.equal(t.xof, 89000);
  assert.equal(t.fraisXof, 7950 + Math.round(36000 * tauxMaketou()));
});

test('★ ACQUIS — la part porte sur le NET, jamais sur le brut', () => {
  // 35 % de 1 055 000 = 369 250. 35 % de 896 750 = 313 863. L'écart est de
  // 55 387 francs, et l'une des deux lectures fait perdre quelqu'un.
  const journee = { xof: 1055000, ventes: 358, fraisXof: 158250 };
  assert.equal(netApresFrais(journee), 896750);
  assert.equal(Math.round(netApresFrais(journee) * 0.35), 313863);

  const source = lire('src/lib/partenaires.ts');
  assert.match(
    source,
    /duXof: Math\.round\(\(net \* partPct\) \/ 100\)/,
    'La part du partenaire ne se calcule plus sur le net.'
  );
});

test('★ ACQUIS — le regroupement mensuel n’oublie pas les frais', () => {
  // Sans cette ligne, le mois rendrait un prélèvement nul et la part
  // porterait sur le brut — sans que rien ne le signale à l'écran.
  const mois = parMois({
    '2026-08-20': { xof: 53000, ventes: 22, fraisXof: 7950 },
    '2026-08-21': { xof: 113000, ventes: 21, fraisXof: 16950 },
  });
  const aout = mois.get('2026-08');
  assert.equal(aout?.xof, 166000);
  assert.equal(aout?.fraisXof, 24900);
});

test('★ ACQUIS — même le chemin de secours retient les frais', () => {
  // Ce chemin ne sert que le jour où l'on ne regarde pas. Un secours qui se
  // trompe en faveur de quelqu'un reste un secours qui se trompe.
  const source = lire('src/lib/partenaires.ts');
  assert.match(source, /poste\.fraisXof \+= Math\.round\(/);
  assert.match(source, /jour <= DERNIER_JOUR_CHARIOW \? TAUX_CHARIOW : tauxMaketou\(\)/);
});

// ── CE QUE L'ŒIL DOIT POUVOIR VÉRIFIER ─────────────────────────────────────

test('★ ACQUIS — le taux MakeTou est affiché, pas caché', () => {
  // Il n'est pas encore confirmé par un relevé de transactions. Un taux faux
  // qu'on voit se corrige ; un taux faux qu'on ne voit pas se paie.
  const page = lire('src/app/admin/partenaires/page.tsx');
  assert.match(page, /tauxMaketou\(\) \* 100/);
  assert.match(page, /MAKETOU_COMMISSION_PCT/);
});

test('★ ACQUIS — le taux MakeTou se règle sans toucher au code', () => {
  const avant = process.env.MAKETOU_COMMISSION_PCT;
  try {
    process.env.MAKETOU_COMMISSION_PCT = '3.5';
    assert.equal(tauxMaketou(), 0.035);
    process.env.MAKETOU_COMMISSION_PCT = 'nimportequoi';
    assert.equal(tauxMaketou(), 0.05, 'Une valeur illisible doit retomber sur 5 %.');
    process.env.MAKETOU_COMMISSION_PCT = '150';
    assert.equal(tauxMaketou(), 0.05, 'Un taux hors bornes est refusé.');
  } finally {
    if (avant) process.env.MAKETOU_COMMISSION_PCT = avant;
    else delete process.env.MAKETOU_COMMISSION_PCT;
  }
});

test('★ ACQUIS — le partage affiché tombe juste', () => {
  // Il ne montrait que trois nombres, et les frais de boutique s'évaporaient
  // entre les deux derniers : le projet semblait garder 765 167 FCFA en août
  // quand il en garde 605 118. Les deux montants voisins étaient pourtant
  // exacts chacun de son côté — c'est le partage qui mentait.
  const source = lire('src/lib/partenaires.ts');
  assert.match(
    source,
    /resteAuProjetMoisXof: Math\.max\(0, netMoisXof - partPartenairesMoisXof\)/,
    'Le reste au projet repart du brut : la commission de la boutique disparaît.'
  );

  const page = lire('src/app/admin/partenaires/page.tsx');
  assert.match(page, /Frais de boutique/, 'La commission n’a plus sa colonne à l’écran.');
  assert.match(page, /eco\.fraisBoutiqueMoisXof/);
});

test('★ ACQUIS — le détail jour par jour reste affiché', () => {
  // Un total mensuel ne se vérifie pas. C'est en comparant une LIGNE avec
  // l'écran de la boutique que l'écart du 27 août a été trouvé.
  const page = lire('src/app/admin/partenaires/page.tsx');
  assert.match(page, /Jour par jour/);
  assert.match(page, /Encaissé/);
  assert.match(page, /Frais/);
  assert.match(page, /Net/);
});

test('★ ACQUIS — l’administration ne redemande plus rien à la boutique fermée', () => {
  // C'est cette dépendance qui a mis tous les chiffres à zéro.
  const recettes = lire('src/lib/recettes-boutique.ts');
  assert.doesNotMatch(
    recettes,
    /from '\.\/chariow'/,
    'Les recettes réimportent la boutique fermée : les chiffres retomberont à zéro.'
  );
  assert.match(recettes, /from '\.\/recettes-histoire'/);
});
