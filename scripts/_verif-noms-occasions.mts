// LECTURE SEULE : sur les affiches à venir des cinq grands, les occasions sont-elles trouvées ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { lireForces, butsAttendusOccasions } = await import('../src/lib/forme-occasions.js');
const { clubs } = await import('../src/lib/data.js');
const releve: any = await lireForces();
const cle = process.env.API_FOOTBALL_KEY!;
const catalogueParApi = new Map<number, string>();
for (const c of Object.values(clubs as any) as any[]) {
  const m = String(c.logo ?? '').match(/teams\/(\d+)\.png/);
  if (m) catalogueParApi.set(Number(m[1]), c.name);
}
let n = 0, avant = 0, apres = 0;
for (const l of [39, 140, 135, 78, 61]) {
  const j: any = await (await fetch(`https://v3.football.api-sports.io/fixtures?league=${l}&next=10`, { headers: { 'x-apisports-key': cle } })).json();
  for (const f of j.response ?? []) {
    n++;
    const cD = catalogueParApi.get(f.teams.home.id) ?? f.teams.home.name;
    const cE = catalogueParApi.get(f.teams.away.id) ?? f.teams.away.name;
    if (butsAttendusOccasions(releve, cD, cE)) avant++;
    if (butsAttendusOccasions(releve, f.teams.home.name, f.teams.away.name)) apres++;
  }
}
console.log(`${n} affiches à venir des cinq grands · occasions trouvées avec le nom du catalogue : ${avant} · avec le nom du fournisseur : ${apres}`);
