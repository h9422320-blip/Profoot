/**
 * LES CINQ DERNIERS JOURS, MATCH PAR MATCH.
 *
 * CE QUE CE SCRIPT RÉPOND
 *
 * Pour chaque rencontre analysée par l'application dans les cinq derniers jours
 * ET déjà jouée : quel pronostic l'application a réellement émis, quel a été le
 * résultat, si le pronostic était juste, et s'il figure ou non sur le mur
 * public.
 *
 * SUR QUOI IL S'APPUIE
 *
 * La PRÉDICTION DE RÉFÉRENCE (`predictions_match`), figée au premier calcul
 * complet — jamais un vote majoritaire, qui a déjà enterré la bonne réponse sur
 * Lens — Paris Saint-Germain. Le résultat vient du fournisseur, pas de la base :
 * une vérification qui relit ce qu'elle a elle-même écrit ne vérifie rien.
 *
 * LECTURE SEULE. Ce script ne publie rien, ne corrige rien, n'écrit nulle part.
 * Il sert à voir ce qui est, avant de décider quoi que ce soit.
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

const CLE_API = env.API_FOOTBALL_KEY || env.NEXT_PUBLIC_API_FOOTBALL_KEY || env.APIFOOTBALL_KEY;
const JOURS = Number(process.argv[2] || 5);

/** Les clubs qu'un amateur reconnaît sans réfléchir — pour le classement. */
const GRANDS = [
  'barcelona', 'barcelone', 'real madrid', 'paris saint', 'psg', 'manchester city',
  'manchester united', 'liverpool', 'bayern', 'arsenal', 'chelsea', 'juventus',
  'inter', 'milan', 'atletico', 'atlético', 'tottenham', 'dortmund', 'napoli',
  'marseille', 'monaco', 'lyon', 'benfica', 'porto', 'ajax', 'sevilla', 'séville',
];

const estGrand = (a, b) => {
  const nom = `${a} ${b}`.toLowerCase();
  return GRANDS.filter((g) => nom.includes(g)).length;
};

