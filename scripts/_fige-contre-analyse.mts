// Lecture seule : pronostic FIGÉ (mur des preuves, sélection) contre pronostic lu dans l'ANALYSE, sur les matchs joués.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = process.argv[2] ?? '2026-09-01';
const lignes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb.from('analysis_history').select('fixture_id, team1_name, team2_name, score, real_score, created_at')
    .not('verified_at', 'is', null).gte('created_at', `${depuis}T00:00:00Z`).range(de, de + 999);
  if (error) throw error; lignes.push(...(data ?? [])); if (!data || data.length < 1000) break;
}
const lire = (s: string | null) => { const m = String(s ?? '').match(/(\d+)\s*-\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const issue = (a: number, b: number) => (a > b ? 1 : a === b ? 0 : -1);
const parMatch = new Map<number, any[]>();
for (const l of lignes) if (l.fixture_id) parMatch.set(l.fixture_id, [...(parMatch.get(l.fixture_id) ?? []), l]);
const ids = [...parMatch.keys()];
const fige = new Map<number, any>();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb.from('predictions_match').select('fixture_id, domicile_nom, buts_domicile, buts_exterieur, competition').in('fixture_id', ids.slice(i, i + 200));
  for (const f of data ?? []) fige.set(f.fixture_id, f);
}
let n = 0, desaccord = 0, fJuste = 0, aJuste = 0, dF = 0, dA = 0;
const parComp: Record<string, number[]> = {};
for (const [id, ls] of parMatch) {
  const f = fige.get(id); if (!f) continue;
  // l'analyse de référence : la dernière lancée, remise dans le sens du domicile
  const l = ls.sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  const s = lire(l.score), r = lire(l.real_score); if (!s || !r) continue;
  const memeSens = String(l.team1_name).toLowerCase().replace(/[^a-z]/g, '').includes(String(f.domicile_nom).toLowerCase().replace(/[^a-z]/g, '').slice(0, 5));
  const ia = memeSens ? issue(s[0], s[1]) : issue(s[1], s[0]);
  const ir = memeSens ? issue(r[0], r[1]) : issue(r[1], r[0]);
  const iff = issue(f.buts_domicile, f.buts_exterieur);
  n++; if (iff === ir) fJuste++; if (ia === ir) aJuste++;
  const comp = /champions|europa|conference/i.test(String(f.competition)) ? "coupes d'Europe" : 'championnats';
  parComp[comp] ??= [0, 0, 0, 0, 0];
  parComp[comp][0]++; if (iff === ir) parComp[comp][1]++; if (ia === ir) parComp[comp][2]++; if (iff !== ia) { parComp[comp][3]++; if (ia === ir) parComp[comp][4]++; }
  if (iff !== ia) { desaccord++; if (iff === ir) dF++; if (ia === ir) dA++; }
}
console.log(`matchs joués avec les deux : ${n}`);
console.log(`vainqueur juste — figé : ${fJuste}  ·  analyse : ${aJuste}`);
console.log(`désaccords : ${desaccord}  ·  dont figé juste ${dF}, analyse juste ${dA}`);

for (const [c, v] of Object.entries(parComp)) console.log(`${c} : ${v[0]} matchs · figé juste ${v[1]} · analyse juste ${v[2]} · désaccords ${v[3]} (analyse juste ${v[4]})`);
