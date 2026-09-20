// Le bilan d'une journée dans les CINQ GRANDS CHAMPIONNATS seulement,
// avec ce que le marché annonçait, pour savoir si l'erreur était évitable.
//   npx tsx scripts/_bilan-grands-cinq.mts 2026-09-19
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { lireCotesDuJourPatiemment } = await import('../src/lib/cotes-marche.js');
const sb = createAdminClient();
const jour = process.argv[2] ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const GRANDS: Record<string, number> = { 'Premier League': 39, 'La Liga': 140, 'Serie A': 135, Bundesliga: 78, 'Ligue 1': 61 };
const cotes = new Map<number, any>();
for (const m of (await lireCotesDuJourPatiemment(jour))?.matchs ?? []) cotes.set(Number(m.id), m);
const { data } = await sb.from('preuves').select('*').gte('date_match', `${jour}T00:00:00`).lt('date_match', `${jour}T23:59:59`);
const lire = (s: any) => { const m = String(s ?? '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const iss = (a: number, b: number) => (a > b ? 0 : a === b ? 1 : 2);
let n = 0, okM = 0, okMarche = 0, nuls = 0;
for (const p of data ?? []) {
  const ligue = GRANDS[String(p.competition)];
  if (!ligue) continue;
  const pr = lire(p.prono_score), re = lire(p.score_reel);
  if (!pr || !re) continue;
  const c = cotes.get(p.fixture_id);
  const marche = c ? (c.proba.dom >= c.proba.ext ? 0 : 2) : null;
  const y = iss(re[0], re[1]);
  n++; if (iss(pr[0], pr[1]) === y) okM++;
  if (marche !== null && marche === y) okMarche++;
  if (y === 1) nuls++;
  const verdict = iss(pr[0], pr[1]) === y ? 'RÉUSSI' : 'raté  ';
  const avisMarche = c ? `marché ${(100 * c.proba.dom).toFixed(0)}/${(100 * c.proba.nul).toFixed(0)}/${(100 * c.proba.ext).toFixed(0)}${marche === y ? ' (juste)' : ' (faux)'}` : 'pas de cote';
  console.log(`${verdict} ${String(p.team1_name).slice(0, 20).padEnd(20)} ${String(p.team2_name).slice(0, 20).padEnd(20)} annoncé ${pr.join('-')} · réel ${re.join('-')} · ${avisMarche}`);
}
console.log(`\n${jour} · cinq grands championnats : ${n} matchs · moteur juste ${okM} · marché juste ${okMarche} · nuls ${nuls}`);
