import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const CLE = env.API_FOOTBALL_KEY;
const api = async (c) => (await fetch(`https://v3.football.api-sports.io${c}`, { headers: { 'x-apisports-key': CLE }, cache: 'no-store' })).json();

// Real Madrid = 541, Espanyol = 540
const j = await api('/fixtures?h2h=541-540&last=3');
console.log('\n  Dernières rencontres Real Madrid — Espanyol :\n');
for (const f of j?.response ?? [])
  console.log(`  ${f.fixture.id}  ${String(f.fixture.date).slice(0,16)}  ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name}  [${f.fixture.status.short} ${f.fixture.status.elapsed ?? ''}]`);

const live = await api('/fixtures?live=all&team=541');
console.log(`\n  Real Madrid en direct maintenant : ${live?.response?.length ? 'OUI' : 'non'}`);
for (const f of live?.response ?? [])
  console.log(`     ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} [${f.fixture.status.short} ${f.fixture.status.elapsed}']`);
console.log('');
