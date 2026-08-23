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

const du22 = V.filter((v) => String(v.created_at).slice(0, 10) === '2026-08-22');
const parStatut = new Map();
for (const v of du22) {
  const a = parStatut.get(v.status) ?? { n: 0, xof: 0 };
  a.n++; a.xof += Number(v.amount?.value ?? 0);
  parStatut.set(v.status, a);
}
console.log(`\n  ══ TOUTES LES VENTES DU 22 AOÛT, PAR STATUT ══\n`);
for (const [s, a] of [...parStatut].sort((x, y) => y[1].xof - x[1].xof))
  console.log(`  ${s.padEnd(20)} ${String(a.n).padStart(4)} · ${String(a.xof).padStart(8)} FCFA${['completed','settled'].includes(s) ? '   <- compté' : ''}`);

// Un statut d'annulation apparaîtrait ici.
const suspects = du22.filter((v) => /refund|cancel|charge|dispute|revers/i.test(v.status));
console.log(`\n  Ventes annulées ou remboursées : ${suspects.length}`);
for (const v of suspects) console.log(`     ${v.id}  ${v.amount?.value}  ${v.status}`);
console.log('');
