/** Ouvre les accès des clients qui ont payé sans rien recevoir, et les prévient. */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(),'src') } });
const { rattraperAccesManquants } = await jiti.import('./src/lib/acces-manquants.ts');
const b = await rattraperAccesManquants(true);
console.log('\n══ RÉSULTAT ══');
console.log(`  ventes encaissées ...... ${b.ventesEncaissees}`);
console.log(`  déjà servies ........... ${b.dejaServies}`);
console.log(`  ACCÈS ROUVERTS ......... ${b.repares}`);
console.log(`  clients prévenus ....... ${b.prevenus}`);
if (b.echecs?.length) { console.log('\n  ÉCHECS :'); for (const e of b.echecs) console.log(`     ${e.email} — ${e.raison}`); }
if (b.enAttenteInscription?.length) {
  console.log(`\n  EN ATTENTE D INSCRIPTION (${b.enAttenteInscription.length}) — à contacter à la main :`);
  for (const v of b.enAttenteInscription) console.log(`     ${v.email}   ${v.montant} FCFA   ${v.jour}`);
}
console.log('');
