// Lecture seule : sur les matchs à venir, le total du marché est-il disponible ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { totalDuMarchePour } = await import('../src/lib/couche-marche.js');
const { LIGUES_DES_ABSENCES, CINQ_GRANDS } = await import('../src/lib/forces-absences.js');
const cle = process.env.API_FOOTBALL_KEY ?? '';
const bilan: Record<string, number[]> = {};
for (let d = 0; d <= 3; d++) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': cle } });
  const j: any = await r.json();
  for (const f of j.response ?? []) {
    const ligue = Number(f?.league?.id);
    if (!LIGUES_DES_ABSENCES.has(ligue) || Date.parse(f?.fixture?.date) < Date.now()) continue;
    const t = await totalDuMarchePour(f.fixture.id, f.fixture.date, ligue);
    const g = CINQ_GRANDS.has(ligue) ? 'cinq grands' : 'onze autres';
    const v = bilan[g] ?? [0, 0];
    v[0]++;
    if (t) v[1]++;
    bilan[g] = v;
  }
}
for (const [g, v] of Object.entries(bilan)) {
  console.log(`${g.padEnd(14)} ${v[0]} matchs à venir · total du marché ${v[1]} (${Math.round((100 * v[1]) / v[0])} %)`);
}
