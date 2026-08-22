import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const CLE = env.CHARIOW_API_KEY;
let url = 'https://api.chariow.com/v1/sales?per_page=100';
const tout = [];
for (let p = 0; p < 60 && url; p++) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${CLE}`, Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  const lot = Array.isArray(d?.data) ? d.data : [];
  tout.push(...lot);
  let suite = d?.pagination?.next_page_url ?? null;
  if (suite) { const u = new URL(suite); u.searchParams.set('per_page', '100'); suite = u.toString(); }
  if (p < 4 || !suite) {
    const dates = lot.map((v) => String(v.created_at).slice(0, 10)).sort();
    console.log(`  page ${p + 1} : ${String(lot.length).padStart(3)} vente(s)  du ${dates[0]} au ${dates[dates.length - 1]}`);
  }
  url = suite;
}
const dates = tout.map((v) => String(v.created_at).slice(0, 10)).sort();
console.log(`\n  ${tout.length} vente(s) au total, du ${dates[0]} au ${dates[dates.length - 1]}\n`);
