import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Le filtre doit venir APRÈS le select, sinon `.not` n'existe pas encore.
const compter = async (construire) => {
  const { count } = await construire(sb.from('analysis_history').select('id', { count: 'exact', head: true }));
  return count ?? 0;
};

const total = await compter((q) => q);
const verifiees = await compter((q) => q.not('verified_at', 'is', null));
const enAttente = await compter((q) => q.is('verified_at', null).not('fixture_id', 'is', null));
const sansCompet = await compter((q) => q.is('competition', null));

console.log(`\n  ══ LA VÉRIFICATION DES PRONOSTICS ══\n`);
console.log(`  Analyses au total ......... ${total}`);
console.log(`  Déjà vérifiées ............ ${verifiees}`);
console.log(`  En attente de résultat .... ${enAttente}`);
console.log(`  Sans nom de compétition ... ${sansCompet}`);

const { data: etapes, error } = await sb.from('visites_pages')
  .select('chemin')
  .like('chemin', '/~%')
  .gte('entre_le', new Date(Date.now() - 3 * 86400000).toISOString())
  .limit(20000);

console.log(`\n  ══ L'ENTONNOIR DE VENTE — 3 DERNIERS JOURS ══\n`);
if (error) {
  console.log('  Lecture impossible : ' + error.message);
} else {
  const parEtape = new Map();
  for (const e of etapes ?? []) {
    const m = String(e.chemin).match(/^\/~([^/]+)/);
    if (!m) continue;
    parEtape.set(m[1], (parEtape.get(m[1]) ?? 0) + 1);
  }
  if (!parEtape.size) console.log('  Aucune étape enregistrée.');
  else {
    const ordre = ['offre-cliquee', 'notice-continuer', 'notice-auto', 'notice-fermee', 'depart-caisse', 'echec-lien'];
    for (const c of ordre) if (parEtape.has(c)) console.log(`  ${String(parEtape.get(c)).padStart(5)}  ${c}`);
    for (const [c, n] of parEtape) if (!ordre.includes(c)) console.log(`  ${String(n).padStart(5)}  ${c}`);
  }
}
console.log('');
