// Lecture seule : parmi les pronostics figés à venir des compétitions où le marché est branché,
// lesquels n'ont AUCUNE cote relevée ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { lireCotesDuJourPatiemment } = await import('../src/lib/cotes-marche.js');
const sb = createAdminClient();
const debut = new Date(new Date().toISOString().slice(0, 10));
const fin = new Date(debut.getTime() + 4 * 86400000);
const cotes = new Map<number, any>();
for (let t = debut.getTime(); t <= fin.getTime(); t += 86400000) {
  const r = await lireCotesDuJourPatiemment(new Date(t).toISOString().slice(0, 10));
  console.log(new Date(t).toISOString().slice(0, 10), r ? `${r.matchs.length} cotés, relevé le ${r.releveLe}` : 'aucun relevé');
  for (const m of r?.matchs ?? []) cotes.set(Number(m.id), m);
}
const { data } = await sb.from('predictions_match').select('fixture_id, domicile_nom, exterieur_nom, competition, date_match').gte('date_match', new Date().toISOString()).lte('date_match', fin.toISOString());
const ids = (data ?? []).map((f) => f.fixture_id);
console.log(`${ids.length} figés à venir · ${ids.filter((i) => cotes.has(i)).length} cotés · relevés couvrant ${cotes.size} matchs`);
const parComp = new Map<string, [number, number]>();
for (const f of data ?? []) { const k = f.competition ?? '?'; const v = parComp.get(k) ?? [0, 0]; v[0]++; if (cotes.has(f.fixture_id)) v[1]++; parComp.set(k, v); }
for (const [k, [n, c]] of [...parComp].sort((a, b) => b[1][0] - a[1][0])) console.log(`  ${k} : ${c}/${n}`);
