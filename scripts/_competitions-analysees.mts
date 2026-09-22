// LECTURE SEULE : les compétitions que les abonnés analysent, sur 30 jours.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = new Date(Date.now() - 30 * 86400000).toISOString();
const lignes: any[] = [];
for (let de = 0; de < 200_000; de += 1000) {
  let r: any = null;
  for (let e = 1; e <= 4 && !r; e++) {
    const q = await sb.from('analysis_history').select('competition, fixture_id').gte('created_at', depuis).order('created_at').order('id').range(de, de + 999);
    if (!q.error) r = q.data; else await new Promise((t) => setTimeout(t, 2000 * e));
  }
  if (!r) break;
  lignes.push(...r);
  if (r.length < 1000) break;
}
const par = new Map<string, number>();
for (const a of lignes) par.set(String(a.competition ?? '—'), (par.get(String(a.competition ?? '—')) ?? 0) + 1);
console.log(lignes.length, 'analyses sur 30 jours');
for (const [k, n] of [...par].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(String(n).padStart(6), ' ', k);
