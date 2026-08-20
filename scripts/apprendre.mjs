/**
 * LA BOUCLE D'APPRENTISSAGE, EN TROIS TEMPS.
 *
 *   1. JUGER     — chaque rencontre terminée est confrontée à son pronostic.
 *   2. APPRENDRE — les verdicts d'un même championnat deviennent des facteurs.
 *   3. MESURER   — on vérifie que la correction améliore, au lieu de le croire.
 *
 * SUR QUOI ELLE S'APPUIE
 *
 * La PRÉDICTION DE RÉFÉRENCE (`predictions_match`), figée au premier calcul
 * complet — jamais un vote majoritaire, qui a déjà enterré la bonne réponse.
 * Le RÉSULTAT vient du fournisseur, pas de notre base : une vérification qui
 * relit ce qu'elle a elle-même écrit ne vérifie rien.
 *
 * Sans argument : simulation, rien n'est écrit.
 * Avec --ecrire : les jugements et les facteurs sont enregistrés.
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
const CLE_API = env.API_FOOTBALL_KEY;
const ECRIRE = process.argv.includes('--ecrire');

const FACTEUR_MIN = 0.8, FACTEUR_MAX = 1.25, MATCHS_MINIMUM = 30;
const borner = (v, a, b) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : 1);
const issueDe = (a, b) => (a > b ? 'domicile' : a === b ? 'nul' : 'exterieur');
const normaliser = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const brierDe = (p, reelle) => {
  const n = (v) => Math.min(1, Math.max(0, Number(v) / 100));
  const d = n(p.domicile), u = n(p.nul), e = n(p.exterieur);
  return (
    (d - (reelle === 'domicile' ? 1 : 0)) ** 2 +
    (u - (reelle === 'nul' ? 1 : 0)) ** 2 +
    (e - (reelle === 'exterieur' ? 1 : 0)) ** 2
  );
};

// ── 1. LES PRÉDICTIONS FIGÉES ──────────────────────────────────────────────
const { data: predictions, error } = await sb
  .from('predictions_match')
  .select('*')
  .order('calculee_le', { ascending: false })
  .limit(3000);

if (error) { console.log('Lecture impossible :', error.message); process.exit(1); }
console.log(`\n  ${predictions.length} prediction(s) de reference en base.`);

// ── 2. LES RÉSULTATS RÉELS, CHEZ LE FOURNISSEUR ────────────────────────────
const ids = predictions.map((p) => p.fixture_id).filter(Boolean);
const fiches = new Map();

if (!CLE_API) {
  console.log('  Cle API-Football absente : impossible de juger.');
  process.exit(1);
}

for (let i = 0; i < ids.length; i += 20) {
  const lot = ids.slice(i, i + 20).join('-');
  try {
    const r = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${lot}`, {
      headers: { 'x-apisports-key': CLE_API },
    });
    const j = await r.json();
    for (const f of j?.response ?? []) fiches.set(f.fixture.id, f);
  } catch (e) { console.log('  lot ignore :', e.message); }
}
console.log(`  ${fiches.size} fiche(s) recuperee(s) chez le fournisseur.`);

// ── 3. JUGER ───────────────────────────────────────────────────────────────
const TERMINE = ['FT', 'AET', 'PEN'];
const jugements = [];

for (const p of predictions) {
  const f = fiches.get(p.fixture_id);
  if (!f || !TERMINE.includes(f.fixture?.status?.short)) continue;

  const reelsDom = Number(f.goals?.home), reelsExt = Number(f.goals?.away);
  if (!Number.isFinite(reelsDom) || !Number.isFinite(reelsExt)) continue;

  // La prediction est stockee avec l equipe qui RECOIT en premier : elle est
  // donc deja dans le sens du fournisseur, aucune reorientation n est requise.
  const prevusDom = Number(p.buts_domicile), prevusExt = Number(p.buts_exterieur);
  const ip = issueDe(prevusDom, prevusExt), ir = issueDe(reelsDom, reelsExt);

  jugements.push({
    fixture_id: p.fixture_id,
    ligue: f.league?.name ?? null,
    date_match: f.fixture?.date ?? null,
    equipe_domicile: p.domicile_nom,
    equipe_exterieur: p.exterieur_nom,
    buts_prevus_domicile: prevusDom,
    buts_prevus_exterieur: prevusExt,
    proba_domicile: Number(p.proba_domicile),
    proba_nul: Number(p.proba_nul),
    proba_exterieur: Number(p.proba_exterieur),
    confiance: Number(p.confiance),
    buts_reels_domicile: reelsDom,
    buts_reels_exterieur: reelsExt,
    issue_prevue: ip,
    issue_reelle: ir,
    issue_juste: ip === ir,
    score_exact: prevusDom === reelsDom && prevusExt === reelsExt,
    brier: brierDe(
      { domicile: p.proba_domicile, nul: p.proba_nul, exterieur: p.proba_exterieur },
      ir
    ),
    juge_le: new Date().toISOString(),
  });
}

const justes = jugements.filter((j) => j.issue_juste).length;
const exacts = jugements.filter((j) => j.score_exact).length;
const brierMoyen = jugements.reduce((t, j) => t + j.brier, 0) / (jugements.length || 1);

console.log(`\n  ══ ETAT ACTUEL DU MOTEUR ══\n`);
console.log(`  Rencontres jugees : ${jugements.length}`);
console.log(`  Issues justes     : ${justes}  (${((100 * justes) / (jugements.length || 1)).toFixed(1)} %)`);
console.log(`  Scores exacts     : ${exacts}  (${((100 * exacts) / (jugements.length || 1)).toFixed(1)} %)`);
console.log(`  Score de Brier    : ${brierMoyen.toFixed(3)}   (plus bas = mieux calibre)`);

// ── 4. APPRENDRE ───────────────────────────────────────────────────────────
const parLigue = new Map();
for (const j of jugements) {
  const cle = normaliser(j.ligue);
  if (!cle) continue;
  const a = parLigue.get(cle) ?? {
    nom: j.ligue, n: 0, justes: 0, brier: 0,
    prevusDom: 0, prevusExt: 0, reelsDom: 0, reelsExt: 0,
  };
  a.n++;
  if (j.issue_juste) a.justes++;
  a.brier += j.brier;
  a.prevusDom += j.buts_prevus_domicile;
  a.prevusExt += j.buts_prevus_exterieur;
  a.reelsDom += j.buts_reels_domicile;
  a.reelsExt += j.buts_reels_exterieur;
  parLigue.set(cle, a);
}

console.log(`\n  ══ CE QUE LE MOTEUR APPREND, CHAMPIONNAT PAR CHAMPIONNAT ══\n`);
console.log(`  ${'championnat'.padEnd(30)} ${'n'.padStart(4)} ${'buts prevus'.padStart(12)} ${'buts reels'.padStart(11)} ${'facteur'.padStart(8)}  ${'justesse'.padStart(9)}  applique`);
console.log('  ' + '-'.repeat(94));

const facteurs = [];
for (const a of [...parLigue.values()].sort((x, y) => y.n - x.n)) {
  const prevus = a.prevusDom + a.prevusExt, reels = a.reelsDom + a.reelsExt;
  const fButs = prevus > 0 ? borner(reels / prevus, FACTEUR_MIN, FACTEUR_MAX) : 1;
  const fDom = a.prevusDom > 0 ? borner(a.reelsDom / (a.prevusDom * fButs), FACTEUR_MIN, FACTEUR_MAX) : 1;
  const fExt = a.prevusExt > 0 ? borner(a.reelsExt / (a.prevusExt * fButs), FACTEUR_MIN, FACTEUR_MAX) : 1;
  const justesse = Math.round((1000 * a.justes) / a.n) / 10;
  const actif = a.n >= MATCHS_MINIMUM;

  facteurs.push({ ...a, fButs, fDom, fExt, justesse, brier: a.brier / a.n, actif });

  console.log(
    `  ${String(a.nom).slice(0, 29).padEnd(30)} ${String(a.n).padStart(4)} ` +
    `${prevus.toFixed(0).padStart(12)} ${reels.toFixed(0).padStart(11)} ` +
    `${fButs.toFixed(3).padStart(8)}  ${(justesse + ' %').padStart(9)}  ${actif ? 'OUI' : `non (< ${MATCHS_MINIMUM})`}`
  );
}

// ── 5. L'EFFET DE LA CORRECTION, MESURÉ ────────────────────────────────────
//
// On rejoue chaque rencontre en appliquant le facteur de son championnat, et
// l on compare. Le facteur ne change pas l issue la plus probable dans la
// plupart des cas -- il deplace les buts attendus, donc le SCORE annonce et la
// calibration des probabilites. C est le score de Brier qui doit en profiter.
let brierApres = 0, exactsApres = 0;
for (const j of jugements) {
  const f = facteurs.find((x) => normaliser(x.nom) === normaliser(j.ligue));
  const fd = f?.actif ? f.fButs * f.fDom : 1;
  const fe = f?.actif ? f.fButs * f.fExt : 1;
  const nd = Math.round(j.buts_prevus_domicile * fd);
  const ne = Math.round(j.buts_prevus_exterieur * fe);
  if (nd === j.buts_reels_domicile && ne === j.buts_reels_exterieur) exactsApres++;
  brierApres += j.brier; // les probabilites ne changent pas dans ce rejeu
}

console.log(`\n  ══ EFFET MESURE SUR LES SCORES ANNONCES ══\n`);
console.log(`  Scores exacts AVANT : ${exacts}  (${((100 * exacts) / (jugements.length || 1)).toFixed(1)} %)`);
console.log(`  Scores exacts APRES : ${exactsApres}  (${((100 * exactsApres) / (jugements.length || 1)).toFixed(1)} %)`);
const ecart = exactsApres - exacts;
console.log(`  Ecart               : ${ecart >= 0 ? '+' : ''}${ecart} score(s) exact(s)\n`);

// ── LA MOYENNE CACHE DEUX POPULATIONS ──────────────────────────────────────
//
// Une coupe europeenne oppose deux equipes de championnats differents : le
// moteur n a aucun socle commun pour les comparer, et les forces qu il calcule
// ne sont pas sur la meme echelle. Melanger ces rencontres avec les
// championnats nationaux dans une moyenne unique ne dit rien de juste sur ni
// l un ni l autre -- et c est pourtant cette moyenne unique qu on regardait.
const EST_COUPE = (l) =>
  /uefa|conmebol|concacaf|cup|coupe|copa|trophy|trophee|friendl/i.test(String(l ?? ''));
const nationaux = jugements.filter((j) => !EST_COUPE(j.ligue));
const coupes = jugements.filter((j) => EST_COUPE(j.ligue));
const part = (l) =>
  l.length ? ((100 * l.filter((j) => j.issue_juste).length) / l.length).toFixed(1) : '—';
const brierMoy = (l) => (l.length ? (l.reduce((t, j) => t + j.brier, 0) / l.length).toFixed(3) : '—');

console.log(`  ══ LA MOYENNE CACHAIT DEUX POPULATIONS ══\n`);
console.log(`  Championnats nationaux : ${String(nationaux.length).padStart(3)} matchs  ->  ${part(nationaux)} % justes   Brier ${brierMoy(nationaux)}`);
console.log(`  Coupes et amicaux      : ${String(coupes.length).padStart(3)} matchs  ->  ${part(coupes)} % justes   Brier ${brierMoy(coupes)}`);
console.log(`  Reference « le domicile gagne toujours » : ${((100 * jugements.filter((j) => j.issue_reelle === 'domicile').length) / (jugements.length || 1)).toFixed(1)} %\n`);

if (!ECRIRE) {
  console.log('  SIMULATION. Relancez avec --ecrire pour enregistrer.\n');
  process.exit(0);
}

// ── 6. ÉCRITURE ────────────────────────────────────────────────────────────
let n = 0;
for (let i = 0; i < jugements.length; i += 100) {
  const { error: err } = await sb
    .from('jugements_moteur')
    .upsert(jugements.slice(i, i + 100), { onConflict: 'fixture_id' });
  if (err) console.log('  lot refuse :', err.message);
  else n += Math.min(100, jugements.length - i);
}
console.log(`  ${n} jugement(s) enregistre(s).`);

for (const f of facteurs) {
  const { data: existante } = await sb
    .from('calibrage_ligue').select('justesse_avant, brier_avant').eq('ligue', f.nom).maybeSingle();
  const { error: err } = await sb.from('calibrage_ligue').upsert(
    {
      ligue: f.nom,
      facteur_buts: f.fButs,
      facteur_domicile: f.fDom,
      facteur_exterieur: f.fExt,
      matchs_observes: f.n,
      justesse: f.justesse,
      brier: Math.round(f.brier * 1000) / 1000,
      justesse_avant: existante?.justesse_avant ?? f.justesse,
      brier_avant: existante?.brier_avant ?? Math.round(f.brier * 1000) / 1000,
      mis_a_jour_le: new Date().toISOString(),
    },
    { onConflict: 'ligue' }
  );
  if (err) console.log(`  ${f.nom} refuse :`, err.message);
}
console.log(`  ${facteurs.length} calibrage(s) enregistre(s).\n`);
