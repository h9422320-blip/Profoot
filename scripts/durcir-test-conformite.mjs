/**
 * Ajoute « probabilité » et « abonnement » à la liste que le test refuse.
 *
 * Ce sont les deux mots du reproche de la boutique le 27 août 2026 :
 * « produits interdits (Abonnements, Paris Sportifs, Jeux de hasard) ».
 */
import fs from 'node:fs';

const p = 'tests/conformite-vocabulaire.test.ts';
const lignes = fs.readFileSync(p, 'utf8').split(/\r?\n/);

const i = lignes.findIndex((l) => l.startsWith('const INTERDITS ='));
if (i < 0) { console.log('  INTERDITS introuvable'); process.exit(1); }

// La ligne du motif suit immédiatement la déclaration.
const j = i + 1;
if (!lignes[j].includes('pronostics?')) { console.log('  motif introuvable ligne ' + (j + 1)); process.exit(1); }

const bloc = [
  '',
  '/**',
  ' * LES DEUX MOTS DU REPROCHE DE LA BOUTIQUE — 27 AOÛT 2026.',
  ' *',
  ' * Chariow a bloqué les paiements pour « produits interdits (Abonnements,',
  ' * Paris Sportifs, Jeux de hasard) ». Les paris étaient déjà traités ; ces',
  ' * deux-là restaient, et le premier figure littéralement dans le motif.',
  ' *',
  ' * « probabilité » appartient au vocabulaire du pari : un contrôleur y lit',
  ' * une chance de gain. Le moteur ne prétend rien de plus que mesurer une',
  ' * tendance — le mot juste est donc aussi le mot prudent.',
  ' *',
  ' * « abonnement » était FAUX, ce qui est pire que risqué. Vérifié dans le',
  " * code le 27 août : le passage en caisse n'envoie aucun paramètre de",
  " * récurrence, et l'accès porte une date de fin fixe que rien ne renouvelle.",
  ' * ProFoot vend un achat unique ouvrant un accès pour une durée donnée. Le',
  " * mot annonçait un prélèvement automatique qui n'a jamais existé.",
  ' *',
  " * Séparés d'INTERDITS parce qu'ils ont une exception chacun :",
  ' *',
  " *   — « improbable » contient « probable » sans rien promettre ;",
  ' *   — la table `subscriptions` et les colonnes qui en dépendent gardent leur',
  ' *     nom : les renommer casserait la base sans rien protéger, puisque',
  ' *     aucun visiteur ne voit un nom de table.',
  ' */',
  'const PROBABILITE_ET_ABONNEMENT =',
  "  /(?<!im)\\bprobabilit[ée]|\\bprobables?\\b|\\bprobablement\\b|\\bprobas?\\b|\\babonnements?\\b|\\b[stm]['’]abonner\\b|\\babonn[ée]/i;",
];

lignes.splice(j + 1, 0, ...bloc);

// Le contrôle des textes affichables doit interroger les deux listes.
const k = lignes.findIndex((l) => l.includes('!INTERDITS.test(affichable)'));
if (k < 0) { console.log('  contrôle affichable introuvable'); process.exit(1); }
lignes[k] = lignes[k].replace(
  '!INTERDITS.test(affichable)',
  '!INTERDITS.test(affichable) && !PROBABILITE_ET_ABONNEMENT.test(affichable)'
);

fs.writeFileSync(p, lignes.join('\n'), 'utf8');
console.log(`  liste ajoutée après la ligne ${j + 1}, contrôle durci ligne ${k + 1}`);
