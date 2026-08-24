/**
 * L'entonnoir, séparé par offre.
 *
 * « vers-tarifs » n'est PAS un clic sur une offre : c'est le bouton du paywall
 * qui envoie voir la page des tarifs, sans notice ni caisse. Le confondre avec
 * un vrai clic d'achat faisait apparaître une fuite de 49 % qui n'existe pas.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const depuis = new Date(Date.now() - 3 * 86400000).toISOString();
const lignes = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('visites_pages')
    .select('visite_id, chemin, entre_le')
    .like('chemin', '/~%')
    .gte('entre_le', depuis)
    .order('entre_le', { ascending: true })
    .range(de, de + 999);
  if (!data?.length) break; lignes.push(...data); if (data.length < 1000) break;
}

const decoupe = (chemin) => {
  const m = String(chemin).match(/^\/~([^/]+)(?:\/(.+))?$/);
  return m ? { etape: m[1], offre: m[2] ?? '(sans offre)' } : null;
};

// Par visite ET par offre : quelqu'un qui hésite entre deux abonnements suit
// deux parcours distincts, il ne faut pas les fondre.
const parcours = new Map();
for (const l of lignes) {
  const d = decoupe(l.chemin);
  if (!d) continue;
  const cle = `${l.visite_id}|${d.offre}`;
  if (!parcours.has(cle)) parcours.set(cle, new Set());
  parcours.get(cle).add(d.etape);
}

const parOffre = new Map();
for (const [cle, etapes] of parcours) {
  const offre = cle.split('|')[1];
  if (!parOffre.has(offre)) parOffre.set(offre, []);
  parOffre.get(offre).push(etapes);
}

console.log(`\n  ══ L'ENTONNOIR, OFFRE PAR OFFRE — 3 DERNIERS JOURS ══\n`);
const compte = (l, e) => l.filter((s) => s.has(e)).length;

for (const [offre, liste] of [...parOffre].sort((a, b) => b[1].length - a[1].length)) {
  const clics = compte(liste, 'offre-cliquee');
  if (!clics) continue;
  const cont = compte(liste, 'notice-continuer');
  const ferm = compte(liste, 'notice-fermee');
  const auto = compte(liste, 'notice-auto');
  const caisse = compte(liste, 'depart-caisse');
  const echec = compte(liste, 'echec-lien');
  const sansIssue = liste.filter(
    (s) => s.has('offre-cliquee') && !s.has('notice-continuer') && !s.has('notice-fermee') && !s.has('notice-auto') && !s.has('depart-caisse')
  ).length;

  const pct = (n) => String(Math.round((n / clics) * 100)).padStart(3) + ' %';
  console.log(`  ── ${offre} ──`);
  console.log(`  ${String(clics).padStart(4)}  ont cliqué`);
  if (offre === 'vers-tarifs') {
    console.log(`        (ce bouton mène à la page des tarifs, sans notice : pas d'issue attendue)\n`);
    continue;
  }
  console.log(`  ${String(cont).padStart(4)}  ${pct(cont)}  ont cliqué « Continuer »`);
  console.log(`  ${String(auto).padStart(4)}  ${pct(auto)}  ont laissé filer les 20 secondes`);
  console.log(`  ${String(ferm).padStart(4)}  ${pct(ferm)}  ont fermé`);
  console.log(`  ${String(sansIssue).padStart(4)}  ${pct(sansIssue)}  sont partis sans rien faire`);
  console.log(`  ${String(caisse).padStart(4)}  ${pct(caisse)}  sont arrivés en caisse`);
  if (echec) console.log(`  ${String(echec).padStart(4)}  ${pct(echec)}  ont rencontré un lien cassé`);
  console.log('');
}
