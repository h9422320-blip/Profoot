import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { listSalesEncaissees } = await jiti.import('./src/lib/chariow.ts');
const ventes = await listSalesEncaissees();

// Ce que rapportait la meme tranche horaire les jours precedents.
const HEURE_COUPURE = 8;
const maintenant = new Date();
const heureActuelle = maintenant.getUTCHours();

const parJourEtHeure = new Map();
for (const v of ventes) {
  const d = new Date(v.created_at);
  if (Number.isNaN(d.getTime())) continue;
  const jour = d.toISOString().slice(0, 10);
  const h = d.getUTCHours();
  if (h < HEURE_COUPURE || h >= heureActuelle) continue;
  if (!parJourEtHeure.has(jour)) parJourEtHeure.set(jour, { n: 0, xof: 0 });
  const e = parJourEtHeure.get(jour);
  e.n++;
  e.xof += Number(v.amount?.value) || 0;
}

console.log(`\n  Ce que rapportait la tranche ${HEURE_COUPURE}h–${heureActuelle}h UTC, les jours precedents :\n`);
const jours = [...parJourEtHeure].sort().slice(-6);
let total = 0;
for (const [j, e] of jours) {
  console.log(`  ${j}   ${String(e.n).padStart(3)} ventes   ${String(e.xof.toLocaleString('fr-FR')).padStart(9)} FCFA`);
  total += e.xof;
}
if (jours.length) {
  const moyenne = Math.round(total / jours.length);
  console.log(`\n  Moyenne sur ces ${jours.length} jours : ${moyenne.toLocaleString('fr-FR')} FCFA pour cette tranche.`);
  console.log(`  C est l ordre de grandeur de ce que la coupure a deja coute.`);
}
console.log('');
