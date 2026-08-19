/**
 * Ouvre l'acces des ventes payees restees sans suite.
 *
 * Utilise le module de reconciliation REEL de l'application, pas une copie :
 * ce qui est repare ici l'est exactement comme le webhook l'aurait fait.
 */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}));
for (const [k,v] of Object.entries(env)) process.env[k]=v;

// L'alias « @/ » du projet n'existe pas hors de Next : on le declare ici.
const jiti = createJiti(import.meta.url, {
  alias: { '@': path.resolve(process.cwd(), 'src') },
});

const { reconcilierVentes } = await jiti.import('../src/lib/reconciliation-ventes.ts');

const jours = Number(process.argv[2] ?? 7);
console.log(`\nReconciliation sur ${jours} jour(s)...\n`);
const r = await reconcilierVentes(jours);

console.log(`Ventes encaissees examinees : ${r.ventesExaminees}`);
console.log(`Acces ouverts               : ${r.reparees.length}`);
for (const x of r.reparees) console.log(`   OK  ${x.email ?? '?'}  ${x.montant ?? '?'} F  ${x.plan ?? '?'}  (${x.saleId})`);
if (r.sansTrace.length) {
  console.log(`\nSans trace (impossible de savoir a qui) : ${r.sansTrace.length}`);
  for (const x of r.sansTrace) console.log(`   ?  ${x.email ?? '—'}  ${x.saleId}`);
}
if (r.erreurs.length) {
  console.log(`\nErreurs : ${r.erreurs.length}`);
  for (const x of r.erreurs) console.log(`   !!  ${x.saleId} : ${x.message}`);
}
console.log('');
