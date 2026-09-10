/** Vide tout l'arriere de verification, puis reconstruit le mur. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { verifierPronostics } = await import('../src/lib/precision-reelle.js');
const { construirePreuves } = await import('../src/lib/preuves.js');
let total = 0;
for (let passage = 1; passage <= 6; passage++) {
  const v = await verifierPronostics(3000);
  total += v.verifiees;
  console.log(`  passage ${passage} : ${v.verifiees} verifiee(s) sur ${v.examinees}, ${v.enAttente} en attente`);
  if (!v.verifiees) break;
}
console.log(`\n${total} analyse(s) de plus confrontees.\n`);
const p = await construirePreuves();
console.log(`Mur : ${p.matchs} match(s), ${p.reussites} reussite(s), ${p.creees} nouvelle(s)` + (p.erreur ? ` — ERREUR ${p.erreur}` : ''));
