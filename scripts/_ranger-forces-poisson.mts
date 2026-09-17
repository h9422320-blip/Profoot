/**
 * Ajuste le modèle de Poisson de chaque compétition et le range en réserve.
 *
 * Tourne sur l'ordinateur du propriétaire (challenger) : l'ajustement lit des
 * dizaines de milliers de rencontres et ne tient pas dans le temps accordé à
 * une requête. La production ne fait que LIRE le résultat.
 *
 *   npx tsx scripts/_ranger-forces-poisson.mts
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES } from './challenger/commun.mjs';
chargerEnv();
const { ajusterPoisson, rangerForcesPoisson, RENCONTRES_MINIMUM } = await import('../src/lib/forces-poisson.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const parLigue = new Map<number, any[]>();
for (const m of rencontres) {
  const l = Number(m.ligue);
  if (!Number.isFinite(l)) continue;
  const liste = parLigue.get(l);
  if (liste) liste.push(m);
  else parLigue.set(l, [m]);
}

const maintenant = Date.now();
const ligues: Record<string, any> = {};
let retenues = 0;
for (const [ligue, liste] of parLigue) {
  const f = ajusterPoisson(
    liste.map((m) => ({ date: m.date, ligue: Number(m.ligue), dom: Number(m.dom), ext: Number(m.ext), bd: Number(m.bd), be: Number(m.be) })),
    maintenant
  );
  if (!f) continue;
  ligues[String(ligue)] = f;
  retenues++;
}

console.log(`${parLigue.size} compétition(s) lues · ${retenues} ajustée(s) (au moins ${RENCONTRES_MINIMUM} rencontres récentes)`);
for (const [l, f] of Object.entries(ligues).slice(0, 8) as [string, any][])
  console.log(`  ligue ${l.padStart(4)} : ${Object.keys(f.clubs).length} clubs · terrain ${(Math.exp(f.terrain)).toFixed(3)} · base ${(Math.exp(f.base)).toFixed(2)} but(s) · ${f.rencontres} rencontres`);

if (process.argv.includes('--essai')) {
  console.log('essai : rien n’a été rangé.');
} else {
  await rangerForcesPoisson({ ligues, calculeLe: new Date().toISOString() });
  console.log('rangé en réserve.');
}
