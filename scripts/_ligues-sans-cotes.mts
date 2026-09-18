// Lecture seule : parmi nos compétitions, lesquelles n'ont reçu AUCUNE cote ces dix derniers jours ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireCotesDuJourPatiemment } = await import('../src/lib/cotes-marche.js');
const { LEAGUE_IDS } = await import('../src/lib/api-football.js');
const nos = new Map<number, string>();
for (const [nom, id] of Object.entries(LEAGUE_IDS)) nos.set(Number(id), nom);
for (const id of [2, 3, 848, 531]) nos.set(id, nos.get(id) ?? `coupe ${id}`);
const vus = new Map<number, number>();
for (let d = -8; d <= 2; d++) {
  const r = await lireCotesDuJourPatiemment(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10));
  for (const m of r?.matchs ?? []) vus.set(m.ligue, (vus.get(m.ligue) ?? 0) + 1);
}
for (const [id, nom] of nos) if (!vus.has(id)) console.log('SANS COTE :', id, nom);
console.log(`${[...nos.keys()].filter((i) => vus.has(i)).length} compétitions cotées sur ${nos.size}`);
