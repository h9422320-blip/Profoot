/**
 * INSCRIRE UNE DÉPENSE DE FONCTIONNEMENT.
 *
 * Elle sera retirée du chiffre d'affaires du mois de son PAIEMENT, avant le
 * partage avec le partenaire, et affichée ligne par ligne sur sa fiche.
 *
 *   npx tsx scripts/depense.mts --jour 2026-09-26 --fournisseur supabase \
 *     --libelle "abonnement mensuel" --montant 25 --devise USD [--taux 600] \
 *     [--recurrente] [--source "reçu Gmail"] [--reference 1a0d...]
 *
 * Sans --ecrire, rien n'est inscrit : la commande montre ce qu'elle ferait.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const arg = (nom: string, defaut = '') => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : defaut;
};
const { inscrireDepense, enFrancs, cleDeDepense, libelleDepense, TAUX_USD_XOF } = await import('../src/lib/depenses.js');

const d = {
  jour: arg('jour', new Date().toISOString().slice(0, 10)),
  fournisseur: arg('fournisseur', 'autre') as any,
  libelle: arg('libelle', 'dépense'),
  montant: Number(arg('montant', '0')),
  devise: (arg('devise', 'USD') as any),
  taux: Number(arg('taux', String(TAUX_USD_XOF))),
  recurrente: process.argv.includes('--recurrente'),
  source: arg('source', 'saisie'),
  reference: arg('reference', '') || null,
};
const xof = enFrancs(d.montant, d.devise, d.taux);
console.log(`${d.jour} · ${libelleDepense(d)} = ${xof.toLocaleString('fr-FR')} FCFA · clé ${cleDeDepense(d)}`);
if (!process.argv.includes('--ecrire')) {
  console.log('(rien inscrit — ajouter --ecrire)');
} else {
  console.log('résultat :', await inscrireDepense(d));
}
