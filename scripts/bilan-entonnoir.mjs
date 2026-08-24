/**
 * BILAN — L'ENTONNOIR ET LE COMPORTEMENT, SUR LES VRAIES DONNÉES.
 *
 * Diagnostic seul. Rien n'est écrit, rien n'est corrigé.
 *
 * Tout ce qui sort d'ici vient de trois sources et d'aucune supposition :
 *   — `visites_pages`, la mesure maison (pages vues, durées, étapes de vente) ;
 *   — `subscriptions` et `analysis_usage`, ce que les comptes ont payé et fait ;
 *   — la boutique Chariow, seule source qui fasse foi pour l'argent.
 *
 * Quand une donnée n'existe pas, on l'écrit noir sur blanc plutôt que de
 * combler le trou.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });

const lireTout = async (table, colonnes, filtrer = (q) => q) => {
  const tout = [];
  for (let de = 0; de < 80000; de += 1000) {
    const { data, error } = await filtrer(sb.from(table).select(colonnes)).range(de, de + 999);
    if (error) { console.log(`  [erreur ${table}] ${error.message}`); break; }
    if (!data?.length) break;
    tout.push(...data);
    if (data.length < 1000) break;
  }
  return tout;
};

const pc = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const titre = (t) => console.log(`\n${'═'.repeat(74)}\n  ${t}\n${'═'.repeat(74)}\n`);

// ══════════════════════════════════════════════════════════════════════════
titre('1. L ENTONNOIR, MARCHE PAR MARCHE');

const JOURS = 7;
const depuis = new Date(Date.now() - JOURS * 86400000).toISOString();

const visites = await lireTout('visites_pages', 'visite_id, chemin, entre_le, duree_ms, ordre, pays, mobile, compte_id', (q) =>
  q.gte('entre_le', depuis).order('entre_le', { ascending: true })
);
console.log(`  ${visites.length} lignes de mesure sur ${JOURS} jours (depuis le ${depuis.slice(0, 10)}).`);

const parVisite = new Map();
for (const v of visites) {
  if (!parVisite.has(v.visite_id)) parVisite.set(v.visite_id, []);
  parVisite.get(v.visite_id).push(v);
}
console.log(`  ${parVisite.size} visites distinctes.\n`);

const etapeDe = (c) => (String(c).startsWith('/~') ? String(c).slice(2).split('/')[0] : null);
const offreDe = (c) => {
  const m = String(c).match(/^\/~[^/]+\/(.+)$/);
  return m ? m[1] : null;
};

/** Combien de VISITES distinctes ont fait au moins une fois telle chose. */
const visitesQui = (predicat) => {
  let n = 0;
  for (const [, l] of parVisite) if (l.some(predicat)) n++;
  return n;
};

const total = parVisite.size;
const vuTarifs = visitesQui((v) => v.chemin === '/pricing');
const vuAnalyse = visitesQui((v) => v.chemin === '/analyze');
const versTarifs = visitesQui((v) => etapeDe(v.chemin) === 'vers-tarifs');
const clicOffre = visitesQui((v) => etapeDe(v.chemin) === 'offre-cliquee');
const continuer = visitesQui((v) => etapeDe(v.chemin) === 'notice-continuer');
const auto = visitesQui((v) => etapeDe(v.chemin) === 'notice-auto');
const ferme = visitesQui((v) => etapeDe(v.chemin) === 'notice-fermee');
const caisse = visitesQui((v) => etapeDe(v.chemin) === 'depart-caisse');
const echec = visitesQui((v) => etapeDe(v.chemin) === 'echec-lien');

const marche = (nom, n, refN) => {
  const part = refN ? pc(n, refN) : null;
  const perdus = refN ? refN - n : 0;
  console.log(
    `  ${String(n).padStart(6)}  ${nom.padEnd(42)}` +
    (part === null ? '' : `${String(part).padStart(6)} %` + (perdus > 0 ? `   −${perdus}` : ''))
  );
};

console.log('  nombre  marche                                        passe   perdus');
console.log('  ' + '─'.repeat(70));
marche('visites sur le site', total, null);
marche('ont ouvert la page Tarifs', vuTarifs, total);
marche('ont ouvert une page d analyse', vuAnalyse, total);
console.log('  ' + '·'.repeat(70));
marche('ont cliqué sur une offre (notice ouverte)', clicOffre, vuTarifs + vuAnalyse);
marche('   dont : ont cliqué « Continuer »', continuer, clicOffre);
marche('   dont : partis seuls après 20 s', auto, clicOffre);
marche('   dont : ont fermé la notice', ferme, clicOffre);
console.log('  ' + '·'.repeat(70));
marche('sont partis vers la caisse Chariow', caisse, clicOffre);
if (echec) marche('ont rencontré un lien de paiement cassé', echec, clicOffre);
console.log(`\n  (« vers-tarifs » : ${versTarifs} visites ont cliqué le bouton du paywall qui`);
console.log('   mène à la page Tarifs. Ce n est PAS un clic d achat : aucune notice ne');
console.log('   s ouvre, aucune caisse au bout.)');

// ── Par porte et par produit ────────────────────────────────────────────
titre('1b. PAR PORTE D ACHAT ET PAR PRODUIT');

const parcours = new Map();
for (const v of visites) {
  const e = etapeDe(v.chemin);
  if (!e || e === 'vers-tarifs') continue;
  const offre = offreDe(v.chemin) ?? '(sans offre)';
  const cle = `${v.visite_id}|${offre}`;
  if (!parcours.has(cle)) parcours.set(cle, new Set());
  parcours.get(cle).add(e);
}
const parOffre = new Map();
for (const [cle, etapes] of parcours) {
  const offre = cle.split('|')[1];
  if (!parOffre.has(offre)) parOffre.set(offre, []);
  parOffre.get(offre).push(etapes);
}

