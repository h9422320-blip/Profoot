// Lecture seule : la hiérarchie des championnats, et qui y manque.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireForcesChampionnats, rapportEntreChampionnats } = await import('../src/lib/forces-championnats.js');
const f: any = await lireForcesChampionnats();
if (!f) { console.log('hiérarchie absente'); process.exit(0); }
const coefs: Map<number, any> = f.ligues ?? f.coefficients ?? new Map();
console.log('championnats connus :', coefs.size ?? Object.keys(coefs).length, '· calculée le', f.calculeeLe ?? f.quand ?? '?');
const cherches: [number, string][] = [[39, 'Premier League'], [140, 'Liga'], [135, 'Serie A'], [78, 'Bundesliga'], [61, 'Ligue 1'], [106, 'Ekstraklasa (Pologne)'], [203, 'Süper Lig (Turquie)'], [88, 'Eredivisie'], [94, 'Primeira'], [271, 'Hongrie'], [119, 'Danemark'], [103, 'Norvège'], [345, 'Tchéquie'], [179, 'Écosse']];
for (const [id, nom] of cherches) {
  const c = coefs instanceof Map ? coefs.get(id) : (coefs as any)[id];
  console.log(`${String(id).padStart(4)} ${nom.padEnd(24)} ${c ? JSON.stringify(c) : 'ABSENT'}`);
}
for (const [a, b] of [[39, 106], [203, 61], [39, 203], [140, 106]] as [number, number][])
  console.log(`rapport ${a} contre ${b} : ${rapportEntreChampionnats(f, a, b)}`);
