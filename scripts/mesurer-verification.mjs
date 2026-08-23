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
const r = await verifierPronostics(300);
const s = Math.round((Date.now() - t0) / 100) / 10;
console.log(`\n  300 analyses en ${s} s`);
console.log(`  ${r.verifiees} vérifiée(s) · ${r.enAttente} en attente · ${r.examinees} examinée(s)`);
console.log(`  → ${Math.round(300 / Math.max(1, s))} analyses par seconde\n`);
