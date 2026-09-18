/**
 * Lecture seule : la justesse RÉELLE de l'application, semaine par semaine, sur
 * les pronostics figés et jugés du mur (`preuves`, une ligne par match).
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const lignes: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('preuves').select('date_match, competition, issue_correcte, score_exact, prono_score, score_reel').range(de, de + 999);
  if (error) throw error;
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const juges = lignes.filter((l) => l.score_reel && l.date_match);
console.log(`matchs jugés au mur : ${juges.length} · du ${juges.map((l) => l.date_match).sort()[0]?.slice(0, 10)} au ${juges.map((l) => l.date_match).sort().at(-1)?.slice(0, 10)}`);
const GRANDS = /^(Premier League|La Liga|Serie A|Bundesliga|Ligue 1|Primeira Liga|Eredivisie)$/;
const EUROPE = /champions league|europa league|conference league/i;
const semaine = (d: string) => { const t = new Date(d); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - ((t.getUTCDay() + 6) % 7))).toISOString().slice(0, 10); };
for (const [nom, f] of [
  ['TOUTES COMPÉTITIONS', () => true],
  ['SEPT GRANDS CHAMPIONNATS', (l: any) => GRANDS.test(String(l.competition ?? ''))],
  ['COUPES D’EUROPE', (l: any) => EUROPE.test(String(l.competition ?? ''))],
] as [string, (l: any) => boolean][]) {
  const m = new Map<string, { n: number; j: number; ex: number }>();
  for (const l of juges.filter(f)) {
    const k = semaine(l.date_match);
    const s = m.get(k) ?? { n: 0, j: 0, ex: 0 };
    s.n++; if (l.issue_correcte) s.j++; if (l.score_exact) s.ex++;
    m.set(k, s);
  }
  console.log(`\n── ${nom} ── semaine du · matchs · bons vainqueurs · scores exacts`);
  for (const [k, s] of [...m].sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${k}  ${String(s.n).padStart(4)}  ${(100 * s.j / s.n).toFixed(1).padStart(5)} %  ${(100 * s.ex / s.n).toFixed(1).padStart(5)} %`);
}
