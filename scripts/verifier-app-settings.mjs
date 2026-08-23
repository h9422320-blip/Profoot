/** Le serveur lit-il toujours ses réglages après la fermeture publique ? */
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
const m = await jiti.import('../src/lib/app-settings.ts');
const r = await m.lireReglages();
console.log('\n  ══ LECTURE PAR LA CLÉ DE SERVICE ══\n');
console.log('  Réglages lus :', r ? 'OUI' : 'NON');
for (const [k, v] of Object.entries(r ?? {}))
  console.log(`     ${k.padEnd(20)} : ${String(v).slice(0, 50)}`);
console.log('');
