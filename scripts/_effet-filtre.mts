/** Ce que le filtre par numero ajoute et retire, sur une semaine reelle. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { CHAMPIONNATS, competitionRetenue } = await import('../src/lib/precalcul-selection.js');
const CLE = process.env.API_FOOTBALL_KEY!;
const avant = new Map<string, {n:number;pays:string;nom:string;id:number}>();
const apres = new Map<string, {n:number;pays:string;nom:string;id:number}>();
for (let d = 0; d < 7; d++) {
  const jour = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': CLE }, cache: 'no-store' });
  const j = await r.json();
  for (const f of j?.response ?? []) {
    const nom = String(f?.league?.name ?? ''), id = Number(f?.league?.id), pays = String(f?.league?.country ?? '');
    const cle = String(id);
    if (CHAMPIONNATS.includes(nom)) { const c = avant.get(cle) ?? {n:0,pays,nom,id}; c.n++; avant.set(cle,c); }
    if (competitionRetenue(f?.league)) { const c = apres.get(cle) ?? {n:0,pays,nom,id}; c.n++; apres.set(cle,c); }
  }
}
const somme = (m: Map<string, any>) => [...m.values()].reduce((s, c) => s + c.n, 0);
console.log('=== RETIRÉ (homonymes jamais appris) ===');
for (const [k, c] of [...avant].filter(([k]) => !apres.has(k)).sort((a,b)=>b[1].n-a[1].n))
  console.log(`  ${String(c.n).padStart(3)}  id ${String(c.id).padStart(4)}  ${c.nom.padEnd(24)} ${c.pays}`);
console.log('\n=== AJOUTÉ (apprises, jamais nommées) ===');
for (const [k, c] of [...apres].filter(([k]) => !avant.has(k)).sort((a,b)=>b[1].n-a[1].n))
  console.log(`  ${String(c.n).padStart(3)}  id ${String(c.id).padStart(4)}  ${c.nom.padEnd(24)} ${c.pays}`);
console.log(`\navant : ${somme(avant)} rencontres, ${avant.size} competitions`);
console.log(`apres : ${somme(apres)} rencontres, ${apres.size} competitions`);
