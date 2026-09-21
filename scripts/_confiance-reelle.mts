// Lecture seule : la confiance des pronostics figés contre leur réussite réelle (vainqueur).
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = process.argv[2] ?? '2026-09-01';
const figes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data } = await sb.from('predictions_match').select('fixture_id, domicile_nom, buts_domicile, buts_exterieur, proba_domicile, proba_nul, proba_exterieur, confiance').gte('date_match', depuis).lt('date_match', new Date().toISOString()).range(de, de + 999);
  figes.push(...(data ?? [])); if (!data || data.length < 1000) break;
}
const reel = new Map<number, [number, number]>();
const ids = figes.map((f) => f.fixture_id);
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb.from('analysis_history').select('fixture_id, team1_name, real_score').in('fixture_id', ids.slice(i, i + 200)).not('real_score', 'is', null);
  for (const h of data ?? []) {
    const m = String(h.real_score).match(/(\d+)\s*-\s*(\d+)/); if (!m) continue;
    const f = figes.find((x) => x.fixture_id === h.fixture_id);
    const memeSens = String(h.team1_name).toLowerCase().slice(0, 5) === String(f.domicile_nom).toLowerCase().slice(0, 5);
    reel.set(h.fixture_id, memeSens ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])]);
  }
}
const tranches = new Map<string, number[]>();
for (const f of figes) {
  const r = reel.get(f.fixture_id); if (!r) continue;
  const iss = (a: number, b: number) => (a > b ? 0 : a === b ? 1 : 2);
  const ok = iss(f.buts_domicile, f.buts_exterieur) === iss(r[0], r[1]);
  const pAnn = [f.proba_domicile, f.proba_nul, f.proba_exterieur][iss(f.buts_domicile, f.buts_exterieur)];
  const t = f.confiance >= 90 ? '90+' : f.confiance >= 80 ? '80-89' : f.confiance >= 70 ? '70-79' : '<70';
  const v = tranches.get(t) ?? [0, 0, 0]; v[0]++; v[1] += +ok; v[2] += pAnn; tranches.set(t, v);
}
for (const t of ['90+', '80-89', '70-79', '<70']) { const v = tranches.get(t); if (v) console.log(`confiance ${t} : ${v[0]} matchs · vainqueur juste ${(100 * v[1] / v[0]).toFixed(1)} % · probabilité annoncée ${(v[2] / v[0]).toFixed(1)} %`); }
