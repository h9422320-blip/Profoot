// Ce que la base sait d'un match : analyses, vérification, et carte de preuve.
//   npx tsx scripts/_preuve-d-un-match.mts <mot du nom d'équipe> [jour AAAA-MM-JJ]
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const mot = process.argv[2] ?? 'barcel';
const jour = process.argv[3];
let q = sb.from('analysis_history')
  .select('fixture_id, team1_name, team2_name, score, real_score, winner_correct, score_correct, verified_at, created_at')
  .or(`team1_name.ilike.%${mot}%,team2_name.ilike.%${mot}%`)
  .order('created_at', { ascending: false }).limit(400);
if (jour) q = q.gte('created_at', `${jour}T00:00:00Z`);
const { data: a, error } = await q;
if (error) throw error;
const parMatch = new Map<string, any[]>();
for (const l of a ?? []) { const k = String(l.fixture_id); parMatch.set(k, [...(parMatch.get(k) ?? []), l]); }
for (const [f, ls] of parMatch) {
  const l = ls[0];
  console.log(`\nfixture ${f} : ${l.team1_name} — ${l.team2_name} · ${ls.length} analyse(s)`);
  const scores = new Map<string, number>(); for (const x of ls) scores.set(x.score, (scores.get(x.score) ?? 0) + 1);
  console.log('  scores annoncés :', [...scores].map(([s, n]) => `${s}×${n}`).join(', '));
  console.log(`  réel ${l.real_score} · vainqueur juste ${l.winner_correct} · exact ${l.score_correct} · vérifié ${l.verified_at}`);
  const { data: p } = await sb.from('preuves').select('*').eq('fixture_id', Number(f)).maybeSingle();
  console.log('  carte :', p ? JSON.stringify({ prono: p.prono_score, reel: p.score_reel, issue_correcte: p.issue_correcte, exact: p.score_exact, publiee: p.publiee, masquee: p.masquee_par_admin, date: p.date_match, maj: p.updated_at }) : 'AUCUNE');
}
