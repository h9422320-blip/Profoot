/** Rejoue les DEUX étapes qui alimentent le mur, exactement comme l'entretien. */
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

const { verifierPronostics } = await jiti.import('../src/lib/precision-reelle.ts');
const r1 = await verifierPronostics(300);
console.log(`\n  Vérification des pronostics : ${r1?.verifiees ?? 0} analyse(s) vérifiée(s)`);

const { construirePreuves } = await jiti.import('../src/lib/preuves.ts');
const r2 = await construirePreuves();
console.log(`  Reconstruction du mur : ${r2.matchs} match(s), ${r2.reussites} réussite(s), ${r2.creees} nouvelle(s)\n`);
