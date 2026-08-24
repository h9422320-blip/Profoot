/**
 * Constat SEUL : on regarde ce que le rattrapage ferait, sans rien reparer ni
 * envoyer. Un e-mail part chez un vrai client — ca ne se declenche pas pour
 * verifier que le code fonctionne.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { rattraperAccesManquants } = await jiti.import('./src/lib/acces-manquants.ts');
const { courrielDisponible } = await jiti.import('./src/lib/courriel.ts');

console.log(`\n  Envoi de courriel configure : ${courrielDisponible() ? 'OUI' : 'NON — aucun e-mail ne partira'}`);
console.log('  Mode constat : rien ne sera repare, aucun e-mail envoye.\n');

const b = await rattraperAccesManquants(false);

console.log('  ══ ETAT DES ACCES ══\n');
console.log(`  Ventes encaissees .......... ${b.ventesEncaissees}`);
console.log(`  Deja servies ............... ${b.dejaServies}`);
console.log(`  Repares (mode constat) ..... ${b.repares}`);
console.log(`  Clients a prevenir ......... ${b.prevenus}`);
for (const [cle, valeur] of Object.entries(b)) {
  if (Array.isArray(valeur) && valeur.length) {
    console.log(`\n  ${cle} : ${valeur.length}`);
    for (const x of valeur.slice(0, 5)) console.log(`    ${JSON.stringify(x).slice(0, 120)}`);
  }
}
console.log('');
