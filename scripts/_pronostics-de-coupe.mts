// Lecture seule : les pronostics figés des coupes d'Europe à venir.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('predictions_match')
  .select('fixture_id, domicile_nom, exterieur_nom, buts_domicile, buts_exterieur, proba_domicile, proba_nul, proba_exterieur, confiance, competition, date_match, calculee_le')
  .gte('date_match', new Date().toISOString()).lte('date_match', new Date(Date.now() + 3 * 86400000).toISOString()).order('date_match').limit(500);
for (const p of data ?? [])
  if (/champions|europa|conference/i.test(String(p.competition)))
    console.log(`${String(p.date_match).slice(0, 16)} ${p.domicile_nom} ${p.buts_domicile}-${p.buts_exterieur} ${p.exterieur_nom} · ${p.proba_domicile}/${p.proba_nul}/${p.proba_exterieur} · confiance ${p.confiance} · figé ${String(p.calculee_le).slice(0, 16)}`);
