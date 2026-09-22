// LECTURE SEULE : la justesse vécue par les abonnés — chaque analyse compte — par compétition, sur 30 jours.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const depuis = new Date(Date.now() - 30 * 86400000).toISOString();
const lignes: any[] = [];
for (let de = 0; de < 300_000; de += 1000) {
  let r: any = null;
  for (let e = 1; e <= 4 && !r; e++) {
    const q = await sb.from('analysis_history').select('competition, fixture_id, winner_correct, win_prob, draw_prob, lose_prob').not('verified_at', 'is', null).gte('created_at', depuis).order('created_at').order('id').range(de, de + 999);
    if (!q.error) r = q.data; else await new Promise((t) => setTimeout(t, 2000 * e));
  }
  if (!r) break;
  lignes.push(...r);
  if (r.length < 1000) break;
}
const par = new Map<string, { a: number; aj: number; m: Map<string, boolean> }>();
for (const x of lignes) {
  const k = String(x.competition ?? '—');
  const c = par.get(k) ?? { a: 0, aj: 0, m: new Map() };
  c.a++; if (x.winner_correct) c.aj++;
  c.m.set(String(x.fixture_id), !!x.winner_correct);
  par.set(k, c);
}
const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '—');
console.log(lignes.length, 'analyses vérifiées sur 30 jours');
console.log('compétition                  analyses  vécue    matchs  par match');
for (const [k, c] of [...par].sort((a, b) => b[1].a - a[1].a).slice(0, 14)) {
  const mj = [...c.m.values()].filter(Boolean).length;
  console.log(`  ${k.padEnd(26)} ${String(c.a).padStart(7)}  ${pc(c.aj, c.a).padStart(7)}  ${String(c.m.size).padStart(6)}  ${pc(mj, c.m.size)}`);
}
// Les matchs les plus analysés, et ce qu'ils ont donné.
const parMatch = new Map<string, { n: number; j: boolean; comp: string }>();
for (const x of lignes) { const k = String(x.fixture_id); const c = parMatch.get(k) ?? { n: 0, j: !!x.winner_correct, comp: String(x.competition) }; c.n++; parMatch.set(k, c); }
const top = [...parMatch].sort((a, b) => b[1].n - a[1].n).slice(0, 30);
const tj = top.filter(([, c]) => c.j).reduce((s, [, c]) => s + c.n, 0), tn = top.reduce((s, [, c]) => s + c.n, 0);
console.log(`\nles 30 matchs les plus analysés : ${tn} analyses · justes ${pc(tj, tn)} · ${top.filter(([, c]) => c.j).length}/30 matchs justes`);
