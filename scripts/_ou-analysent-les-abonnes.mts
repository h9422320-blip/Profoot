// Lecture seule : les compétitions des analyses lancées ces 30 derniers jours.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const lignes: any[] = [];
const depuis = new Date(Date.now() - 30 * 86400e3).toISOString();
for (let de = 0; de < 100000; de += 1000) {
  const { data, error } = await sb.from('analysis_history').select('competition').gte('created_at', depuis).range(de, de + 999);
  if (error) throw error;
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const c = new Map<string, number>();
for (const l of lignes) c.set(String(l.competition ?? '—'), (c.get(String(l.competition ?? '—')) ?? 0) + 1);
console.log(`analyses des 30 derniers jours : ${lignes.length}`);
for (const [k, n] of [...c].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(6)}  ${(100 * n / lignes.length).toFixed(1).padStart(5)} %  ${k}`);
