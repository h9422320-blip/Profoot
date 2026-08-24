import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireSuiviPrecision } = await jiti.import('./src/lib/suivi-precision.ts');
const s = await lireSuiviPrecision();
console.log('\n  ' + s.analysesLues + ' analyses verifiees -> ' + s.ensemble.matchs + ' matchs distincts.\n');
const l = (n, x) => console.log('  ' + n.padEnd(26) + String(x.matchs).padStart(5) + ' matchs  ' + String(x.vainqueur ?? '—').padStart(6) + ' %  score ' + String(x.scoreExact ?? '—').padStart(5) + ' %  confiance ' + String(x.confiance ?? '—') + ' % (ecart ' + String(x.ecartConfiance ?? '—') + ')');
l('Ensemble', s.ensemble);
l('Meme championnat', s.memeChampionnat);
l('Championnats croises', s.championnatsCroises);
console.log('\n  ══ SEMAINES ══\n');
for (const w of s.semaines.slice(-8)) l(w.debut, w);
console.log('');
