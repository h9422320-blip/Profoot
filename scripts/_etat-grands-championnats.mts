/*
 * Le moteur sur les grands championnats et les coupes, identifies par leur
 * NUMERO (la Premier League anglaise n'est pas celle d'Egypte). Lecture seule.
 */
import fs from 'node:fs';
for (const brut of fs.readFileSync('.env.local', 'utf8').split(String.fromCharCode(10))) {
  const l = brut.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const F = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const ligueDe = new Map<number, number>();
for (const x of JSON.parse(fs.readFileSync(F, 'utf8'))) ligueDe.set(Number(x.id), Number(x.ligue));
const jug: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  jug.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const GRANDS: [number, string][] = [[39, 'Premier League'], [140, 'La Liga'], [135, 'Serie A'], [78, 'Bundesliga'], [61, 'Ligue 1'], [94, 'Primeira Liga'], [88, 'Eredivisie'], [2, 'Ligue des champions'], [3, 'Europa League'], [848, 'Conference League']];
const maxp = (j: any) => Math.max(Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur));
const favDom = (j: any) => Number(j.proba_domicile) >= Number(j.proba_exterieur);
const pc = (l: any[]) => (l.length ? ((100 * l.filter((j) => j.issue_juste).length) / l.length).toFixed(1) + ' % (' + l.length + ')' : '-');
const br = (l: any[]) => (l.length ? (l.reduce((s, j) => s + Number(j.brier ?? 0), 0) / l.length).toFixed(3) : '-');
console.log(jug.length + ' jugements ; ' + jug.filter((j) => ligueDe.has(Number(j.fixture_id))).length + ' rattaches a une competition par son numero');
console.log('');
console.log('competition            tous             sur >= 60 %       fav. domicile >= 60 %   fav. exterieur >= 60 %   nuls reels   Brier');
for (const [id, nom] of GRANDS) {
  const l = jug.filter((j) => ligueDe.get(Number(j.fixture_id)) === id);
  const s = l.filter((j) => maxp(j) >= 60);
  const nuls = l.length ? ((100 * l.filter((j) => j.issue_reelle === 'nul').length) / l.length).toFixed(0) + ' %' : '-';
  const nulsAnnonces = l.filter((j) => j.issue_prevue === 'nul').length;
  console.log(
    nom.padEnd(22) + ' ' + pc(l).padEnd(16) + ' ' + pc(s).padEnd(17) + ' ' + pc(s.filter(favDom)).padEnd(23) + ' ' + pc(s.filter((j) => !favDom(j))).padEnd(24) + ' ' +
      (nuls + ' / ' + nulsAnnonces + ' annonces').padEnd(12) + ' ' + br(l)
  );
}
const sept = jug.filter((j) => String(j.date_match) >= '2026-08-01');
console.log('');
console.log('Depuis le 1er aout 2026 seulement :');
for (const [id, nom] of GRANDS) {
  const l = sept.filter((j) => ligueDe.get(Number(j.fixture_id)) === id);
  if (l.length) console.log('  ' + nom.padEnd(22) + ' ' + pc(l).padEnd(16) + ' sur >= 60 % : ' + pc(l.filter((j) => maxp(j) >= 60)));
}
