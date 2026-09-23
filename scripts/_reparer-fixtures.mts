/**
 * RÉPARE LES ANALYSES RATTACHÉES AU MAUVAIS MATCH.
 *
 * Défaut du 23 septembre 2026 : une analyse lancée pendant un match portait le
 * numéro de la rencontre SUIVANTE entre les deux équipes. Elle ne pouvait donc
 * jamais être confrontée à son résultat.
 *
 * On ne touche qu'aux analyses non jugées dont la rencontre enregistrée est
 * ENCORE À VENIR, et seulement si une rencontre entre les deux mêmes équipes
 * s'est TERMINÉE dans les douze heures qui entourent l'analyse.
 *
 *   npx tsx scripts/_reparer-fixtures.mts          (à blanc)
 *   npx tsx scripts/_reparer-fixtures.mts --ecrire (applique)
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const ecrire = process.argv.includes('--ecrire');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const cle = process.env.API_FOOTBALL_KEY;
const get = async (q: string) => (await (await fetch('https://v3.football.api-sports.io/' + q, { headers: { 'x-apisports-key': String(cle) } })).json());

const enAttente: any[] = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('analysis_history').select('id,fixture_id,created_at,team1_name,team2_name').is('verified_at', null).not('fixture_id', 'is', null).lte('created_at', new Date(Date.now() - 6 * 3600e3).toISOString()).range(de, de + 999);
  enAttente.push(...(data ?? [])); if (!data || data.length < 1000) break;
}
console.log('analyses non jugées avec un numéro de rencontre :', enAttente.length);

const ids = [...new Set(enAttente.map((x) => Number(x.fixture_id)))];
const fiches = new Map<number, any>();
for (let i = 0; i < ids.length; i += 20) for (const f of (await get(`fixtures?ids=${ids.slice(i, i + 20).join('-')}`)).response ?? []) fiches.set(f.fixture.id, f);

const aVenir = enAttente.filter((x) => {
  const f = fiches.get(Number(x.fixture_id));
  return f && !['FT', 'AET', 'PEN'].includes(String(f.fixture.status.short)) && Date.parse(f.fixture.date) > Date.now();
});
console.log('dont la rencontre est encore à venir :', aVenir.length);

const h2h = new Map<string, any[]>();
const paire = (f: any) => [f.teams.home.id, f.teams.away.id].sort((a: number, b: number) => a - b).join('-');
let repares = 0, sansCandidat = 0;
const ecarts: number[] = [];
const exemples: string[] = [];
const parLot: { id: string; fixture: number }[] = [];
for (const x of aVenir) {
  const f = fiches.get(Number(x.fixture_id)); if (!f) continue;
  const k = paire(f);
  if (!h2h.has(k)) h2h.set(k, ((await get(`fixtures/headtohead?h2h=${k}`)).response ?? []));
  const t = Date.parse(x.created_at);
  const candidat = (h2h.get(k) ?? []).find((m: any) =>
    ['FT', 'AET', 'PEN'].includes(String(m.fixture.status.short)) &&
    Math.abs(Date.parse(m.fixture.date) - t) < 12 * 3600e3);
  if (!candidat) { sansCandidat++; continue; }
  repares++;
  if (exemples.length < 6) exemples.push(`${String(x.created_at).slice(0, 16)} ${x.team1_name}-${x.team2_name} : ${x.fixture_id} (${f.fixture.date.slice(0, 10)}) → ${candidat.fixture.id} (${candidat.fixture.date.slice(0, 10)}, ${candidat.goals.home}-${candidat.goals.away})`);
  parLot.push({ id: x.id, fixture: candidat.fixture.id });
  ecarts.push((Date.parse(x.created_at) - Date.parse(candidat.fixture.date)) / 3600e3);
}
console.log(`à réparer : ${repares} · sans rencontre correspondante : ${sansCandidat}`);
console.log(exemples.join('\n'));
if (ecrire) {
  let fait = 0;
  for (const r of parLot) {
    const { error } = await sb.from('analysis_history').update({ fixture_id: r.fixture }).eq('id', r.id);
    if (!error) fait++;
  }
  console.log('analyses rattachées à leur vraie rencontre :', fait);
}

{
  const avant = ecarts.filter((e) => e < -0.25).length;
  const pendant = ecarts.filter((e) => e >= -0.25 && e <= 2).length;
  const apres = ecarts.filter((e) => e > 2).length;
  const tri = [...ecarts].sort((a, b) => a - b);
  console.log(`écart analyse − coup d'envoi : AVANT ${avant} · pendant ${pendant} · après ${apres} · médiane ${tri[Math.floor(tri.length / 2)]?.toFixed(1)} h`);
}
