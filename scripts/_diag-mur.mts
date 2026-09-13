import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

// 1. Le mur, par date de match.
const { data: preuves } = await sb
  .from('preuves')
  .select('date_match, team1_name, team2_name, prono_score, score_reel, issue_correcte, publiee')
  .gte('date_match', '2026-09-09')
  .order('date_match', { ascending: false })
  .limit(60);
console.log(`── MUR PUBLIC, depuis le 9 septembre : ${preuves?.length ?? 0} preuve(s)`);
for (const p of preuves ?? [])
  console.log(`   ${String(p.date_match).slice(0, 10)}  ${p.team1_name} — ${p.team2_name}  annoncé ${p.prono_score}  réel ${p.score_reel}  juste ${p.issue_correcte}  publiée ${p.publiee}`);

// 2. Les analyses du 12 septembre.
const { data: analyses } = await sb
  .from('analysis_history')
  .select('team1_name, team2_name, competition, score, real_score, winner_correct, score_correct, verified_at, created_at, fixture_id')
  .gte('created_at', '2026-09-12T00:00:00Z')
  .lt('created_at', '2026-09-13T00:00:00Z')
  .limit(500);
const total = analyses?.length ?? 0;
const verifiees = (analyses ?? []).filter((a: any) => a.verified_at);
const justes = verifiees.filter((a: any) => a.winner_correct);
console.log(`\n── ANALYSES DU 12 SEPTEMBRE : ${total}`);
console.log(`   vérifiées : ${verifiees.length} — dont vainqueur juste : ${justes.length}`);

// 3. Les rencontres distinctes analysées ce jour-là.
const parMatch = new Map<string, any>();
for (const a of analyses ?? []) {
  const cle = `${a.team1_name} — ${a.team2_name}`;
  const v = parMatch.get(cle) ?? { n: 0, verifiee: 0, juste: 0, score: a.score, reel: a.real_score };
  v.n++;
  if (a.verified_at) { v.verifiee++; v.reel = a.real_score; v.juste += a.winner_correct ? 1 : 0; }
  parMatch.set(cle, v);
}
console.log(`\n── LES ${parMatch.size} RENCONTRES ANALYSÉES LE 12 SEPTEMBRE`);
for (const [cle, v] of [...parMatch].sort((a, b) => b[1].n - a[1].n))
  console.log(`   ${cle.padEnd(46)} ${String(v.n).padStart(3)} analyse(s) | vérifiées ${v.verifiee} | justes ${v.juste} | annoncé ${v.score ?? '—'} | réel ${v.reel ?? '—'}`);
