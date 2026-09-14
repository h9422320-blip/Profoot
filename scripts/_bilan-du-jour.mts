/**
 * LE BILAN D'UNE JOURNÉE DE MATCHS : combien analysés, combien justes.
 *
 *   npx tsx scripts/_bilan-du-jour.mts 2026-09-13
 *
 * ── UNE PRÉCISION QUI CHANGE TOUT ─────────────────────────────────────────
 *
 * On compte les RENCONTRES JOUÉES ce jour-là, pas les analyses écrites ce
 * jour-là. Une analyse du 12 peut porter sur un match du 13, et l'inverse
 * arrive aussi. `analysis_history` ne porte pas la date du match : seule la
 * table `preuves` la connaît, parce qu'elle est construite à partir de la
 * fiche de la rencontre chez le fournisseur.
 *
 * Lecture seule.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jour = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const lendemain = new Date(Date.parse(`${jour}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

console.log('════════════════════════════════════════════════════════════════');
console.log(`  BILAN DES MATCHS DU ${jour}`);
console.log('════════════════════════════════════════════════════════════════\n');

const { data: preuves, error } = await sb
  .from('preuves')
  .select('date_match, team1_name, team2_name, prono_score, score_reel, issue_correcte, score_exact, publiee, competition')
  .gte('date_match', `${jour}T00:00:00Z`)
  .lt('date_match', `${lendemain}T00:00:00Z`)
  .order('date_match', { ascending: true });
if (error) throw new Error(error.message);

const P = (preuves ?? []) as any[];
const justes = P.filter((p) => p.issue_correcte);
const rates = P.filter((p) => !p.issue_correcte);
const exacts = P.filter((p) => p.score_exact);

console.log(`── ${P.length} RENCONTRES ANALYSÉES ET CONFRONTÉES AU RÉSULTAT\n`);

console.log(`── LES ${justes.length} RÉUSSITES (bon vainqueur annoncé)`);
for (const p of justes)
  console.log(
    `   ${p.team1_name} — ${p.team2_name}`.padEnd(48) +
      `annoncé ${String(p.prono_score).padEnd(8)} réel ${String(p.score_reel).padEnd(8)}` +
      (p.score_exact ? '  ★ SCORE EXACT' : '')
  );

console.log(`\n── LES ${rates.length} RATÉS`);
for (const p of rates)
  console.log(
    `   ${p.team1_name} — ${p.team2_name}`.padEnd(48) +
      `annoncé ${String(p.prono_score).padEnd(8)} réel ${String(p.score_reel).padEnd(8)}`
  );

const part = P.length ? (justes.length / P.length) * 100 : 0;
console.log('\n════════════════════════════════════════════════════════════════');
console.log(`  ${P.length} matchs analysés   ·   ${justes.length} réussites   ·   ${rates.length} ratés`);
console.log(`  ${part.toFixed(1)} % de vainqueurs justes   ·   ${exacts.length} score(s) exact(s)`);
console.log('════════════════════════════════════════════════════════════════');

// ── Ce que les abonnés ont réellement analysé ce jour-là ──────────────────
const lignes: any[] = [];
for (let de = 0; de < 8000; de += 1000) {
  const { data } = await sb
    .from('analysis_history')
    .select('user_id, team1_name, team2_name')
    .gte('created_at', `${jour}T00:00:00Z`)
    .lt('created_at', `${lendemain}T00:00:00Z`)
    .range(de, de + 999);
  if (!data?.length) break;
  lignes.push(...data);
  if (data.length < 1000) break;
}
const rencontres = new Set(lignes.map((l) => [l.team1_name, l.team2_name].sort().join(' · ')));
console.log(
  `\n  Ce jour-là, les abonnés ont lancé ${lignes.length} analyses sur ${rencontres.size} rencontres ` +
    `distinctes, par ${new Set(lignes.map((l) => l.user_id)).size} personnes.`
);

// ── Reste-t-il des matchs du jour non confrontés ? ───────────────────────
const { count } = await sb
  .from('analysis_history')
  .select('id', { count: 'exact', head: true })
  .is('verified_at', null)
  .gte('created_at', `${jour}T00:00:00Z`)
  .lt('created_at', `${lendemain}T00:00:00Z`);
console.log(`  Analyses de ce jour encore en attente de résultat : ${count ?? 0}`);
