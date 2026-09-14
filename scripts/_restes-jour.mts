/** Reste-t-il des rencontres de ce jour non confrontees ?  npx tsx scripts/_restes-jour.mts 2026-09-13 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { apiFootball } = await import('../src/lib/api-football.js');
const sb = createAdminClient();
const JOUR = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const enAttente: any[] = [];
for (let de = 0; de < 6000; de += 1000) {
  const { data } = await sb.from('analysis_history').select('fixture_id, team1_name, team2_name, score')
    .is('verified_at', null).order('created_at', { ascending: false }).range(de, de + 999);
  if (!data?.length) break; enAttente.push(...data); if (data.length < 1000) break;
}
const ids = [...new Set(enAttente.map((a) => a.fixture_id).filter(Boolean).map(String))];
let duJour = 0, lus = 0;
const liste: string[] = [];
for (let i = 0; i < ids.length; i += 20) {
  const d: any = await apiFootball('/fixtures?ids=' + ids.slice(i, i + 20).join('-'), 300).catch(() => null);
  for (const f of d?.response ?? []) {
    lus++;
    if (String(f?.fixture?.date ?? '').slice(0, 10) !== JOUR) continue;
    duJour++;
    liste.push('   #' + f.fixture.id + '  ' + f.teams.home.name + ' — ' + f.teams.away.name + '  statut ' + f.fixture.status.short);
  }
}
console.log(ids.length + ' rencontre(s) en attente, ' + lus + ' lue(s) chez le fournisseur.');
console.log('RENCONTRES DU ' + JOUR + ' ENCORE NON CONFRONTEES : ' + duJour);
for (const l of liste) console.log(l);