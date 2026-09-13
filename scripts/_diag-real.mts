import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb
  .from('analysis_history')
  .select('id, team1_name, team2_name, fixture_id, score, created_at, verified_at, real_score, winner_correct')
  .or('team1_name.ilike.%Rayo%,team2_name.ilike.%Rayo%')
  .gte('created_at', '2026-09-11T00:00:00Z')
  .order('created_at', { ascending: true })
  .limit(20);
console.log(`analyses impliquant le Rayo depuis le 11 septembre : ${data?.length ?? 0}\n`);
for (const a of data ?? [])
  console.log(
    `  ${String(a.created_at).slice(0, 16)} | ${a.team1_name} — ${a.team2_name} | annoncé ${a.score}` +
      ` | fixture ${a.fixture_id ?? 'AUCUN'} | vérifiée ${a.verified_at ? String(a.verified_at).slice(0, 16) : 'NON'}` +
      ` | réel ${a.real_score ?? '—'} | juste ${a.winner_correct ?? '—'}`
  );
console.log('\nRappel : la vraie rencontre du 12/09 à 19 h est la fixture 1570379 (Real Madrid 4 - 1 Rayo Vallecano).');
