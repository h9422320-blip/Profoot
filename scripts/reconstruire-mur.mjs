import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { construirePreuves, getToutesPreuves } = await jiti.import('./src/lib/preuves.ts');

const avant = await getToutesPreuves();
console.log(`\n  AVANT : ${avant.preuves.length} matchs sur le mur, ${avant.reussites} reussites, ${avant.publiees ?? '?'} publiees.`);

const r = await construirePreuves();
console.log(`\n  Reconstruction : ${r.matchs} matchs, ${r.reussites} reussites, ${r.creees} nouvelles.`);
if (r.erreur) console.log('  erreur : ' + r.erreur);

const apres = await getToutesPreuves();
console.log(`\n  APRES : ${apres.preuves.length} matchs sur le mur, ${apres.reussites} reussites, ${apres.publiees ?? '?'} publiees.`);

// Les matchs du 24 sont-ils la ?
const du24 = apres.preuves.filter((p) => String(p.dateMatch ?? p.date ?? '').slice(0, 10) === '2026-08-24');
console.log(`\n  Matchs du 24 aout presents sur le mur : ${du24.length}`);
for (const p of du24.slice(0, 14)) {
  console.log(`    ${p.reussi ? 'OK ' : '   '} ${(p.equipe1 ?? p.team1 ?? '?') + ' — ' + (p.equipe2 ?? p.team2 ?? '?')}`);
}
console.log('');
