/**
 * VÉRIFICATION FINALE, PAGE PAR PAGE.
 *
 * On ne regarde que ce qui part vraiment au navigateur : les commentaires sont
 * retirés d'abord, exactement comme le fait `conformite-vocabulaire.test.ts`.
 * Un commentaire a le droit de nommer ce qu'il explique.
 */
import fs from 'node:fs';

const PAGES = [
  ['Landing page', 'src/app/LandingClient.tsx'],
  ['Inscription', 'src/app/signup/page.tsx'],
  ['Connexion', 'src/app/login/page.tsx'],
  ['Analyse', 'src/app/(dashboard)/analyze/AnalyzeClient.tsx'],
  ['Paywall analyse', 'src/app/(dashboard)/analyze/PaywallDeuxChemins.tsx'],
  ['Compétitions', 'src/app/(dashboard)/competitions/page.tsx'],
  ['Agent VIP', 'src/app/(dashboard)/expert/page.tsx'],
  ['Historique / profil', 'src/app/(dashboard)/history/page.tsx'],
  ['Offres (ex-abonnement)', 'src/app/(dashboard)/pricing/PricingClient.tsx'],
  ['Preuves', 'src/app/(dashboard)/preuves/page.tsx'],
  ['Preuves (cartes)', 'src/components/preuves/SectionPreuves.tsx'],
  ['CGV', 'src/app/cgv/page.tsx'],
  ['Support', 'src/app/support/page.tsx'],
  ['Confidentialité', 'src/app/confidentialite/page.tsx'],
  ['Mentions légales', 'src/app/mentions-legales/page.tsx'],
  ['Paiement réussi', 'src/app/(dashboard)/payment-success/page.tsx'],
  ['Maintenance', 'src/app/maintenance/page.tsx'],
  ['Traductions', 'src/dictionaries/fr.ts'],
  ['Métadonnées racine', 'src/app/layout.tsx'],
  ['Courriels clients', 'src/lib/courriel.ts'],
];

const PARIS = /\b(?:pari|paris\s+sportifs?|parier|parieur|pronostics?|pronostiquer|miser|bookmakers?|coupons?|banco|jackpots?|cotes?)\b|\bodds\b|\bpr[ée]diction\b/i;
const NOUVEAUX = /(?<!im)\bprobabilit[ée]|\bprobables?\b|\bprobablement\b|\bprobas?\b|\babonnements?\b|\b[stm]['’]abonner\b|\babonn[ée]/i;
// Fautes que les remplacements auraient pu introduire : accord, article doublé.
const CASSE = /\bcompositions attendus\b|\b[ée]quipes attendus\b|\bla plus attendu\b|\bune attendu\b|\bde de\b|\bl['’]l['’]|\bde l['’]offre offre\b|\bacc[èe]s acc[èe]s\b/i;

/** Retire commentaires de ligne et de bloc, comme le test de conformité. */
function sansCommentaires(src) {
  const sortie = [];
  let bloc = false;
  for (const ligne of src.split(/\r?\n/)) {
    const nue = ligne.trim();
    if (bloc) { if (ligne.includes('*/')) bloc = false; sortie.push(''); continue; }
    if (nue.startsWith('/*') || nue.startsWith('{/*')) {
      if (!ligne.includes('*/')) bloc = true;
      sortie.push(''); continue;
    }
    if (nue.startsWith('//') || nue.startsWith('*')) { sortie.push(''); continue; }
    sortie.push(ligne.replace(/\/\/.*$/, ''));
  }
  return sortie;
}

let rouge = 0;
console.log('');
for (const [nom, chemin] of PAGES) {
  let src;
  try { src = fs.readFileSync(chemin, 'utf8'); } catch {
    console.log(`  🔴  ${nom.padEnd(24)} FICHIER INTROUVABLE`); rouge++; continue;
  }

  const problemes = [];
  sansCommentaires(src).forEach((l, i) => {
    if (!l.trim()) return;
    if (PARIS.test(l)) problemes.push(`${i + 1}  pari : ${l.trim().slice(0, 72)}`);
    if (NOUVEAUX.test(l)) problemes.push(`${i + 1}  interdit : ${l.trim().slice(0, 72)}`);
    if (CASSE.test(l)) problemes.push(`${i + 1}  texte cassé : ${l.trim().slice(0, 72)}`);
  });

  if (!problemes.length) console.log(`  ✅  ${nom.padEnd(24)} ${chemin}`);
  else {
    rouge++;
    console.log(`  🔴  ${nom.padEnd(24)} ${chemin}`);
    for (const p of problemes.slice(0, 5)) console.log(`         ${chemin}:${p}`);
  }
}
console.log(`\n  ${PAGES.length - rouge} page(s) ✅ , ${rouge} 🔴\n`);
