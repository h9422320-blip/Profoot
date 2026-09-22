// LECTURE SEULE : la justesse réelle sur les coupes nationales, face aux championnats.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const lignes: any[] = [];
for (let de = 0; de < 300_000; de += 1000) {
  let r: any = null;
  for (let e = 1; e <= 4 && !r; e++) {
    const q = await sb.from('analysis_history').select('competition, fixture_id, team1_name, team2_name, winner_correct').not('verified_at', 'is', null).gte('created_at', '2026-08-01').order('created_at').order('id').range(de, de + 999);
    if (!q.error) r = q.data; else await new Promise((t) => setTimeout(t, 2000 * e));
  }
  if (!r) break;
  lignes.push(...r);
  if (r.length < 1000) break;
}
const COUPES = /League Cup|FA Cup|Coppa Italia|DFB Pokal|Copa del Rey|Coupe de France|^Cup$|Taça|KNVB|Pokal|Kupası|Cupen|Pokalen|Cupa/i;
const groupes: Record<string, { vus: Set<string>; n: number; j: number }> = {};
for (const a of lignes) {
  const g = COUPES.test(String(a.competition)) ? 'coupes nationales' : /Champions League|Europa/.test(String(a.competition)) ? 'coupes d’Europe' : 'championnats';
  groupes[g] ??= { vus: new Set(), n: 0, j: 0 };
  const k = String(a.fixture_id ?? `${a.team1_name}|${a.team2_name}`);
  if (groupes[g].vus.has(k)) continue;
  groupes[g].vus.add(k);
  groupes[g].n++;
  if (a.winner_correct) groupes[g].j++;
}
for (const [g, c] of Object.entries(groupes)) console.log(`${g.padEnd(20)} ${String(c.n).padStart(5)} rencontres · vainqueur juste ${((100 * c.j) / c.n).toFixed(1)} %`);
