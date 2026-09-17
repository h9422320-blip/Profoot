// Lecture seule : quand les vérifications ont-elles eu lieu (par heure, sur deux jours).
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data, error } = await sb.from('analysis_history').select('verified_at').not('verified_at', 'is', null)
  .gte('verified_at', new Date(Date.now() - 48 * 3600e3).toISOString()).order('verified_at', { ascending: false }).limit(1000);
if (error) throw error;
const h = new Map<string, number>();
for (const l of data ?? []) { const k = String(l.verified_at).slice(0, 13); h.set(k, (h.get(k) ?? 0) + 1); }
console.log('maintenant', new Date().toISOString());
for (const [k, n] of h) console.log(k, n);
