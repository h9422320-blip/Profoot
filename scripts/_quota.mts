import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const cle = process.env.API_FOOTBALL_KEY!;
const r = await fetch('https://v3.football.api-sports.io/status', { headers: { 'x-apisports-key': cle }, cache: 'no-store' });
const j = await r.json();
console.log(JSON.stringify(j?.response?.requests ?? j, null, 1));
console.log('abonnement : ' + JSON.stringify(j?.response?.subscription ?? null));
