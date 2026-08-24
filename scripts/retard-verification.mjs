/**
 * Le retard grandit-il, et de combien par jour ?
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const lire = async (colonnes, filtre) => {
  const tout = [];
  for (let de = 0; de < 60000; de += 1000) {
    let q = sb.from('analysis_history').select(colonnes).range(de, de + 999);
    q = filtre(q);
    const { data, error } = await q;
    if (error) { console.log('erreur: ' + error.message); break; }
    if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
  }
  return tout;
};

const creees = await lire('created_at, fixture_id, verified_at', (q) => q.order('created_at', { ascending: true }));
console.log(`\n  ${creees.length} analyses lues.\n`);

const jour = (d) => String(d ?? '').slice(0, 10);
const produites = new Map(), verifiees = new Map();
for (const a of creees) {
  if (a.created_at) produites.set(jour(a.created_at), (produites.get(jour(a.created_at)) ?? 0) + 1);
  if (a.verified_at) verifiees.set(jour(a.verified_at), (verifiees.get(jour(a.verified_at)) ?? 0) + 1);
}

const jours = [...new Set([...produites.keys(), ...verifiees.keys()])].sort().slice(-14);
console.log('  ══ PRODUCTION CONTRE VÉRIFICATION, PAR JOUR ══\n');
console.log('  jour         produites   verifiees   retard du jour');
let cumul = 0;
for (const j of jours) {
  const p = produites.get(j) ?? 0, v = verifiees.get(j) ?? 0;
  cumul += p - v;
  const signe = p - v > 0 ? '+' : '';
  console.log(`  ${j}   ${String(p).padStart(9)}   ${String(v).padStart(9)}   ${signe}${String(p - v).padStart(6)}`);
}

// Combien attendent, et depuis combien de temps ?
const enAttente = creees.filter((a) => !a.verified_at && a.fixture_id);
console.log(`\n  ══ CE QUI ATTEND ══\n`);
console.log(`  ${enAttente.length} analyses en attente avec un identifiant de match.`);
const sansFixture = creees.filter((a) => !a.verified_at && !a.fixture_id).length;
console.log(`  ${sansFixture} analyses sans identifiant de match — invérifiables en l'état.`);

const ages = enAttente.map((a) => (Date.now() - Date.parse(a.created_at)) / 86400000).sort((x, y) => x - y);
if (ages.length) {
  const p = (q) => Math.round(ages[Math.floor(ages.length * q)] * 10) / 10;
  console.log(`\n  Âge des analyses en attente :`);
  console.log(`  la plus récente ${p(0)} j · médiane ${p(0.5)} j · la plus vieille ${Math.round(ages[ages.length - 1] * 10) / 10} j`);
  const vieilles = ages.filter((a) => a > 3).length;
  console.log(`  ${vieilles} attendent depuis plus de 3 jours — leur match est fini depuis longtemps.`);
}
console.log('');
