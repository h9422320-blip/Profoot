import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { lireForces } = await import('../src/lib/forme-occasions.js');
const K = process.env.API_FOOTBALL_KEY!;
const releve: any = await lireForces();
const normaliser = (s: string) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const index = new Set(Object.keys(releve?.clubs ?? {}).map(normaliser));

// Les rencontres des trois coupes d Europe des soixante prochains jours :
// c est la phase de ligue, celle que les abonnes regardent.
const manquants = new Map<string, { n: number; coupes: Set<string> }>();
let total = 0, couverts = 0;
for (const [id, coupe] of [[2, 'C1'], [3, 'C3'], [848, 'C4']] as [number, string][]) {
  const de = new Date().toISOString().slice(0, 10);
  const a = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?league=${id}&season=2026&from=${de}&to=${a}`, { headers: { 'x-apisports-key': K }, cache: 'no-store' });
  const j = await r.json();
  for (const f of j?.response ?? []) {
    total++;
    const d = String(f?.teams?.home?.name ?? ''), e = String(f?.teams?.away?.name ?? '');
    const okD = index.has(normaliser(d)), okE = index.has(normaliser(e));
    if (okD && okE) couverts++;
    for (const [nom, ok] of [[d, okD], [e, okE]] as [string, boolean][]) {
      if (ok) continue;
      const c = manquants.get(nom) ?? { n: 0, coupes: new Set<string>() };
      c.n++; c.coupes.add(coupe); manquants.set(nom, c);
    }
  }
}
console.log(`${couverts} / ${total} rencontres de coupe d Europe des 60 prochains jours eclairees (${((100 * couverts) / Math.max(1, total)).toFixed(1)} %)\n`);
console.log(`${manquants.size} clubs manquants, par nombre de rencontres concernees :`);
for (const [nom, c] of [...manquants.entries()].sort((a, b) => b[1].n - a[1].n))
  console.log(`   ${String(c.n).padStart(2)} match(s)  ${nom}  [${[...c.coupes].join(' ')}]`);