const lireScore = (s) => {
  const m = String(s ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const issue = (a, b) => (a > b ? 'team1' : b > a ? 'team2' : 'draw');
const memeEquipe = (a, b) => {
  const n = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = n(a), y = n(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

const depuis = new Date(Date.now() - JOURS * 86400000).toISOString();

console.log(`\n  LES ${JOURS} DERNIERS JOURS — analyses depuis le ${depuis.slice(0, 10)}\n`);

// ── 1. Toutes les analyses de la période ────────────────────────────────────
const { data: analyses, error } = await sb
  .from('analysis_history')
  .select('fixture_id, team1_name, team2_name, competition, score, real_score, ' +
          'winner_correct, score_correct, verified_at, created_at')
  .gte('created_at', depuis)
  .order('created_at', { ascending: false })
  .limit(5000);

if (error) { console.log('  Lecture impossible :', error.message); process.exit(1); }
console.log(`  ${analyses.length} analyse(s) enregistrée(s) sur la période.`);

// ── 2. Une ligne par rencontre ──────────────────────────────────────────────
const parMatch = new Map();
for (const a of analyses) {
  if (!a.fixture_id) continue;
  const cle = `f${a.fixture_id}`;
  if (!parMatch.has(cle)) parMatch.set(cle, { ...a, analyses: 0 });
  parMatch.get(cle).analyses++;
}
console.log(`  ${parMatch.size} rencontre(s) distincte(s) avec identifiant.\n`);

// ── 3. Les prédictions de référence ─────────────────────────────────────────
const ids = [...parMatch.values()].map((m) => m.fixture_id);
const figees = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb
    .from('predictions_match')
    .select('fixture_id, domicile_nom, buts_domicile, buts_exterieur')
    .in('fixture_id', ids.slice(i, i + 200));
  for (const p of data ?? []) figees.set(p.fixture_id, p);
}

// ── 4. Les résultats réels, chez le fournisseur ─────────────────────────────
const fiches = new Map();
if (CLE_API) {
  for (let i = 0; i < ids.length; i += 20) {
    const lot = ids.slice(i, i + 20).join('-');
    try {
      const r = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${lot}`, {
        headers: { 'x-apisports-key': CLE_API },
      });
      const j = await r.json();
      for (const f of j?.response ?? []) fiches.set(f.fixture.id, f);
    } catch (e) { console.log('  fournisseur muet sur un lot :', e.message); }
  }
} else {
  console.log('  ⚠ Clé API-Football absente : on se rabat sur les résultats déjà en base.\n');
}

// ── 5. L'état du mur public ─────────────────────────────────────────────────
const { data: preuves } = await sb.from('preuves').select('*').in('fixture_id', ids);
const surLeMur = new Map((preuves ?? []).map((p) => [p.fixture_id, p]));

// ── 6. Le verdict, rencontre par rencontre ──────────────────────────────────
const lignes = [];
for (const m of parMatch.values()) {
  const f = fiches.get(m.fixture_id);
  const statut = f?.fixture?.status?.short ?? null;
  const joue = statut ? ['FT', 'AET', 'PEN'].includes(statut) : !!m.real_score;

  const reelsF = f ? [f.goals?.home, f.goals?.away] : null;
  const reels = reelsF && reelsF[0] != null ? reelsF : lireScore(m.real_score);

  // Le résultat du fournisseur est dans le sens domicile — extérieur ; la carte
  // garde l'ordre de saisie. On remet dans le sens de la carte.
  let reelsCarte = reels;
  if (f && reels) {
    reelsCarte = memeEquipe(m.team1_name, f.teams?.home?.name) ? reels : [reels[1], reels[0]];
  }

  const fig = figees.get(m.fixture_id);
  let prono = null;
  if (fig) {
    prono = memeEquipe(m.team1_name, fig.domicile_nom)
      ? [fig.buts_domicile, fig.buts_exterieur]
      : [fig.buts_exterieur, fig.buts_domicile];
  } else {
    prono = lireScore(m.score);
  }

  const ip = prono ? issue(prono[0], prono[1]) : null;
  const ir = reelsCarte ? issue(reelsCarte[0], reelsCarte[1]) : null;
  const juste = !!ip && !!ir && ip === ir;
  const exact = juste && prono[0] === reelsCarte[0] && prono[1] === reelsCarte[1];

  const p = surLeMur.get(m.fixture_id);

  lignes.push({
    id: m.fixture_id,
    e1: m.team1_name, e2: m.team2_name,
    competition: f?.league?.name ?? m.competition ?? '—',
    date: f?.fixture?.date ?? m.created_at,
    joue, statut: statut ?? (m.real_score ? 'en base' : 'non joué'),
    prono: prono ? `${prono[0]} - ${prono[1]}` : '—',
    sourceProno: fig ? 'référence' : 'analyse',
    reel: reelsCarte ? `${reelsCarte[0]} - ${reelsCarte[1]}` : '—',
    juste, exact,
    dansTable: !!p,
    publiee: !!p?.publiee,
    masquee: p?.masquee_par_admin === true,
    grand: estGrand(m.team1_name, m.team2_name),
    analyses: m.analyses,
  });
}

// ── 7. Affichage : grands clubs d'abord, puis le plus récent ────────────────
const joues = lignes.filter((l) => l.joue);
const pasJoues = lignes.filter((l) => !l.joue);

joues.sort((a, b) => {
  if (a.grand !== b.grand) return b.grand - a.grand;
  return String(b.date).localeCompare(String(a.date));
});

const ligne = (l) => {
  const v = l.juste ? (l.exact ? 'JUSTE + SCORE EXACT' : 'JUSTE') : 'FAUX';
  const pub = l.publiee ? 'PUBLIÉ' : l.dansTable ? (l.masquee ? 'retiré à la main' : 'non publié') : 'ABSENT DE LA TABLE';
  const etoile = l.grand ? ' ★'.repeat(Math.min(l.grand, 2)) : '';
  console.log(`  ${String(l.date).slice(0, 10)}  ${l.e1} — ${l.e2}${etoile}`);
  console.log(`      ${l.competition}   (${l.analyses} analyse${l.analyses > 1 ? 's' : ''}, prono ${l.sourceProno})`);
  console.log(`      pronostic ${l.prono}   →   résultat ${l.reel}   =   ${v}`);
  console.log(`      mur public : ${pub}\n`);
};

console.log('══════════ MATCHS JOUÉS ══════════\n');
if (!joues.length) console.log('  Aucun match joué sur la période.\n');
joues.forEach(ligne);

const justes = joues.filter((l) => l.juste);
const manquants = justes.filter((l) => !l.publiee);
const aTort = joues.filter((l) => !l.juste && l.publiee);

console.log('══════════ BILAN ══════════\n');
console.log(`  Matchs joués          : ${joues.length}`);
console.log(`  Pronostics justes     : ${justes.length}`);
console.log(`  Dont score exact      : ${justes.filter((l) => l.exact).length}`);
console.log(`  Ratés                 : ${joues.length - justes.length}`);
console.log(`  Justes DÉJÀ publiés   : ${justes.filter((l) => l.publiee).length}`);
console.log(`  Justes NON publiés    : ${manquants.length}`);
console.log(`  Ratés publiés à tort  : ${aTort.length}`);

if (manquants.length) {
  console.log(`\n  ⚠ RÉUSSITES ABSENTES DU MUR :`);
  for (const l of manquants)
    console.log(`     ${l.e1} — ${l.e2}  (${l.prono} → ${l.reel})  ${l.dansTable ? (l.masquee ? 'retirée à la main' : 'en table, non publiée') : 'jamais entrée en table'}`);
}
if (aTort.length) {
  console.log(`\n  ⚠ RATÉS VISIBLES EN PUBLIC :`);
  for (const l of aTort) console.log(`     ${l.e1} — ${l.e2}  (${l.prono} → ${l.reel})`);
}

if (pasJoues.length) {
  console.log(`\n══════════ PAS ENCORE JOUÉS (${pasJoues.length}) ══════════\n`);
  for (const l of pasJoues)
    console.log(`  ${String(l.date).slice(0, 10)}  ${l.e1} — ${l.e2}  [${l.statut}]  prono ${l.prono}`);
}
console.log('');
