import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const out = [];
for (const st of ['completed', 'settled']) {
  let url = `https://api.chariow.com/v1/sales?per_page=100&status=${st}`;
  for (let p = 0; p < 60 && url; p++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}`, Accept: 'application/json' } });
    const d = await r.json().catch(() => ({}));
    if (Array.isArray(d?.data)) out.push(...d.data);
    let s = d?.pagination?.next_page_url ?? null;
    if (s) { const u = new URL(s); u.searchParams.set('per_page', '100'); u.searchParams.set('status', st); s = u.toString(); }
    url = s;
  }
}
const duJour = out.filter((v) => String(v.completed_at ?? v.created_at).slice(0, 10) === '2026-08-22')
  .sort((a, b) => String(a.completed_at ?? a.created_at).localeCompare(String(b.completed_at ?? b.created_at)));
console.log(`\n  ${duJour.length} vente(s) encaissée(s) aujourd'hui, du plus ancien au plus récent :\n`);
for (const v of duJour) {
  const h = String(v.completed_at ?? v.created_at).slice(11, 16);
  console.log(`  ${h} UTC  ${String(v.amount?.value).padStart(6)} FCFA  ${String(v.product?.name ?? '').slice(0, 34).padEnd(35)} ${v.customer?.email ?? ''}`);
}
const apres = duJour.filter((v) => String(v.completed_at ?? v.created_at).slice(11, 16) > '12:17');
console.log(`\n  Encaissées APRÈS 12 h 17 UTC (heure de la capture) : ${apres.length} vente(s), ${apres.reduce((s, v) => s + Number(v.amount?.value ?? 0), 0)} FCFA\n`);
