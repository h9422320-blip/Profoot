/** Pourquoi le moteur a annonce Manchester United 0-3 Sabah. Lecture seule. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const jour = new Date().toISOString().slice(0, 10);
const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}&league=2&season=2026`, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! }, cache: 'no-store' });
let fx = (await r.json())?.response ?? [];
if (!fx.length) {
  const r2 = await fetch(`https://v3.football.api-sports.io/fixtures?date=${jour}`, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! }, cache: 'no-store' });
  fx = ((await r2.json())?.response ?? []).filter((f: any) => f.league.id === 2);
}
const f = fx.find((x: any) => /sabah/i.test(x.teams.away.name) || /sabah/i.test(x.teams.home.name));
if (!f) { console.log('rencontre introuvable'); process.exit(0); }
console.log(`rencontre ${f.fixture.id} : ${f.teams.home.name} (id ${f.teams.home.id}) - ${f.teams.away.name} (id ${f.teams.away.id}), saison ${f.league.season}, reel ${f.goals.home}-${f.goals.away}\n`);

const { data: pron } = await sb.from('predictions_match').select('*').eq('fixture_id', f.fixture.id);
console.log(`=== ${pron?.length ?? 0} pronostic(s) fige(s) ===`);
for (const p of pron ?? []) {
  const court = Object.fromEntries(Object.entries(p).filter(([k]) => !/texte|analyse|json|contenu/i.test(k)));
  console.log('  ' + JSON.stringify(court));
}

// Ce que le releve des tirs savait des deux clubs
const { data: rel } = await sb.from('cache_api').select('contenu').eq('cle', 'forces:occasions-v6').maybeSingle();
const clubs: any = (rel?.contenu as any)?.clubs ?? {};
for (const [id, nom] of [[f.teams.home.id, f.teams.home.name], [f.teams.away.id, f.teams.away.name]] as const) {
  const c = clubs[String(id)];
  console.log(`\n=== releve des tirs : ${nom} (${id}) ===`);
  console.log('  ' + (c ? JSON.stringify(c).slice(0, 500) : 'ABSENT du releve'));
}

// Les analyses d'abonnes sur ce match : score et vainqueur annonces
const { data: an } = await sb.from('analysis_history').select('id, team1_name, team2_name, score, predicted_winner, created_at, fixture_id').eq('fixture_id', String(f.fixture.id)).limit(10);
console.log(`\n=== ${an?.length ?? 0} analyse(s) d'abonnes sur ce match ===`);
for (const a of an ?? []) console.log(`  ${String(a.created_at).slice(0,16)}  ${a.team1_name} - ${a.team2_name}  score ${a.score}  vainqueur ${a.predicted_winner}`);

// Les dernieres rencontres de Sabah vues par le fournisseur
const r3 = await fetch(`https://v3.football.api-sports.io/fixtures?team=${f.teams.away.id}&last=8`, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY! }, cache: 'no-store' });
console.log(`\n=== 8 derniers matchs de ${f.teams.away.name} ===`);
for (const x of (await r3.json())?.response ?? []) console.log(`  ${String(x.fixture.date).slice(0,10)}  ${String(x.league.name).slice(0,20).padEnd(21)} ${x.teams.home.name} ${x.goals.home}-${x.goals.away} ${x.teams.away.name}`);
