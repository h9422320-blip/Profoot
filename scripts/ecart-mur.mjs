/**
 * Pourquoi le mur compte 11 réussites là où le décompte brut en trouve 12 ?
 *
 * Les deux définitions sont légitimes mais différentes :
 *   — la base garde `winner_correct`, calculé sur l'issue FIGÉE à l'analyse ;
 *   — le mur juge sur ce que la CARTE affiche, pronostic contre résultat.
 *
 * La seconde a été adoptée le 16 août 2026, après qu'une carte a montré
 * « pronostic 1-0 » à côté de « résultat 0-3 » en la présentant comme une
 * réussite. Un visiteur n'a pas besoin d'être expert pour voir le mensonge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { getToutesPreuves } = await jiti.import('./src/lib/preuves.ts');

const { preuves } = await getToutesPreuves();
const du24 = preuves.filter((p) => String(p.dateMatch ?? '').slice(0, 10) === '2026-08-24');

console.log(`\n  ${du24.length} matchs du 24 aout sur le mur.\n`);
console.log('  verdict     pronostic   reel      analyses  match');
console.log('  ' + '─'.repeat(78));

for (const p of du24.sort((a, b) => Number(b.issueCorrecte) - Number(a.issueCorrecte))) {
  console.log(
    `  ${(p.issueCorrecte ? 'REUSSITE' : 'echec').padEnd(11)} ` +
    `${String(p.pronoScore ?? '?').padEnd(11)} ${String(p.scoreReel ?? '?').padEnd(9)} ` +
    `${String(p.analysesComptees ?? '?').padStart(8)}  ${p.equipe1} — ${p.equipe2}`
  );
}

const reussites = du24.filter((p) => p.issueCorrecte);
console.log(`\n  ${reussites.length} reussites sur ${du24.length} — ${Math.round((reussites.length / du24.length) * 100)} %`);

const publiees = du24.filter((p) => p.publiee);
console.log('  dont publiees (visibles sur la page) : ' + publiees.length);
console.log('  reussites publiees : ' + publiees.filter(x=>x.issueCorrecte).length);
console.log('  echecs publies : ' + publiees.filter(x=>!x.issueCorrecte).length);
const mallorca = null;
if (mallorca) {
  console.log('\n  ══ LE CAS QUI DIVERGE ══\n');
  console.log(JSON.stringify(mallorca, null, 1));
}
console.log('');
