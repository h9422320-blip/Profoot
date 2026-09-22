// Relève chez le fournisseur les divisions inférieures et les coupes nationales des grands pays.
import { chargerEnv } from './commun.mjs';
chargerEnv();
const cle = process.env.API_FOOTBALL_KEY!;
for (const pays of ['England', 'Spain', 'Italy', 'Germany', 'France', 'Portugal', 'Netherlands', 'Belgium', 'Scotland', 'Turkey']) {
  const r: any = await (await fetch(`https://v3.football.api-sports.io/leagues?country=${pays}`, { headers: { 'x-apisports-key': cle } })).json();
  const garder = (r.response ?? []).filter((x: any) => {
    const saisons = (x.seasons ?? []).map((s: any) => s.year);
    return saisons.includes(2025) && !/Women|Femin|U1\d|U2\d|Youth|Primavera|Reserve|Premier League 2|Professional Development|Frauen|Féminine|Juvenil|Division 2 Féminine|Friendlies/i.test(x.league.name);
  });
  console.log(`\n${pays} :`, garder.map((x: any) => `${x.league.id} ${x.league.name} (${x.league.type})`).join(' · '));
}