console.log('  offre                  clics  continuer   auto   fermé   caisse   → caisse');
console.log('  ' + '─'.repeat(72));
for (const [offre, liste] of [...parOffre].sort((a, b) => b[1].length - a[1].length)) {
  const c = (e) => liste.filter((s) => s.has(e)).length;
  const clics = c('offre-cliquee');
  if (!clics) continue;
  console.log(
    `  ${offre.padEnd(22)} ${String(clics).padStart(5)} ${String(c('notice-continuer')).padStart(10)}` +
    ` ${String(c('notice-auto')).padStart(6)} ${String(c('notice-fermee')).padStart(7)}` +
    ` ${String(c('depart-caisse')).padStart(8)} ${String(pc(c('depart-caisse'), clics)).padStart(8)} %`
  );
}
const sansOffre = parOffre.get('(sans offre)');
if (sansOffre?.length) {
  console.log('\n  Les sorties de notice sans nom d offre viennent des analyses faites AVANT');
  console.log('  le correctif du 24 août. Elles se rattacheront d elles-mêmes ensuite.');
}

// ══════════════════════════════════════════════════════════════════════════
titre('2. OU LES GENS PASSENT, ET OU ILS S ARRETENT');

const pages = new Map();
for (const v of visites) {
  if (String(v.chemin).startsWith('/~')) continue;
  const c = String(v.chemin);
  if (!pages.has(c)) pages.set(c, { vues: 0, duree: 0, avecDuree: 0, arrivees: 0, sorties: 0 });
  const p = pages.get(c);
  p.vues++;
  if (v.duree_ms > 0) { p.duree += v.duree_ms; p.avecDuree++; }
  if (Number(v.ordre) === 1) p.arrivees++;
}
for (const [, l] of parVisite) {
  const vraies = l.filter((v) => !String(v.chemin).startsWith('/~'));
  if (!vraies.length) continue;
  const derniere = vraies[vraies.length - 1];
  const p = pages.get(String(derniere.chemin));
  if (p) p.sorties++;
}

console.log('  vues   temps moyen   arrivées   sorties   taux sortie   page');
console.log('  ' + '─'.repeat(72));
for (const [c, p] of [...pages].sort((a, b) => b[1].vues - a[1].vues).slice(0, 12)) {
  const t = p.avecDuree ? Math.round(p.duree / p.avecDuree / 1000) : null;
  console.log(
    `  ${String(p.vues).padStart(5)} ${String(t === null ? '—' : t + ' s').padStart(12)}` +
    ` ${String(p.arrivees).padStart(9)} ${String(p.sorties).padStart(9)}` +
    ` ${String(pc(p.sorties, p.vues)).padStart(11)} %   ${c.slice(0, 28)}`
  );
}

// ── Mobile / ordinateur, et pays ────────────────────────────────────────
let mob = 0, ordi = 0;
const paysVisites = new Map();
for (const [, l] of parVisite) {
  if (l[0].mobile === true) mob++; else ordi++;
  const p = l.find((x) => x.pays)?.pays ?? '(inconnu)';
  paysVisites.set(p, (paysVisites.get(p) ?? 0) + 1);
}
console.log(`\n  Téléphone ${mob} visites (${pc(mob, mob + ordi)} %) · Ordinateur ${ordi} (${pc(ordi, mob + ordi)} %)\n`);

const clicParSupport = { mobile: 0, ordi: 0 };
const caisseParSupport = { mobile: 0, ordi: 0 };
for (const [, l] of parVisite) {
  const surMobile = l[0].mobile === true;
  if (l.some((v) => etapeDe(v.chemin) === 'offre-cliquee')) clicParSupport[surMobile ? 'mobile' : 'ordi']++;
  if (l.some((v) => etapeDe(v.chemin) === 'depart-caisse')) caisseParSupport[surMobile ? 'mobile' : 'ordi']++;
}
console.log('  support        visites   clics offre   caisse   clic→caisse');
console.log('  ' + '─'.repeat(60));
console.log(`  Téléphone   ${String(mob).padStart(10)} ${String(clicParSupport.mobile).padStart(13)} ${String(caisseParSupport.mobile).padStart(8)} ${String(pc(caisseParSupport.mobile, clicParSupport.mobile)).padStart(12)} %`);
console.log(`  Ordinateur  ${String(ordi).padStart(10)} ${String(clicParSupport.ordi).padStart(13)} ${String(caisseParSupport.ordi).padStart(8)} ${String(pc(caisseParSupport.ordi, clicParSupport.ordi)).padStart(12)} %`);

console.log('\n  ══ PAR PAYS (visites, puis clics sur une offre) ══\n');
const clicPays = new Map();
for (const [, l] of parVisite) {
  if (!l.some((v) => etapeDe(v.chemin) === 'offre-cliquee')) continue;
  const p = l.find((x) => x.pays)?.pays ?? '(inconnu)';
  clicPays.set(p, (clicPays.get(p) ?? 0) + 1);
}
console.log('  pays   visites   ont cliqué une offre   taux');
console.log('  ' + '─'.repeat(52));
for (const [p, n] of [...paysVisites].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const c = clicPays.get(p) ?? 0;
  console.log(`  ${String(p).padEnd(7)}${String(n).padStart(7)} ${String(c).padStart(21)} ${String(pc(c, n)).padStart(7)} %`);
}

console.log('\n  DONNÉE ABSENTE : clics de rage, clics morts, retours rapides.');
console.log('  La mesure maison enregistre les pages et les étapes de vente, pas les');
console.log('  gestes dans la page. Microsoft Clarity les a, mais son interface seule —');
console.log('  la lecture par page n a jamais fonctionné par son API.');
