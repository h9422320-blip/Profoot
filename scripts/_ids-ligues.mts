import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const K = process.env.API_FOOTBALL_KEY!;
const candidats = [103, 106, 172, 318, 333, 383, 271, 119, 218, 210, 197, 207, 345, 113, 179];
for (const id of candidats) {
  const r = await fetch(`https://v3.football.api-sports.io/leagues?id=${id}`, { headers: { 'x-apisports-key': K }, cache: 'no-store' });
  const j = await r.json();
  const x = j?.response?.[0];
  const saison = (x?.seasons ?? []).find((s: any) => s.current);
  console.log(`${String(id).padStart(4)}  ${String(x?.league?.name ?? '?').padEnd(22)} ${String(x?.country?.name ?? '?').padEnd(14)} saison courante ${saison?.year ?? '?'}  (${saison?.start ?? '?'} -> ${saison?.end ?? '?'})`);
}
