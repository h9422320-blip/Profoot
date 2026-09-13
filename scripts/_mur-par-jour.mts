import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data } = await sb
  .from('preuves')
  .select('date_match, issue_correcte, publiee')
  .gte('date_match', '2026-08-25T00:00:00Z')
  .limit(2000);

const parJour = new Map<string, { n: number; justes: number; publiees: number }>();
for (const p of (data ?? []) as any[]) {
  const j = String(p.date_match).slice(0, 10);
  const v = parJour.get(j) ?? { n: 0, justes: 0, publiees: 0 };
  v.n++; if (p.issue_correcte) { v.justes++; if (p.publiee) v.publiees++; }
  parJour.set(j, v);
}
console.log('── LE MUR, JOUR PAR JOUR (cartes / justes / publiées)');
for (const [j, v] of [...parJour].sort())
  console.log(`   ${j}   ${String(v.n).padStart(3)} cartes   ${String(v.justes).padStart(3)} justes   ${String(v.publiees).padStart(3)} publiées`);

// Combien d'analyses attendent encore, et leurs matchs sont-ils déjà jouables ?
const { count } = await sb
  .from('analysis_history')
  .select('id', { count: 'exact', head: true })
  .is('verified_at', null);
const { data: vieilles } = await sb
  .from('analysis_history')
  .select('created_at')
  .is('verified_at', null)
  .lt('created_at', '2026-09-12T00:00:00Z')
  .limit(1000);
console.log(`\n${count} analyse(s) en attente au total, dont ${vieilles?.length ?? 0} créées avant le 12 septembre.`);
