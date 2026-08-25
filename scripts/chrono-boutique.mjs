import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti=createJiti(process.cwd(),{alias:{'@':path.resolve(process.cwd(),'src')}});
const { listRecentSales, listSalesEncaissees } = await jiti.import('./src/lib/chariow.ts');

console.log('\n  ══ COMBIEN COUTE LA LECTURE DE LA BOUTIQUE ══\n');
let t0=Date.now();
const toutes=await listRecentSales();
console.log('  listRecentSales ........ ' + (Date.now()-t0) + ' ms   ' + toutes.length + ' ventes');
t0=Date.now();
const encaissees=await listSalesEncaissees();
console.log('  listSalesEncaissees .... ' + (Date.now()-t0) + ' ms   ' + encaissees.length + ' ventes');
console.log('\n  La boutique rend 100 ventes par page : ' + Math.ceil(toutes.length/100) + ' allers-retours pour tout lire.');
console.log('');
