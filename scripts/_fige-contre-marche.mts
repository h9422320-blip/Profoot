// Lecture seule : les pronostics figés des prochains jours suivent-ils le favori du marché ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { lireCotesEntre } = await import('../src/lib/cotes-marche.js');
const { CHAMPIONNATS_DU_MARCHE } = await import('../src/lib/couche-marche.js');
const sb = createAdminClient();
const debut = new Date(process.argv[2] ?? new Date().toISOString().slice(0, 10));
const fin = new Date(debut.getTime() + 3 * 86400000);
const cotes = await lireCotesEntre(debut, fin);
const { data } = await sb.from('predictions_match').select('*').gte('date_match', debut.toISOString()).lte('date_match', fin.toISOString());
const issue = (a: number, n: number, b: number) => (a >= n && a >= b ? 'D' : b >= n ? 'E' : 'N');
let n = 0, accord = 0, sansCote = 0;
for (const f of data ?? []) {
  const c = cotes.get(f.fixture_id);
  if (!c) { sansCote++; continue; }
  if (!CHAMPIONNATS_DU_MARCHE.has(c.ligue)) continue;
  n++;
  const fi = f.buts_domicile > f.buts_exterieur ? 'D' : f.buts_domicile === f.buts_exterieur ? 'N' : 'E';
  const mi = issue(c.proba.dom, c.proba.nul, c.proba.ext);
  if (fi === mi) accord++;
  else console.log(`${f.date_match.slice(0, 16)} ${f.domicile_nom}–${f.exterieur_nom} figé ${f.buts_domicile}-${f.buts_exterieur} (${f.proba_domicile}/${f.proba_nul}/${f.proba_exterieur}) · marché ${c.proba.dom.toFixed(2)}/${c.proba.nul.toFixed(2)}/${c.proba.ext.toFixed(2)} · figé le ${String(f.calculee_le).slice(0, 16)}`);
}
console.log(`${(data ?? []).length} figés · ${n} dans les championnats du marché · ${accord} suivent le favori du marché · ${sansCote} sans cote relevée`);
