/**
 * L'entonnoir compté en PERSONNES, pas en clics.
 * Quelqu'un qui hésite entre deux offres clique deux fois : compter les clics
 * ferait paraître la fuite plus grande qu'elle n'est.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const lignes = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data, error } = await sb.from('visites_pages')
    .select('visite_id, chemin, entre_le')
    .like('chemin', '/~%')
    .gte('entre_le', new Date(Date.now() - 3 * 86400000).toISOString())
    .range(de, de + 999);
  if (error) { console.log('erreur: ' + error.message); break; }
  if (!data?.length) break; lignes.push(...data); if (data.length < 1000) break;
}

const parVisite = new Map();
for (const l of lignes) {
  const m = String(l.chemin).match(/^\/~([^/]+)(?:\/(.*))?$/);
  if (!m) continue;
  if (!parVisite.has(l.visite_id)) parVisite.set(l.visite_id, new Set());
  parVisite.get(l.visite_id).add(m[1]);
}

const aFait = (e) => [...parVisite.values()].filter((s) => s.has(e)).length;

const cliqueurs = [...parVisite.values()].filter((s) => s.has('offre-cliquee'));
const avecIssue = cliqueurs.filter(
  (s) => s.has('notice-continuer') || s.has('notice-fermee') || s.has('notice-auto') || s.has('depart-caisse')
);

console.log(`\n  ══ L'ENTONNOIR EN PERSONNES — 3 DERNIERS JOURS ══\n`);
console.log(`  ${String(cliqueurs.length).padStart(4)}  ont cliqué sur une offre`);
console.log(`  ${String(aFait('notice-continuer')).padStart(4)}  ont cliqué « Continuer »`);
console.log(`  ${String(aFait('notice-fermee')).padStart(4)}  ont fermé la notice`);
console.log(`  ${String(aFait('notice-auto')).padStart(4)}  ont laissé filer les 20 secondes`);
console.log(`  ${String(aFait('depart-caisse')).padStart(4)}  sont partis vers la caisse`);
console.log(`  ${String(aFait('echec-lien')).padStart(4)}  ont rencontré un lien cassé`);

const evapores = cliqueurs.length - avecIssue.length;
console.log(`\n  ${evapores} personnes (${Math.round(evapores / Math.max(1, cliqueurs.length) * 100)} %) ont cliqué sur une offre`);
console.log(`  puis n'ont RIEN fait : ni continuer, ni fermer, ni attendre.`);

// Combien sont partis en caisse sans jamais avoir cliqué « Continuer » ?
const caisseSansContinuer = cliqueurs.filter((s) => s.has('depart-caisse') && !s.has('notice-continuer')).length;
const continuerSansCaisse = cliqueurs.filter((s) => s.has('notice-continuer') && !s.has('depart-caisse')).length;
console.log(`\n  Contrôles de cohérence :`);
console.log(`  ${caisseSansContinuer} sont partis en caisse sans passer par « Continuer »`);
console.log(`  ${continuerSansCaisse} ont cliqué « Continuer » sans jamais atteindre la caisse`);
console.log('');
