// Lecture seule : les calibrages par championnat appliqués en production.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireCalibrages } = await import('../src/lib/calibrage.js');
const m = await lireCalibrages();
const lignes = [...m.values()].sort((a: any, b: any) => b.matchsObserves - a.matchsObserves);
console.log(`championnats calibrés : ${lignes.length} · actifs : ${lignes.filter((c: any) => c.actif).length}`);
for (const c of lignes.slice(0, 20) as any[])
  console.log(
    `${String(c.ligue).padEnd(26)} matchs ${String(c.matchsObserves).padStart(4)} ` +
      `buts ${c.facteurButs.toFixed(3)} dom ${c.facteurDomicile.toFixed(3)} ext ${c.facteurExterieur.toFixed(3)} ` +
      `· ${c.actif ? 'APPLIQUÉ' : 'inerte'} · justesse ${c.justesseAvant ?? '?'} → ${c.justesse ?? '?'}`
  );
