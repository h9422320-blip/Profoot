import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}));
const K = env.API_FOOTBALL_KEY;
const appel = async (p) => (await (await fetch('https://v3.football.api-sports.io'+p, { headers: { 'x-apisports-key': K } })).json());

const fx = await appel('/fixtures?league=39&season=2025&round=Regular Season - 20');
const id = fx.response?.[0]?.fixture?.id;
console.log(`Match temoin ${id} : ${fx.response?.[0]?.teams?.home?.name} vs ${fx.response?.[0]?.teams?.away?.name}`);

const st = await appel(`/fixtures/statistics?fixture=${id}`);
console.log(`\nEquipes renvoyees : ${st.response?.length ?? 0}`);
for (const e of st.response ?? []) {
  console.log(`\n  ${e.team?.name} :`);
  for (const s of e.statistics ?? []) console.log(`    ${String(s.type).padEnd(26)} ${s.value}`);
}
