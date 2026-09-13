/**
 * LE MUR DU 12 SEPTEMBRE, VU PAR LA DATE DU MATCH.
 *
 * Le Real Madrid — Rayo Vallecano a été JOUÉ le 12 septembre mais ANALYSÉ le
 * 11. Tout contrôle qui filtre sur `created_at` le rate : c'est exactement
 * l'erreur qui l'a laissé hors du mur. `analysis_history` ne porte pas la date
 * de la rencontre ; seule la table `preuves` la connaît (`date_match`).
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data: preuves, error } = await sb
  .from('preuves')
  .select('date_match, team1_name, team2_name, prono_score, score_reel, issue_correcte, score_exact, publiee, competition')
  .gte('date_match', '2026-09-12T00:00:00Z')
  .lt('date_match', '2026-09-13T00:00:00Z')
  .order('date_match', { ascending: true });
if (error) throw new Error(error.message);

const lignes = (preuves ?? []) as any[];
console.log(`── MUR PUBLIC — MATCHS DU 12 SEPTEMBRE : ${lignes.length} carte(s)\n`);
for (const p of lignes)
  console.log(
    `   ${p.issue_correcte ? 'JUSTE' : 'raté '} ${p.publiee ? 'publiée' : 'CACHÉE '}  ` +
      `${p.team1_name} — ${p.team2_name}  annoncé ${p.prono_score}  réel ${p.score_reel}` +
      (p.score_exact ? '  (score exact)' : '')
  );

const justes = lignes.filter((p) => p.issue_correcte);
const publiees = justes.filter((p) => p.publiee);
console.log(`\n${justes.length} vainqueur(s) juste(s), dont ${publiees.length} publiée(s).`);

const real = lignes.find((p) => /real madrid/i.test(`${p.team1_name} ${p.team2_name}`));
console.log(real ? `\nReal Madrid : PRÉSENT — ${real.team1_name} — ${real.team2_name} ${real.prono_score} / ${real.score_reel}, juste ${real.issue_correcte}, publiée ${real.publiee}` : '\nReal Madrid : TOUJOURS ABSENT.');
