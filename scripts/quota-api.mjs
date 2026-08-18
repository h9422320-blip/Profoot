import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const r = await fetch('https://v3.football.api-sports.io/status', {
  headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
});
const j = await r.json();
const s = j?.response?.requests ?? {};
console.log(`Appels du jour : ${s.current} / ${s.limit_day}`);
console.log(`Restants       : ${(s.limit_day ?? 0) - (s.current ?? 0)}`);
console.log(`Abonnement     : ${j?.response?.subscription?.plan}`);
