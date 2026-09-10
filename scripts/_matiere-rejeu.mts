import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tous: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('fixture_id, date_match, ligue, buts_attendus_domicile, buts_attendus_exterieur, buts_prevus_domicile, buts_prevus_exterieur, buts_reels_domicile, buts_reels_exterieur, issue_prevue, issue_reelle, proba_domicile, proba_nul, proba_exterieur').range(de, de + 999);
  tous.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const avecXg = tous.filter((j) => j.buts_attendus_domicile != null && j.buts_attendus_exterieur != null);
console.log(`${tous.length} jugements, ${avecXg.length} avec buts attendus`);
const dates = avecXg.map((j) => String(j.date_match).slice(0, 10)).sort();
console.log(`periode : ${dates[0]} -> ${dates[dates.length - 1]}`);
// Coherence : l'issue annoncee correspond-elle a l'argmax des buts attendus ?
let accord = 0;
for (const j of avecXg) {
  const d = Number(j.buts_attendus_domicile), e = Number(j.buts_attendus_exterieur);
  const selonXg = d > e ? 'domicile' : d < e ? 'exterieur' : 'nul';
  if (selonXg === j.issue_prevue) accord++;
}
console.log(`accord entre buts attendus et issue annoncee : ${((100 * accord) / avecXg.length).toFixed(1)} %`);
console.log('exemples : ' + JSON.stringify(avecXg.slice(0, 3)));
