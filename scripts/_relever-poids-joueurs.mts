// Relève (ou complète) le poids des joueurs des cinq grands championnats.
//   npx tsx scripts/_relever-poids-joueurs.mts [passages]
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { recalculerPoidsDesJoueurs } = await import('../src/lib/forces-absences.js');
for (let i = 1; i <= Number(process.argv[2] ?? 1); i++) {
  const r = await recalculerPoidsDesJoueurs(undefined, { forcer: true });
  const compte = (x: any) => Object.values(x?.saisons ?? {}).reduce((t: number, y: any) => t + String(y).split(',').length, 0);
  console.log(`passage ${i} : ${compte(r)} joueurs retenus`);
}
