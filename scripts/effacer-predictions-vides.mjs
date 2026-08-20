/**
 * EFFACER LES PRÉDICTIONS NÉES DU VIDE.
 *
 * CE QUI S'EST PASSÉ
 *
 * Chaque rencontre reçoit UNE prédiction, figée au premier calcul complet, et
 * relue telle quelle par toutes les analyses suivantes. Ce mécanisme existe pour
 * qu'un abonné et un autre, à dix minutes d'intervalle, ne reçoivent pas deux
 * réponses contraires.
 *
 * Il a ici retourné son effet. Pendant la panne du 19-20 août, le fournisseur
 * renvoyait zéro statistique pour la saison 2026 qui venait de s'ouvrir. Le
 * moteur, privé de données, produisait sa valeur par défaut : 2-1, 44/27/29,
 * confiance 76. Ces prédictions ont été FIGÉES. Réparer la source ne suffit donc
 * pas : tant que ces lignes existent, elles sont resservies éternellement.
 *
 * CE QUE FAIT CE SCRIPT
 *
 * Il efface les prédictions reconnaissables à la signature exacte du calcul à
 * vide — jamais toutes les prédictions à 2-1. Un vrai 2-1 calculé sur de vraies
 * données porte d'autres probabilités et doit être conservé : c'est un pronostic
 * légitime, et le score le plus fréquent du football.
 *
 * Sans argument : simulation. Avec --effacer : suppression.
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

const EFFACER = process.argv.includes('--effacer');

const { data, error } = await sb
  .from('predictions_match')
  .select('*')
  .order('calculee_le', { ascending: false })
  .limit(5000);

if (error) { console.log('Lecture impossible :', error.message); process.exit(1); }

console.log(`\n  ${data.length} prédiction(s) figée(s) en base.\n`);

/**
 * La signature du calcul à vide.
 *
 * Mesurée en exécutant le moteur sans aucune statistique : 2-1, avec 44 % / 27 %
 * / 29 % à un point près et une confiance de 76. Les probabilités sont le
 * discriminant — un vrai 2-1 calculé sur des données réelles ne tombe jamais
 * exactement sur ce triplet.
 */
const nePeutVenirQueDuVide = (p) => {
  if (p.buts_domicile !== 2 || p.buts_exterieur !== 1) return false;
  const d = Math.round(Number(p.proba_domicile));
  const n = Math.round(Number(p.proba_nul));
  const e = Math.round(Number(p.proba_exterieur));
  const proche = (a, b) => Math.abs(a - b) <= 1;
  return proche(d, 44) && proche(n, 27) && proche(e, 29);
};

const suspectes = data.filter(nePeutVenirQueDuVide);
const vrais21 = data.filter((p) => p.buts_domicile === 2 && p.buts_exterieur === 1 && !nePeutVenirQueDuVide(p));

console.log(`  Prédictions 2-1 au total          : ${data.filter((p) => p.buts_domicile === 2 && p.buts_exterieur === 1).length}`);
console.log(`  Dont NÉES DU VIDE (44/27/29)      : ${suspectes.length}   <- à effacer`);
console.log(`  Dont 2-1 légitimes (autres probas): ${vrais21.length}   <- conservées\n`);

if (suspectes.length) {
  console.log('  Exemples de prédictions nées du vide :');
  for (const p of suspectes.slice(0, 12)) {
    console.log(`     ${p.domicile_nom} — ${p.exterieur_nom}  ${p.buts_domicile}-${p.buts_exterieur}  ` +
      `(${Math.round(p.proba_domicile)}/${Math.round(p.proba_nul)}/${Math.round(p.proba_exterieur)})  ${String(p.calculee_le).slice(0, 16)}`);
  }
  console.log('');
}

if (!EFFACER) {
  console.log('  SIMULATION. Relancez avec --effacer pour supprimer.\n');
  process.exit(0);
}

let n = 0;
for (let i = 0; i < suspectes.length; i += 100) {
  const lot = suspectes.slice(i, i + 100).map((p) => p.fixture_id);
  const { error: err } = await sb.from('predictions_match').delete().in('fixture_id', lot);
  if (err) console.log('  erreur sur un lot :', err.message);
  else n += lot.length;
}
console.log(`  ${n} prédiction(s) effacée(s). Elles seront recalculées sur de vraies données.\n`);
