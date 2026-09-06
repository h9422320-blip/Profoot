import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { CHAMPIONNATS } = await import('../src/lib/precalcul-selection.js');
const { lireReleve, fiabilitePour } = await import('../src/lib/fiabilite-apprise.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const K = process.env.API_FOOTBALL_KEY!;

const releve = await lireReleve();
console.log('releve de fiabilite : ' + (releve ? 'present' : 'ABSENT'));

const sb = createAdminClient();
const pron = new Map<number, any>();
for (let de = 0; de < 50000; de += 1000) {
  const { data } = await sb.from('predictions_match').select('fixture_id, proba_domicile, proba_nul, proba_exterieur, calculee_le').range(de, de + 999);
  for (const p of data ?? []) {
    const id = Number(p.fixture_id);
    const c = pron.get(id);
    if (!c || String(p.calculee_le) > String(c.calculee_le)) pron.set(id, p);
  }
  if (!data || data.length < 1000) break;
}
console.log('pronostics figes : ' + pron.size);

for (const jour of [new Date().toISOString().slice(0, 10), new Date(Date.now() + 86400000).toISOString().slice(0, 10)]) {
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': K }, cache: 'no-store' });
  const j = await r.json();
  const aVenir = (j?.response ?? []).filter((f: any) => ['NS', 'TBD'].includes(f?.fixture?.status?.short));
  const dansListe = aVenir.filter((f: any) => CHAMPIONNATS.includes(String(f?.league?.name ?? '')));
  const avecPron = dansListe.filter((f: any) => pron.get(Number(f.fixture.id))?.proba_domicile != null);
  console.log(`\n${jour} : ${aVenir.length} a venir, ${dansListe.length} dans les championnats retenus, ${avecPron.length} avec pronostic fige`);
  let passent = 0;
  for (const f of avecPron.slice(0, 12)) {
    const p = pron.get(Number(f.fixture.id));
    const fi = fiabilitePour(releve, Number(p.proba_domicile), Number(p.proba_nul), Number(p.proba_exterieur), f?.league?.name);
    if (fi && fi.taux >= 70) passent++;
    console.log(`  ${String(f.teams.home.name).slice(0,18).padEnd(19)} ${String(f.teams.away.name).slice(0,18).padEnd(19)} probas ${p.proba_domicile}/${p.proba_nul}/${p.proba_exterieur}  fiabilite ${fi ? fi.taux + ' % (' + fi.matchs + ' matchs)' : 'AUCUNE'}`);
  }
  console.log(`  -> ${passent} atteignent le seuil de 70 %`);
}
