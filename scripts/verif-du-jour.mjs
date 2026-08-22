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

// 1. L'entretien automatique a-t-il tourné tout seul ?
const { dernierEntretien } = await jiti.import('../src/lib/entretien-quotidien.ts');
const dernier = await dernierEntretien();
console.log(`\n  ══ L'ENTRETIEN AUTOMATIQUE ══\n`);
if (!dernier) console.log('  Aucune trace : il n a JAMAIS tourné.');
else {
  const h = Math.round((Date.now() - dernier.getTime()) / 3600000 * 10) / 10;
  console.log(`  Dernier passage : ${dernier.toISOString().slice(0, 16).replace('T', ' ')} UTC — il y a ${h} h`);
}

// 2. Vérifier les pronostics, puis reconstruire le mur.
const { verifierPronostics } = await jiti.import('../src/lib/precision-reelle.ts');
const r1 = await verifierPronostics(400);
console.log(`\n  Vérification : ${r1?.verifiees ?? 0} analyse(s) confrontées au résultat réel.`);

const { construirePreuves } = await jiti.import('../src/lib/preuves.ts');
const r2 = await construirePreuves();
console.log(`  Mur reconstruit : ${r2.matchs} match(s), ${r2.reussites} réussite(s), ${r2.creees} nouvelle(s).`);
