import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireBilanVisites } = await jiti.import('../src/lib/mesure-visites.ts');

const b = await lireBilanVisites(24);
console.log(`\n  ══ 24 DERNIÈRES HEURES ══\n`);
console.log(`  ${b.visites} visites · ${b.pagesVues} pages vues · ${b.pagesParVisite} pages par visite`);
console.log(`  ${b.tauxUnePage} % repartent après UNE seule page · ${b.partMobile} % sur téléphone\n`);

console.log(`  ══ LE TUNNEL DE VENTE ══\n`);
const p = (c) => b.pages.find((x) => x.chemin === c) ?? { visites: 0, vues: 0, tauxDeSortie: 0, secondesMoyennes: null };
for (const c of ['/', '/analyze', '/pricing', '/signup', '/login']) {
  const x = p(c);
  console.log(`  ${c.padEnd(12)} ${String(x.visites).padStart(4)} visites · ${String(x.secondesMoyennes ?? '—').padStart(5)} s · sortie ${x.tauxDeSortie} %`);
}

console.log(`\n  ══ OÙ ILS FERMENT ══\n`);
for (const x of b.sorties.slice(0, 5))
  console.log(`  ${String(x.tauxDeSortie + ' %').padStart(7)}  ${x.chemin.padEnd(24)} (${x.sorties}/${x.vues})`);

console.log(`\n  ══ LES CHEMINS ══\n`);
for (const c of b.cheminsFrequents.slice(0, 6))
  console.log(`  ${String(c.passages).padStart(3)} ×  ${c.parcours}`);
console.log('');
