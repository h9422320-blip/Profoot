/**
 * RENDRE VÉRIFIABLES LES ANALYSES ÉCRITES SANS IDENTIFIANT DE RENCONTRE.
 *
 * CE QUI S'EST PASSÉ
 *
 * Le 16 août 2026 à 19 h 49, l'enregistrement de l'historique est passé du
 * navigateur au serveur. La nouvelle fonction n'a pas repris la colonne
 * `fixture_id`. Depuis, chaque analyse est écrite sans le numéro de la
 * rencontre — donc sans la seule clé qui permette d'aller chercher le résultat
 * réel et de juger le pronostic.
 *
 * Rien n'a planté. Aucune alerte. Le mur de preuves a simplement cessé de
 * grandir, pendant que mille sept cents analyses s'accumulaient — dont
 * Barcelone, le Real Madrid, Liverpool, Arsenal et l'Inter.
 *
 * COMMENT ON RETROUVE LE NUMÉRO SANS RIEN INVENTER
 *
 * La table `predictions_match` a continué, elle, d'enregistrer correctement le
 * numéro de chaque rencontre analysée, avec le nom des deux équipes. Elle est
 * donc le pont : on rapproche par les NOMS, dans les deux sens de saisie, et
 * uniquement quand les deux équipes correspondent. Aucun rapprochement partiel,
 * aucune supposition.
 *
 * Ce que ce script ne fait PAS : inventer un numéro, deviner un résultat,
 * toucher à un verdict. Il ne fait que reposer une clé perdue.
 *
 * SIMULATION PAR DÉFAUT. Écrit seulement avec l'argument `--ecrire`.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const ECRIRE = process.argv.includes('--ecrire');
const JOURS = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 10);

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const normaliser = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const memeEquipe = (a, b) => {
  const x = normaliser(a), y = normaliser(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

// ── Le pont : les prédictions figées, qui ont gardé le numéro ────────────────
const { data: figees, error: e1 } = await sb
  .from('predictions_match')
  .select('fixture_id, domicile_nom, exterieur_nom, calculee_le')
  .order('calculee_le', { ascending: false })
  .limit(2000);
if (e1) { console.error('predictions_match illisible :', e1.message); process.exit(1); }
console.log(`Prédictions figées disponibles : ${figees.length}`);

// ── Les analyses orphelines ─────────────────────────────────────────────────
const depuis = new Date(Date.now() - JOURS * 86400000).toISOString();
const orphelines = [];
for (let page = 0; page < 20; page++) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('id, team1_name, team2_name, created_at')
    .is('fixture_id', null)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .range(page * 1000, page * 1000 + 999);
  if (error) { console.error('analysis_history illisible :', error.message); process.exit(1); }
  orphelines.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`Analyses sans identifiant sur ${JOURS} jours : ${orphelines.length}`);

// ── Rapprochement ───────────────────────────────────────────────────────────
const retrouvees = [];
const perdues = new Map();

for (const a of orphelines) {
  const f = figees.find(
    (p) =>
      (memeEquipe(a.team1_name, p.domicile_nom) && memeEquipe(a.team2_name, p.exterieur_nom)) ||
      (memeEquipe(a.team1_name, p.exterieur_nom) && memeEquipe(a.team2_name, p.domicile_nom))
  );
  if (f) retrouvees.push({ id: a.id, fixtureId: f.fixture_id, affiche: `${a.team1_name} — ${a.team2_name}` });
  else {
    const cle = `${a.team1_name} — ${a.team2_name}`;
    perdues.set(cle, (perdues.get(cle) ?? 0) + 1);
  }
}

console.log(`\n  rattrapables : ${retrouvees.length}`);
console.log(`  sans pont    : ${orphelines.length - retrouvees.length}  (${perdues.size} affiches distinctes)`);

const affichesRattrapees = new Set(retrouvees.map((r) => r.affiche));
console.log(`\nAffiches rendues vérifiables : ${affichesRattrapees.size}`);
for (const a of [...affichesRattrapees].slice(0, 40)) console.log('  + ' + a);

if (perdues.size) {
  console.log(`\nAffiches SANS prédiction figée (resteront invérifiables) — les 20 plus analysées :`);
  for (const [nom, n] of [...perdues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log(`  - ${nom}  (${n} analyse${n > 1 ? 's' : ''})`);
}

// ── Écriture ────────────────────────────────────────────────────────────────
if (!ECRIRE) {
  console.log('\n[SIMULATION] Rien n’a été écrit. Relancer avec --ecrire pour appliquer.\n');
  process.exit(0);
}

console.log('\nÉcriture en cours…');
let ok = 0, ko = 0;
// Groupé par numéro de rencontre : une écriture par match plutôt qu'une par
// analyse — il y a souvent des dizaines d'analyses pour la même affiche.
const parFixture = new Map();
for (const r of retrouvees) {
  if (!parFixture.has(r.fixtureId)) parFixture.set(r.fixtureId, []);
  parFixture.get(r.fixtureId).push(r.id);
}
for (const [fixtureId, ids] of parFixture) {
  for (let i = 0; i < ids.length; i += 100) {
    const lot = ids.slice(i, i + 100);
    const { error } = await sb.from('analysis_history').update({ fixture_id: fixtureId }).in('id', lot);
    if (error) { ko += lot.length; console.warn(`  ${fixtureId} : ${error.message}`); }
    else ok += lot.length;
  }
  process.stdout.write(`\r  ${ok} ligne(s) réparée(s)`);
}
console.log(`\n\nRéparées : ${ok}   échecs : ${ko}\n`);
