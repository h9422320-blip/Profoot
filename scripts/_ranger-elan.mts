/** Recalcule l'élan et le terrain depuis les fichiers locaux, et les range. */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS } from './challenger/commun.mjs';
chargerEnv();
const { calculerElanEtTerrain, rangerElanEtTerrain } = await import('../src/lib/elan-et-terrain.js');

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const tirs: any[] = JSON.parse(fs.readFileSync(FICHIER_TIRS, 'utf8'));
const parCle = new Map<string, any>();
for (const t of tirs) parCle.set(`${t.dom} · ${t.ext} · ${String(t.date)}`, t);

const avecOccasions = rencontres.map((m) => {
  const t = parCle.get(`${m.nomDom} · ${m.nomExt} · ${String(Date.parse(m.date))}`);
  return t
    ? { ...m, produitDom: 0.325 * t.cadresD + 0.17 * t.surfaceD, produitExt: 0.325 * t.cadresE + 0.17 * t.surfaceE }
    : m;
});

const releve = calculerElanEtTerrain(avecOccasions);
await rangerElanEtTerrain(releve);
console.log(`rangé : ${releve.clubs} clubs, ${releve.championnats} championnats, sur ${rencontres.length} rencontres`);
