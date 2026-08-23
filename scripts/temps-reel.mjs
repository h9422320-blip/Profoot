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
const { recettesParJour, totalEntre } = await jiti.import('../src/lib/recettes-boutique.ts');
for (let i = 1; i <= 2; i++) {
  const t0 = Date.now();
  const j = await recettesParJour();
  const t = totalEntre(j, '2026-08-16', '2026-08-23');
  console.log(`  lecture ${i} : ${t.xof.toLocaleString('fr-FR')} FCFA · ${t.ventes} ventes · ${Date.now() - t0} ms`);
}
