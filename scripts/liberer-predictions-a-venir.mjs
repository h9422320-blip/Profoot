/**
 * LIBÉRER LES PRÉDICTIONS DES MATCHS PAS ENCORE JOUÉS.
 *
 * Chaque rencontre porte UNE prédiction, figée au premier calcul et relue
 * ensuite par toutes les analyses. Corriger le moteur ne change donc rien aux
 * matchs déjà analysés : leur ancien score reste servi tel quel.
 *
 * Les prédictions des matchs DÉJÀ JOUÉS sont conservées, sans exception : elles
 * sont la référence du mur de preuves, et les effacer reviendrait à réécrire
 * après coup ce qu'on avait annoncé avant le coup d'envoi. On ne touche qu'aux
 * rencontres à venir, qui seront recalculées à la prochaine analyse.
 *
 * Sans argument : simulation. Avec --liberer : suppression.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const CLE = env.API_FOOTBALL_KEY;
const LIBERER = process.argv.includes('--liberer');

const { data, error } = await sb.from('predictions_match').select('*').limit(5000);
if (error) { console.log('Lecture impossible :', error.message); process.exit(1); }

console.log(`\n  ${data.length} prédiction(s) figée(s).`);

// Statut réel de chaque rencontre chez le fournisseur.
const statuts = new Map();
const ids = data.map((p) => p.fixture_id).filter(Boolean);
for (let i = 0; i < ids.length; i += 20) {
  const lot = ids.slice(i, i + 20).join('-');
  try {
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${lot}`, {
      headers: { 'x-apisports-key': CLE },
    });
    const j = await r.json();
    for (const f of j?.response ?? []) statuts.set(f.fixture.id, f.fixture.status.short);
  } catch (e) { console.log('  lot ignoré :', e.message); }
}

const JOUE = ['FT', 'AET', 'PEN'];
const aVenir = data.filter((p) => {
  const s = statuts.get(p.fixture_id);
  // Statut inconnu : on ne touche pas. Mieux vaut garder une prédiction de trop
  // qu'effacer la référence d'une preuve publiée.
  return s && !JOUE.includes(s);
});
const joues = data.length - aVenir.length;

const compte = new Map();
for (const p of aVenir) {
  const k = `${p.buts_domicile}-${p.buts_exterieur}`;
  compte.set(k, (compte.get(k) ?? 0) + 1);
}

console.log(`  Matchs déjà joués (conservés)     : ${joues}`);
console.log(`  Matchs à venir (à libérer)        : ${aVenir.length}\n`);
if (compte.size) {
  console.log('  Scores actuellement figés sur les matchs à venir :');
  for (const [s, n] of [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`     ${s.padEnd(6)} ${n}`);
  console.log('');
}

if (!LIBERER) { console.log('  SIMULATION. Relancez avec --liberer.\n'); process.exit(0); }

let n = 0;
for (let i = 0; i < aVenir.length; i += 100) {
  const lot = aVenir.slice(i, i + 100).map((p) => p.fixture_id);
  const { error: err } = await sb.from('predictions_match').delete().in('fixture_id', lot);
  if (err) console.log('  erreur :', err.message);
  else n += lot.length;
}
console.log(`  ${n} prédiction(s) libérée(s). Elles seront recalculées par le moteur corrigé.\n`);
