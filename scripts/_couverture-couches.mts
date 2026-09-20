// Lecture seule : sur les matchs à venir, quelle part profite de chaque couche ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { coucheDesAbsences, LIGUES_DES_ABSENCES, CINQ_GRANDS } = await import('../src/lib/forces-absences.js');
const { lireEntraineurs, partDeLEntraineurNeuf } = await import('../src/lib/entraineurs.js');
const { avisDuMarchePour } = await import('../src/lib/couche-marche.js');
const cle = process.env.API_FOOTBALL_KEY!;
const entraineurs = await lireEntraineurs();
const bilan: Record<string, number[]> = {};
for (let d = 0; d <= 2; d++) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const j: any = await (await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': cle } })).json();
  for (const f of j.response ?? []) {
    const ligue = Number(f?.league?.id);
    if (!LIGUES_DES_ABSENCES.has(ligue)) continue;
    if (Date.parse(f?.fixture?.date) < Date.now()) continue;
    const groupe = CINQ_GRANDS.has(ligue) ? 'cinq grands' : 'onze autres';
    const couche = await coucheDesAbsences(
      f.fixture.id, ligue, f.league.season, f.teams.home.id, f.teams.away.id,
      partDeLEntraineurNeuf(entraineurs, ligue, f.teams.home.id, f.fixture.date),
      partDeLEntraineurNeuf(entraineurs, ligue, f.teams.away.id, f.fixture.date)
    );
    const marche = await avisDuMarchePour(f.fixture.id, f.fixture.date, ligue);
    const v = bilan[groupe] ?? [0, 0, 0];
    v[0]++;
    if (couche) v[1]++;
    if (marche) v[2]++;
    bilan[groupe] = v;
  }
}
for (const [g, v] of Object.entries(bilan)) {
  console.log(`${g.padEnd(14)} ${v[0]} matchs à venir · couche absents/entraîneur ${v[1]} (${Math.round((100 * v[1]) / v[0])} %) · cote du marché ${v[2]} (${Math.round((100 * v[2]) / v[0])} %)`);
}
