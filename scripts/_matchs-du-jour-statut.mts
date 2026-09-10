import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { competitionRetenue } = await import('../src/lib/precalcul-selection.js');
const jour = new Date().toISOString().slice(0, 10);
const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! }, cache: 'no-store' });
const j = await r.json();
const nos = (j?.response ?? []).filter((f: any) => competitionRetenue(f?.league));
const par = new Map<string, number>();
for (const f of nos) par.set(f.fixture.status.short, (par.get(f.fixture.status.short) ?? 0) + 1);
console.log(`${nos.length} rencontres du jour dans nos competitions : ` + [...par].map(([k, v]) => `${k}=${v}`).join(', '));
for (const f of nos.filter((f: any) => f.league.id === 2 || ['FT','AET','PEN'].includes(f.fixture.status.short)).slice(0, 30))
  console.log(`  ${f.fixture.status.short.padEnd(4)} ${String(f.fixture.date).slice(11,16)}  ${String(f.league.name).slice(0,22).padEnd(23)} ${f.teams.home.name} ${f.goals.home ?? '-'}-${f.goals.away ?? '-'} ${f.teams.away.name}`);
