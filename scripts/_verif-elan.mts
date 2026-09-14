import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireElanEtTerrain, correctionElanTerrain } = await import('../src/lib/elan-et-terrain.js');
const r = await lireElanEtTerrain();
if (!r) { console.log('RELEVÉ ABSENT'); process.exit(1); }
console.log(`relevé du ${String(r.calculeLe).slice(0, 16).replace('T', ' ')} : ${r.clubs} clubs, ${r.championnats} championnats`);

const exemples = Object.entries(r.elan).slice(0, 3);
for (const [club, e] of exemples)
  console.log(`   ${club.padEnd(26)} élan attaque ${e.attaque.toFixed(2).padStart(6)}  défense ${e.defense.toFixed(2).padStart(6)}`);

console.log('\nAvantage du terrain, quelques championnats :');
for (const [l, v] of Object.entries(r.terrain).slice(0, 6)) console.log(`   ligue ${l.padEnd(5)} ${(v as number).toFixed(3)}`);

console.log('\nCorrection sortie pour des cas réels :');
for (const [a, b, lig] of [['Real Madrid', 'Rayo Vallecano', 140], ['Manchester United', 'Manchester City', 39], ['Club inconnu XYZ', 'Autre inconnu', 39]] as [string, string, number][]) {
  const c = correctionElanTerrain(r, a, b, lig);
  console.log(`   ${a} — ${b} : ${c ? `domicile ${c.domicile.toFixed(3)}  extérieur ${c.exterieur.toFixed(3)}` : 'AUCUNE (calcul inchangé)'}`);
}
