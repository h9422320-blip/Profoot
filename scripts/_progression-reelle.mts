/**
 * Lecture seule : la justesse RÉELLE du moteur en production, semaine par
 * semaine, sur les pronostics figés puis jugés (`jugements_moteur`).
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const lignes: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  if (error) throw error;
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log('jugements :', lignes.length, '· colonnes :', Object.keys(lignes[0] ?? {}).join(', '));

const GRANDS = /^(Premier League \(England\)|La Liga \(Spain\)|Serie A \(Italy\)|Bundesliga \(Germany\)|Ligue 1 \(France\)|Primeira Liga \(Portugal\)|Eredivisie \(Netherlands\)|Premier League|La Liga|Serie A|Bundesliga|Ligue 1|Primeira Liga|Eredivisie)$/;
const EUROPE = /champions league|europa league|conference league/i;
const semaine = (d: string) => {
  const t = new Date(d); const lundi = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - ((t.getUTCDay() + 6) % 7)));
  return lundi.toISOString().slice(0, 10);
};
const agr = (f: (l: any) => boolean) => {
  const m = new Map<string, { n: number; j: number; ex: number; br: number; nS: number; jS: number }>();
  for (const l of lignes) {
    if (!l.date_match || !f(l)) continue;
    const k = semaine(l.date_match);
    const s = m.get(k) ?? { n: 0, j: 0, ex: 0, br: 0, nS: 0, jS: 0 };
    s.n++; if (l.issue_juste) s.j++; if (l.score_exact) s.ex++; s.br += Number(l.brier ?? 0);
    const conf = Math.max(Number(l.proba_domicile ?? 0), Number(l.proba_exterieur ?? 0));
    if (conf >= 60) { s.nS++; if (l.issue_juste) s.jS++; }
    m.set(k, s);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
};
for (const [nom, f] of [
  ['TOUTES COMPÉTITIONS', (_l: any) => true],
  ['SEPT GRANDS CHAMPIONNATS', (l: any) => GRANDS.test(String(l.ligue ?? ''))],
  ['COUPES D’EUROPE', (l: any) => EUROPE.test(String(l.ligue ?? ''))],
] as [string, (l: any) => boolean][]) {
  console.log(`\n── ${nom} ──  semaine du · matchs · bons vainqueurs · scores exacts · quand sûr (≥ 60 %)`);
  for (const [k, s] of agr(f))
    if (s.n >= 8)
      console.log(`  ${k}  ${String(s.n).padStart(4)}  ${(100 * s.j / s.n).toFixed(1).padStart(5)} %  ${(100 * s.ex / s.n).toFixed(1).padStart(5)} %  ${s.nS ? `${(100 * s.jS / s.nS).toFixed(1)} % sur ${s.nS}` : '—'}`);
}
