import fs from 'fs';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url);
const { recalculerCalibrages, lireCalibrages, facteursPour } = await jiti.import('../src/lib/calibrage.ts');
const r = await recalculerCalibrages();
console.log(`\n  ${r.ligues} championnat(s), ${r.matchs} rencontre(s) jugée(s).\n`);
console.log('  championnat                    matchs  facteur  justesse  APPLIQUÉ ?');
console.log('  ------------------------------------------------------------------');
const cal = await lireCalibrages();
for (const d of r.detail.slice(0, 14)) {
  const f = facteursPour(cal, d.ligue);
  console.log(`  ${d.ligue.slice(0,28).padEnd(29)} ${String(d.matchs).padStart(5)}  ${d.facteurButs.toFixed(3)}   ${d.justesse.toFixed(1).padStart(5)} %   ${f.domicile === 1 && f.exterieur === 1 ? 'non — moteur inchangé' : `OUI ${f.domicile.toFixed(3)}/${f.exterieur.toFixed(3)}`}`);
}
