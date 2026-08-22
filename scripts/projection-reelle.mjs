/** Ce que NOTRE moteur calcule vraiment sur Espanyol — Real Madrid en direct. */
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
const { predireIssueFinale } = await jiti.import('../src/lib/score-probable.ts');

// Buts attendus d'avant-match, dans le sens du fournisseur : Espanyol reçoit.
// Ordre de grandeur d'un Real Madrid en déplacement contre un promu.
const xgEspanyol = 1.05, xgReal = 1.95;

console.log(`\n  Buts attendus d'avant-match : Espanyol ${xgEspanyol} — Real ${xgReal}\n`);
console.log(`  minute  score    prévision finale   nul %  Esp %  Real %   verdict`);
console.log(`  ${'-'.repeat(104)}`);
for (const [minute, b1, b2] of [[45,1,1],[60,1,1],[72,1,1],[80,1,1],[88,1,1],[45,0,1],[72,0,1]]) {
  const p = predireIssueFinale(xgEspanyol, xgReal, b1, b2, minute, 'Espanyol', 'Real Madrid');
  const copie = p.scoreFinal1 === b1 && p.scoreFinal2 === b2 ? '  <-- identique au score actuel' : '';
  console.log(
    `  ${String(minute).padStart(5)}'  ${b1}-${b2}      ${p.scoreFinal1}-${p.scoreFinal2}` +
    `             ${String(p.probaNul).padStart(4)}  ${String(p.probaVictoire1).padStart(5)}  ${String(p.probaVictoire2).padStart(5)}   ${String(p.verdict).slice(0, 40)}${copie}`
  );
}
console.log('');
