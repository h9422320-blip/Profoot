// Relève les compétitions de sélections nationales chez le fournisseur, avec leurs saisons.
import { chargerEnv } from './commun.mjs';
chargerEnv();
const cle = process.env.API_FOOTBALL_KEY!;
const r: any = await (await fetch('https://v3.football.api-sports.io/leagues?type=cup', { headers: { 'x-apisports-key': cle } })).json();
const toutes = (r.response ?? []).filter((x: any) => String(x.country?.name) === 'World');
const garder = toutes.filter((x: any) =>
  /World Cup|Euro Championship|Nations League|Africa Cup of Nations|Asian Cup|Copa America|Gold Cup|Friendlies|Qualification|CONCACAF|OFC|Arab|Gulf|COSAFA|WAFU|CECAFA|African Nations Championship|Intercontinental|Confederations|Finalissima/i.test(String(x.league?.name))
  && !/Women|U1\d|U2\d|U-\d|Youth|Olympic|Clubs|Club|Beach|Futsal|Champions League|Leagues Cup|Libertadores|Sudamericana|Recopa|CAF Champions|Confederation Cup$|Super Cup/i.test(String(x.league?.name))
);
for (const x of garder.sort((a: any, b: any) => a.league.id - b.league.id)) {
  const saisons = (x.seasons ?? []).map((s: any) => s.year).filter((y: number) => y >= 2014);
  console.log(String(x.league.id).padStart(5), x.league.name.padEnd(52), saisons.join(','));
}
console.log(garder.length, 'compétitions retenues sur', toutes.length);
