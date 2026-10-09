/**
 * CE QUI ATTEND LE RÉTABLISSEMENT DE L'ABONNEMENT.
 *
 * Chaque rencontre analysée dont le résultat n'a jamais pu être lu : elle ne
 * peut ni être jugée, ni entrer sur le mur public. La liste dit ce que la
 * coupure retient.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data: an } = await sb.from('analysis_history')
  .select('fixture_id, team1_name, team2_name, competition, score, predicted_winner, created_at')
  .is('verified_at', null).not('fixture_id', 'is', null)
  .gte('created_at', '2026-10-05').limit(2000);

const parMatch = new Map<string, any>();
for (const a of an ?? []) {
  const c = String(a.fixture_id);
  const m = parMatch.get(c) ?? { ...a, n: 0 };
  m.n++;
  parMatch.set(c, m);
}
const liste = [...parMatch.values()].sort((a, b) => b.n - a.n);
const total = liste.reduce((s, m) => s + m.n, 0);
console.log(`${liste.length} rencontres analysées depuis le 5 octobre attendent leur résultat (${total} analyses) :\n`);
const nom = (c: string | null) => String(c ?? '').replace('Africa Cup of Nations - Qualification', 'Qualifs CAN').replace('UEFA Nations League', 'Ligue des nations').slice(0, 26);
for (const m of liste.slice(0, 25)) {
  const gagnant = m.predicted_winner === 'team1' ? m.team1_name : m.predicted_winner === 'team2' ? m.team2_name : 'nul';
  console.log(`  ${String(m.n).padStart(3)} analyses · ${m.team1_name} — ${m.team2_name}`.padEnd(62) + `annoncé : ${String(gagnant).padEnd(18)} ${nom(m.competition)}`);
}
if (liste.length > 25) console.log(`  … et ${liste.length - 25} autres.`);
