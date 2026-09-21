// LECTURE SEULE : la justesse de ce que les abonnés ont VRAIMENT reçu, semaine par semaine.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data: un } = await sb.from('analysis_history').select('*').not('verified_at', 'is', null).limit(1);
console.log('colonnes :', Object.keys(un?.[0] ?? {}).join(', '));
const lignes: any[] = [];
for (let de = 0; de < 300_000; de += 1000) {
  let r: any = null;
  for (let essai = 1; essai <= 4 && !r; essai++) {
    const q = await sb.from('analysis_history').select('created_at, id, team1_name, team2_name, competition, winner_correct, win_prob, draw_prob, lose_prob, predicted_winner, real_winner').not('verified_at', 'is', null).gte('created_at', '2026-08-01').order('created_at').order('id').range(de, de + 999);
    if (!q.error) r = q.data; else await new Promise((x) => setTimeout(x, 2000 * essai));
  }
  if (!r) { console.log('lecture interrompue à', de); break; }
  lignes.push(...r);
  if (r.length < 1000) break;
}
console.log(lignes.length, 'analyses vérifiées depuis le 1er août');
const GRANDS = /premier league|la liga|laliga|serie a|bundesliga|ligue 1/i;
const semaine = (iso: string) => {
  const d = new Date(iso); const j = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - j);
  return d.toISOString().slice(5, 10);
};
const par = new Map<string, { n: number; j: number; ng: number; jg: number; vus: Set<string> }>();
for (const a of lignes) {
  const k = semaine(a.created_at);
  const c = par.get(k) ?? { n: 0, j: 0, ng: 0, jg: 0, vus: new Set() };
  // Une rencontre compte une fois par semaine, quel que soit le nombre d'abonnés qui l'ont analysée.
  const cle = `${a.team1_name}|${a.team2_name}`;
  if (c.vus.has(cle)) { par.set(k, c); continue; }
  c.vus.add(cle);
  c.n++; if (a.winner_correct) c.j++;
  const comp = String(a.competition ?? a.league ?? a.competition_name ?? '');
  if (GRANDS.test(comp)) { c.ng++; if (a.winner_correct) c.jg++; }
  par.set(k, c);
}
const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '   —  ');
console.log('semaine du   rencontres  vainqueur juste   dont 5 grands championnats');
for (const [k, c] of [...par].sort()) console.log(`  ${k}      ${String(c.n).padStart(5)}      ${pc(c.j, c.n).padStart(7)}        ${String(c.ng).padStart(4)} → ${pc(c.jg, c.ng)}`);
