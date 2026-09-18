/**
 * Lecture seule : les fiches de statistiques de match gardées en réserve
 * (`apifb:/fixtures/statistics?fixture=…`), et ce qu'elles contiennent.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const lignes: any[] = [];
for (let de = 0; de < 30000; de += 500) {
  const { data, error } = await sb.from('cache_api').select('cle, contenu').like('cle', 'apifb:/fixtures/statistics?fixture=%').range(de, de + 499);
  if (error) { console.log('erreur', error.message); break; }
  lignes.push(...(data ?? []));
  if (!data || data.length < 500) break;
}
console.log('fiches en réserve :', lignes.length);
const exemple = lignes.find((l) => Array.isArray(l.contenu?.response) && l.contenu.response.length);
if (exemple) {
  const types = (exemple.contenu.response[0]?.statistics ?? []).map((s: any) => s.type);
  console.log('exemple :', exemple.cle);
  console.log('statistiques disponibles :', types.join(' | '));
}
let avecXg = 0;
for (const l of lignes) {
  const r = l.contenu?.response ?? [];
  if (r.some((e: any) => (e.statistics ?? []).some((s: any) => s.type === 'expected_goals' && s.value !== null))) avecXg++;
}
console.log('fiches avec xG :', avecXg);

// ── EXPORT : une ligne par rencontre, du point de vue de celui qui reçoit ──
import fs from 'node:fs';
const { FICHIER_RENCONTRES } = await import('./challenger/commun.mjs');
const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const parId = new Map(rencontres.map((m) => [Number(m.id), m]));
const val = (stats: any[], type: string) => {
  const v = stats.find((s: any) => s.type === type)?.value;
  const n = typeof v === 'string' ? Number(v.replace('%', '')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const sortie: any[] = [];
for (const l of lignes) {
  const id = Number(String(l.cle).split('fixture=')[1]);
  const m = parId.get(id);
  const r = l.contenu?.response ?? [];
  if (!m || r.length < 2) continue;
  const dom = r.find((e: any) => Number(e.team?.id) === Number(m.dom));
  const ext = r.find((e: any) => Number(e.team?.id) === Number(m.ext));
  if (!dom || !ext) continue;
  sortie.push({
    id, date: m.date, ligue: Number(m.ligue), dom: Number(m.dom), ext: Number(m.ext), bd: m.bd, be: m.be,
    xgD: val(dom.statistics, 'expected_goals'), xgE: val(ext.statistics, 'expected_goals'),
    cadresD: val(dom.statistics, 'Shots on Goal'), cadresE: val(ext.statistics, 'Shots on Goal'),
    surfaceD: val(dom.statistics, 'Shots insidebox'), surfaceE: val(ext.statistics, 'Shots insidebox'),
  });
}
fs.writeFileSync('.challenger/statistiques-matchs.json', JSON.stringify(sortie));
const parLigue = new Map<number, number>();
for (const s of sortie) parLigue.set(s.ligue, (parLigue.get(s.ligue) ?? 0) + 1);
console.log(`exportées : ${sortie.length} rencontres rattachées · avec xG : ${sortie.filter((s) => s.xgD !== null).length}`);
console.log('par compétition :', [...parLigue].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([l, n]) => `${l}:${n}`).join(' '));
