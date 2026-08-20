/**
 * LA RÉSERVE SERT-ELLE DU VIDE ?
 *
 * Le 20 août 2026, toutes les analyses annonçaient 2-1 en moins de deux
 * secondes, sans consommer un centime d'IA. Le moteur, testé isolément, répond
 * exactement « 2-1, 44/27/29, confiance 76 » quand on ne lui donne AUCUNE
 * statistique. Les données n'arrivaient donc plus jusqu'à lui.
 *
 * La route d'analyse lit une réserve en base avant d'appeler le fournisseur.
 * Une réponse VIDE — `{ response: [] }`, renvoyée avec un code 200 les jours de
 * quota saturé — y était enregistrée comme n'importe quelle autre. Une fois en
 * réserve, elle était resservie à chaque analyse sans que le fournisseur soit
 * jamais rappelé. La panne se réparait donc toute seule... jamais.
 *
 * Ce script compte ces entrées vides, et les supprime avec --vider.
 * Sans argument : simulation, il ne touche à rien.
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

const VIDER = process.argv.includes('--vider');

const { data, error } = await sb
  .from('cache_api')
  .select('cle, contenu, expire_le')
  .like('cle', 'apifb:%')
  .limit(5000);

if (error) { console.log('Lecture impossible :', error.message); process.exit(1); }

console.log(`\n  ${data.length} entrée(s) de réserve « apifb: ».\n`);

const vides = [];
const pleines = [];
for (const l of data) {
  const c = l.contenu;
  const r = c?.response;
  const estVide = !c || (Array.isArray(r) && r.length === 0) || r === undefined;
  (estVide ? vides : pleines).push(l);
}

console.log(`  Avec contenu : ${pleines.length}`);
console.log(`  VIDES        : ${vides.length}`);

const maintenant = Date.now();
const videsVivantes = vides.filter((l) => new Date(l.expire_le).getTime() > maintenant);
console.log(`  Vides encore SERVIES (non expirées) : ${videsVivantes.length}\n`);

if (videsVivantes.length) {
  console.log('  Exemples de ce qui est servi à la place des statistiques :');
  for (const l of videsVivantes.slice(0, 15)) {
    const reste = Math.round((new Date(l.expire_le).getTime() - maintenant) / 60000);
    console.log(`     ${l.cle}   (encore ${reste} min)`);
  }
  console.log('');
}

if (!VIDER) {
  console.log('  SIMULATION. Relancez avec --vider pour supprimer les entrées vides.\n');
  process.exit(0);
}

let supprimees = 0;
for (let i = 0; i < vides.length; i += 100) {
  const lot = vides.slice(i, i + 100).map((l) => l.cle);
  const { error: err } = await sb.from('cache_api').delete().in('cle', lot);
  if (err) console.log('  erreur sur un lot :', err.message);
  else supprimees += lot.length;
}
console.log(`  ${supprimees} entrée(s) vide(s) supprimée(s). Le fournisseur sera rappelé.\n`);
