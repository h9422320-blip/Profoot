/** Ce que les vrais visiteurs ont attendu aujourd'hui, page par page. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data: e } = await sb.from('visites_pages').select('*').limit(1);
console.log('colonnes : ' + Object.keys(e?.[0] ?? {}).join(', '));

const depuis = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('visites_pages').select('*').gte('entre_le', depuis).range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`\n${tout.length} visites sur les 6 dernieres heures\n`);
const parPage = new Map<string, number[]>();
for (const v of tout) {
  const p = String(v.chemin ?? v.path ?? '?');
  const d = Number(v.duree_ms ?? v.duree ?? 0);
  if (!parPage.has(p)) parPage.set(p, []);
  if (d > 0) parPage.get(p)!.push(d);
}
const lignes = [...parPage.entries()].map(([p, ds]) => {
  ds.sort((a, b) => a - b);
  return { p, n: ds.length, median: ds[Math.floor(ds.length / 2)] ?? 0, p90: ds[Math.floor(ds.length * 0.9)] ?? 0, max: ds[ds.length - 1] ?? 0 };
}).sort((a, b) => b.p90 - a.p90);
for (const l of lignes.slice(0, 20))
  console.log(`  ${String(l.n).padStart(4)} visites  median ${String(l.median).padStart(6)} ms  p90 ${String(l.p90).padStart(7)} ms  max ${String(l.max).padStart(7)} ms  ${l.p}`);
