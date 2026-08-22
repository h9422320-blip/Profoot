import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const lire = async (statut) => {
  const t0 = Date.now();
  const out = [];
  let url = `https://api.chariow.com/v1/sales?per_page=100&status=${statut}`;
  let pages = 0;
  for (let p = 0; p < 60 && url; p++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.log(`  ${statut} : HTTP ${r.status}`); return null; }
    if (Array.isArray(d?.data)) out.push(...d.data);
    pages++;
    let s = d?.pagination?.next_page_url ?? null;
    if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); u.searchParams.set('status', statut); s = u.toString(); }
    url = s;
  }
  const autres = new Set(out.map((v) => v.status).filter((s) => s !== statut));
  const total = out.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0);
  console.log(`  status=${statut.padEnd(18)} ${String(out.length).padStart(4)} vente(s)  ${String(total).padStart(8)} FCFA  ${pages} requête(s)  ${Date.now() - t0} ms${autres.size ? `  ⚠ contient aussi : ${[...autres].join(',')}` : ''}`);
  return out;
};
console.log('');
const c = await lire('completed');
const s = await lire('settled');
if (c && s) {
  const tout = [...c, ...s];
  const ids = new Set(tout.map((v) => v.id));
  const total = tout.reduce((a, v) => a + Number(v.amount?.value ?? 0), 0);
  const jourDe = (v) => String(v.completed_at ?? v.created_at).slice(0, 10);
  const p = tout.filter((v) => jourDe(v) >= '2026-08-16' && jourDe(v) <= '2026-08-22');
  console.log(`\n  Réunion : ${tout.length} ventes (${ids.size} identifiants distincts) — total ${total} FCFA`);
  console.log(`  16→22 août : ${p.length} ventes, ${p.reduce((a, v) => a + Number(v.amount?.value ?? 0), 0)} FCFA\n`);
}
