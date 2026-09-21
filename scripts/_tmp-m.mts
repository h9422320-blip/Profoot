import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { matchsDuJour } = await import('../src/lib/grands-matchs-du-jour.js');
const r = await matchsDuJour();
console.log('matchs proposés :', r.matchs.length, '· aujourd’hui :', r.aujourdhui);
for (const m of r.matchs.slice(0, 8)) console.log('  ', m.kickoffISO.slice(0, 16), m.championnat.padEnd(22), m.dom?.name, '—', m.ext?.name, '· fiabilité', m.fiabilite ?? '—');
