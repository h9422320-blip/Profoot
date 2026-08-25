import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti=createJiti(process.cwd(),{alias:{'@':path.resolve(process.cwd(),'src')}});

const chrono = async (nom, fn) => {
  const t0=Date.now();
  try { await fn(); } catch(e) { console.log('  ' + nom.padEnd(34) + ' ERREUR ' + e.message.slice(0,40)); return 0; }
  const ms=Date.now()-t0;
  console.log('  ' + nom.padEnd(34) + String(ms+' ms').padStart(9) + (ms>2000?'   <<< LOURD':''));
  return ms;
};

console.log('\n  ══ CE QUE CHAQUE BLOC DE /admin COUTE ══\n');
let total=0;
const { lireSuiviPrecision } = await jiti.import('./src/lib/suivi-precision.ts');
total += await chrono('Suivi de precision', lireSuiviPrecision);
const { lireControleMarche } = await jiti.import('./src/lib/controle-marche.ts');
total += await chrono('Controle du marche (cotes)', lireControleMarche);
const { lireBilanFidelisation } = await jiti.import('./src/lib/fidelisation.ts');
total += await chrono('Fidelisation', lireBilanFidelisation);
const { getBilanEchecs } = await jiti.import('./src/lib/echecs-analyse.ts');
total += await chrono('Echecs d analyse', getBilanEchecs);
const { lireBilanVisites } = await jiti.import('./src/lib/mesure-visites.ts');
total += await chrono('Mesure maison (audience)', () => lireBilanVisites(24));
const { getAdminMetrics, resoudrePeriode } = await jiti.import('./src/lib/admin-metrics.ts');
total += await chrono('Indicateurs (boutique Chariow)', () => getAdminMetrics(resoudrePeriode({})));

console.log('\n  TOTAL si tout se fait a la suite : ' + total + ' ms   (' + Math.round(total/1000) + ' s)');
console.log('');
