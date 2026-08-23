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
const t0 = Date.now();
const r = await verifierPronostics(1500);
console.log(`\n  Vérification : ${r.verifiees} confrontée(s) au résultat réel, ${r.enAttente} pas encore jouées — ${Math.round((Date.now() - t0) / 1000)} s`);

const { construirePreuves } = await jiti.import('../src/lib/preuves.ts');
const t1 = Date.now();
const p = await construirePreuves();
console.log(`  Mur reconstruit : ${p.matchs} match(s), ${p.reussites} réussite(s), ${p.creees} nouvelle(s) — ${Math.round((Date.now() - t1) / 1000)} s\n`);
