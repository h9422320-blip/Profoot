/** Ce que le mur public affiche, dans l'ordre. Rien n'est écrit. */
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
const { getPreuvesPubliques } = await jiti.import('../src/lib/preuves.ts');

const aujourdhui = new Date().toISOString().slice(0, 10);
const { preuves, total, bilan } = await getPreuvesPubliques(12);

console.log(`\n  ${total} preuve(s) au total — ${bilan.scoresExacts} score(s) exact(s).`);
console.log(`  Aujourd'hui : ${aujourdhui}\n`);
console.log(`  #   date         match                                        compétition            exact`);
console.log(`  ${'-'.repeat(96)}`);
preuves.forEach((p, i) => {
  const jour = String(p.dateMatch ?? '').slice(0, 10);
  const marque = jour === aujourdhui ? '  <<< AUJOURD HUI' : '';
  console.log(
    `  ${String(i + 1).padStart(2)}  ${jour}   ${`${p.equipe1} — ${p.equipe2}`.slice(0, 42).padEnd(43)} ` +
    `${String(p.competition ?? '').slice(0, 21).padEnd(22)} ${p.scoreExact ? 'OUI' : '   '}${marque}`
  );
});
const duJour = preuves.filter((p) => String(p.dateMatch ?? '').slice(0, 10) === aujourdhui).length;
console.log(`\n  ${duJour} preuve(s) du jour dans les 12 premières cartes.\n`);
