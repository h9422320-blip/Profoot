/**
 * VERIFIER LES PRONOSTICS DU JOUR, PUIS RECONSTRUIRE LE MUR PUBLIC.
 *
 * Les deux etapes vivent normalement dans l'entretien quotidien. Celui-ci a
 * ete tue en plein vol par un deploiement le 6 septembre 2026 a 15 h 26, et
 * les rencontres jouees dans l'apres-midi n'etaient donc ni confrontees a leur
 * resultat, ni portees sur le mur.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const { verifierPronostics } = await import('../src/lib/precision-reelle.js');
const { construirePreuves } = await import('../src/lib/preuves.js');

// On repasse plusieurs fois : chaque appel traite un lot, et l'arriere de la
// journee peut en demander plusieurs.
let totalVerifiees = 0;
for (let passage = 1; passage <= 8; passage++) {
  const v = await verifierPronostics(120);
  totalVerifiees += v.verifiees;
  console.log(
    `  passage ${passage} : ${v.verifiees} verifiee(s) sur ${v.examinees} examinee(s), ${v.enAttente} en attente`
  );
  if (!v.verifiees) break;
}
console.log(`\n${totalVerifiees} analyse(s) confrontees a leur resultat.\n`);

const p = await construirePreuves();
console.log(
  `Mur reconstruit : ${p.matchs} match(s), ${p.reussites} reussite(s), ${p.creees} nouvelle(s) fiche(s)` +
    (p.erreur ? ` — ERREUR : ${p.erreur}` : '')
);
