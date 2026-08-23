import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const V = [];
let url = 'https://api.chariow.com/v1/sales?per_page=100';
for (let p = 0; p < 30 && url; p++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  if (Array.isArray(d?.data)) V.push(...d.data);
  let s = d?.pagination?.next_page_url ?? null;
  if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); s = u.toString(); }
  url = s;
}
const somme = (l) => l.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
const j = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);

console.log(`\n  ══ DU 16 AU 23 AOÛT, PAR STATUT ══\n`);
const fenetre = V.filter((v) => j(v) >= '2026-08-16' && j(v) <= '2026-08-23');
const parS = new Map();
for (const v of fenetre) {
  const a = parS.get(v.status) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  parS.set(v.status, a);
}
for (const [s, a] of [...parS].sort((x, y) => y[1].xof - x[1].xof))
  console.log(`  ${s.padEnd(20)} ${String(a.n).padStart(4)} · ${String(a.xof).padStart(9)} FCFA`);

console.log(`\n  settled seul                : ${somme(fenetre.filter(v=>v.status==='settled')).toLocaleString('fr-FR')} FCFA`);
console.log(`  settled + completed         : ${somme(fenetre.filter(v=>['settled','completed'].includes(v.status))).toLocaleString('fr-FR')} FCFA`);

console.log(`\n  ══ AUJOURD'HUI (23) PAR STATUT ══\n`);
const auj = V.filter((v) => j(v) === '2026-08-23');
const parA = new Map();
for (const v of auj) {
  const a = parA.get(v.status) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  parA.set(v.status, a);
}
for (const [s, a] of [...parA].sort((x, y) => y[1].xof - x[1].xof))
  console.log(`  ${s.padEnd(20)} ${String(a.n).padStart(4)} · ${String(a.xof).padStart(9)} FCFA`);
console.log('');
