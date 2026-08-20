/**
 * LE RATTRAPAGE DES IDENTIFIANTS A-T-IL RAPPROCHÉ LES BONNES RENCONTRES ?
 *
 * POURQUOI CE CONTRÔLE EST INDISPENSABLE
 *
 * Le rattrapage rapproche une analyse d'une prédiction figée par le NOM des
 * équipes, avec une correspondance permissive : « contient » suffit. C'est
 * nécessaire — l'application écrit « FC Barcelone » là où le fournisseur écrit
 * « Barcelona » — mais c'est aussi dangereux : « Dynamo » est contenu dans
 * « Dynamo Kyiv », et ce sont deux clubs de deux pays différents.
 *
 * Une rencontre mal rapprochée est pire qu'une rencontre non rapprochée : elle
 * fait juger un pronostic sur le résultat d'un AUTRE match, et peut publier une
 * fausse preuve ou enterrer une vraie.
 *
 * CE QUE FAIT CE SCRIPT
 *
 * Il ne fait pas confiance aux noms. Pour chaque analyse portant un
 * identifiant, il compare les NUMÉROS d'équipe — lus dans l'URL des logos, donc
 * attribués par le fournisseur lui-même — à ceux des deux équipes de la fiche.
 * Les numéros doivent correspondre, dans un sens ou dans l'autre.
 *
 * Ce qui ne correspond pas est signalé, et effacé avec `--nettoyer` : mieux
 * vaut une analyse non vérifiable qu'une analyse jugée sur le mauvais match.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const NETTOYER = process.argv.includes('--nettoyer');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const idDuLogo = (url) => {
  const m = String(url ?? '').match(/teams\/(\d+)\.png/);
  return m ? m[1] : null;
};

const depuis = new Date(Date.now() - 12 * 86400000).toISOString();
const lignes = [];
for (let page = 0; page < 20; page++) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('id, fixture_id, team1_name, team2_name, team1_logo, team2_logo, verified_at')
    .not('fixture_id', 'is', null)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .range(page * 1000, page * 1000 + 999);
  if (error) { console.error(error.message); process.exit(1); }
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`Analyses portant un identifiant : ${lignes.length}`);

const fixtures = [...new Set(lignes.map((l) => l.fixture_id))];
const fiches = new Map();
for (let i = 0; i < fixtures.length; i += 20) {
  const r = await fetch(
    `https://v3.football.api-sports.io/fixtures?ids=${fixtures.slice(i, i + 20).join('-')}`,
    { headers: { 'x-apisports-key': env.API_FOOTBALL_KEY } }
  );
  for (const f of (await r.json())?.response ?? []) fiches.set(f.fixture.id, f);
  process.stdout.write(`\r  fiches : ${fiches.size}/${fixtures.length}`);
}
console.log();

const bons = [];
const mauvais = [];
const introuvables = [];

for (const l of lignes) {
  const f = fiches.get(l.fixture_id);
  if (!f) { introuvables.push(l); continue; }
  const attendus = new Set([String(f.teams.home.id), String(f.teams.away.id)]);
  const a = idDuLogo(l.team1_logo);
  const b = idDuLogo(l.team2_logo);
  if (a && b && attendus.has(a) && attendus.has(b)) bons.push(l);
  else mauvais.push({ ...l, vraies: `${f.teams.home.name} (${f.teams.home.id}) / ${f.teams.away.name} (${f.teams.away.id})`, lues: `${a} / ${b}` });
}

console.log(`\n  rapprochements JUSTES   : ${bons.length}`);
console.log(`  rapprochements FAUX     : ${mauvais.length}`);
console.log(`  fiches introuvables     : ${introuvables.length}`);

if (mauvais.length) {
  const parAffiche = new Map();
  for (const m of mauvais) {
    const cle = `${m.team1_name} — ${m.team2_name}  ->  fx=${m.fixture_id} (${m.vraies})`;
    parAffiche.set(cle, (parAffiche.get(cle) ?? 0) + 1);
  }
  console.log(`\nRAPPROCHEMENTS FAUX (${parAffiche.size} affiches) :`);
  for (const [k, n] of [...parAffiche.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${n.toString().padStart(4)} x  ${k}`);
  const dejaJugees = mauvais.filter((m) => m.verified_at).length;
  console.log(`\n  dont DÉJÀ JUGÉES sur le mauvais match : ${dejaJugees}`);
}

if (!NETTOYER) {
  console.log('\n[CONTRÔLE] Rien modifié. Relancer avec --nettoyer pour effacer les rapprochements faux.\n');
  process.exit(0);
}

if (!mauvais.length) { console.log('\nRien à nettoyer.\n'); process.exit(0); }

console.log('\nEffacement des rapprochements faux et de leur verdict…');
let ok = 0;
for (let i = 0; i < mauvais.length; i += 100) {
  const lot = mauvais.slice(i, i + 100).map((m) => m.id);
  const { error } = await sb
    .from('analysis_history')
    .update({
      fixture_id: null,
      // Le verdict rendu sur le mauvais match doit disparaître avec lui.
      verified_at: null, real_score: null, real_winner: null,
      winner_correct: null, score_correct: null,
    })
    .in('id', lot);
  if (error) console.warn('  ' + error.message);
  else ok += lot.length;
}
console.log(`\nNettoyées : ${ok}\n`);
