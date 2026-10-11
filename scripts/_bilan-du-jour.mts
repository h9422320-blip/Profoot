/**
 * LE BILAN D'UNE JOURNÉE : ce que l'application a analysé, et ce qu'on en sait.
 *
 *   npx tsx scripts/_bilan-du-jour.mts 2026-10-10
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const jour = process.argv[2] ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const lendemain = new Date(Date.parse(jour) + 86_400_000).toISOString().slice(0, 10);

const lignes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('analysis_history')
    .select('id, user_id, fixture_id, team1_name, team2_name, competition, score, predicted_winner, real_score, winner_correct, score_correct, verified_at, created_at')
    .gte('created_at', jour).lt('created_at', lendemain)
    .order('id', { ascending: true }).range(de, de + 999);
  if (error) throw new Error(error.message);
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const parMatch = new Map<string, any>();
for (const a of lignes) {
  const c = a.fixture_id ? `f${a.fixture_id}` : `${a.team1_name}|${a.team2_name}`;
  const m = parMatch.get(c) ?? { ...a, n: 0, v: 0, justes: 0, exacts: 0, clients: new Set<string>() };
  m.n++;
  m.clients.add(String(a.user_id));
  if (a.verified_at) { m.v++; m.real_score = a.real_score; if (a.winner_correct) m.justes++; if (a.score_correct) m.exacts++; }
  parMatch.set(c, m);
}
const matchs = [...parMatch.values()];
const juges = matchs.filter((m) => m.v > 0);
const justes = juges.filter((m) => m.justes > 0);
const exacts = juges.filter((m) => m.exacts > 0);
const clients = new Set(lignes.map((l) => String(l.user_id)));

console.log(`\n═══ BILAN DU ${jour} ═══\n`);
console.log(`  analyses lancées        : ${lignes.length}`);
console.log(`  rencontres distinctes   : ${matchs.length}`);
console.log(`  abonnés qui ont analysé : ${clients.size}`);
console.log(`\n  rencontres confrontées à leur résultat : ${juges.length} sur ${matchs.length}`);
if (juges.length) {
  console.log(`     vainqueur trouvé : ${justes.length}  (${((100 * justes.length) / juges.length).toFixed(1)} %)`);
  console.log(`     score exact      : ${exacts.length}`);
}
if (juges.length < matchs.length)
  console.log(`  ⚠️ ${matchs.length - juges.length} rencontre(s) SANS RÉSULTAT : le fournisseur de données est inaccessible.`);

const parComp = new Map<string, { n: number; m: number }>();
for (const m of matchs) {
  const c = String(m.competition ?? 'inconnue');
  const d = parComp.get(c) ?? { n: 0, m: 0 };
  d.n += m.n; d.m++;
  parComp.set(c, d);
}
console.log(`\n  PAR COMPÉTITION :`);
for (const [c, d] of [...parComp.entries()].sort((a, b) => b[1].n - a[1].n))
  console.log(`     ${String(c).slice(0, 34).padEnd(36)} ${String(d.m).padStart(3)} rencontre(s) · ${String(d.n).padStart(4)} analyses`);

console.log(`\n  LES PLUS ANALYSÉES :`);
for (const m of matchs.sort((a, b) => b.n - a.n).slice(0, 15)) {
  const verdict = m.v === 0 ? 'en attente du résultat' : m.justes > 0 ? `JUSTE (réel ${m.real_score})${m.exacts > 0 ? ' · SCORE EXACT' : ''}` : `raté (réel ${m.real_score})`;
  console.log(`     ${String(m.n).padStart(3)} × ${(m.team1_name + ' — ' + m.team2_name).slice(0, 42).padEnd(44)} annoncé ${String(m.score).padEnd(7)} ${verdict}`);
}
