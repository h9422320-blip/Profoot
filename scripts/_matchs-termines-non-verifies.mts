// Lecture seule : rencontres TERMINÉES chez le fournisseur dont des analyses attendent encore leur vérification.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { apiFootball } = await import('../src/lib/api-football.js');
const sb = createAdminClient();
const lignes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('analysis_history').select('fixture_id, team1_name, team2_name, created_at')
    .is('verified_at', null).lt('created_at', new Date(Date.now() - 2 * 3600e3).toISOString())
    .order('created_at', { ascending: false }).range(de, de + 999);
  if (error) throw error;
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const ids = [...new Set(lignes.map((l) => l.fixture_id).filter(Boolean).map(String))];
console.log(`analyses en attente : ${lignes.length} · rencontres distinctes : ${ids.length} · sans identifiant : ${lignes.filter((l) => !l.fixture_id).length}`);
const termines: string[] = [];
for (let i = 0; i < ids.length; i += 20) {
  const d = await apiFootball<any>(`/fixtures?ids=${ids.slice(i, i + 20).join('-')}`, 60_000);
  for (const f of d?.response ?? []) if (['FT', 'AET', 'PEN'].includes(f.fixture.status.short)) {
    const n = lignes.filter((l) => String(l.fixture_id) === String(f.fixture.id)).length;
    termines.push(`${f.fixture.date.slice(0, 16)} ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} (${f.league.name}) · ${n} analyse(s) · id ${f.fixture.id}`);
  }
}
console.log(`TERMINÉES mais non vérifiées : ${termines.length}`);
for (const t of termines.sort().reverse()) console.log('  ' + t);
