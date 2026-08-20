/**
 * LE MUR DE PREUVES DIT-IL LA VÉRITÉ ? — CONTRÔLE SUR CINQ JOURS
 *
 * CE QUE CE SCRIPT RÉPOND
 *
 * Pour chaque rencontre analysée par l'application ces cinq derniers jours ET
 * déjà jouée : quel pronostic l'application a-t-elle réellement émis, quel a
 * été le résultat, le pronostic était-il juste, et la carte est-elle en ligne.
 *
 * LE PRONOSTIC RETENU EST LA PRÉDICTION DE RÉFÉRENCE, PAS UNE MAJORITÉ
 *
 * Une même rencontre est analysée des dizaines de fois. Compter les avis et
 * garder le plus fréquent revient à laisser une panne du fournisseur décider :
 * c'est ainsi que Lens — Paris Saint-Germain a été publié à l'envers, trente-six
 * analyses incomplètes ayant enterré les quatre bonnes.
 *
 * On lit donc `predictions_match` — la prédiction figée au premier calcul
 * complet, celle qui savait qui recevait. Le vote majoritaire n'est utilisé
 * qu'en dernier recours, pour les rencontres antérieures à ce mécanisme, et le
 * rapport le signale explicitement.
 *
 * LE SENS DE LECTURE
 *
 * La prédiction est stockée avec l'équipe qui REÇOIT en premier ; la carte
 * garde l'ordre de saisie de l'utilisateur. Tout est ramené dans le sens de la
 * carte avant comparaison — sans quoi « 1 - 0 » désigne un vainqueur ou son
 * adversaire selon l'humeur du classement.
 *
 * LECTURE SEULE. Ce script ne modifie rien : il constate.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const JOURS = Number(process.argv[2] ?? 5);

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Outils de lecture des scores ────────────────────────────────────────────
const lireScore = (s) => {
  const m = String(s ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const issue = (a, b) => (a > b ? 'team1' : b > a ? 'team2' : 'draw');
const normaliser = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * L'identifiant de l'équipe, lu dans l'URL de son logo.
 *
 * COMPARER LES NOMS NE MARCHE PAS, ET LA PREMIÈRE VERSION DE CE SCRIPT L'A
 * APPRIS DE LA PIRE FAÇON.
 *
 * L'application enregistre « FC Barcelone » ; le fournisseur répond
 * « Barcelona ». Ni l'un ne contient l'autre. Le rapprochement échouait donc,
 * le résultat était retourné, et Barcelone — Al Ahly (2-1, pronostic 3-1, une
 * réussite) était déclaré RATÉ par le contrôle censé vérifier le mur.
 *
 * L'URL du logo, elle, porte le numéro de l'équipe chez le fournisseur :
 * `…/teams/529.png`. C'est le même repère des deux côtés, et il ne dépend
 * d'aucune traduction.
 */
const idDuLogo = (url) => {
  const m = String(url ?? '').match(/teams\/(\d+)\.png/);
  return m ? m[1] : null;
};

const memeEquipe = (a, b) => {
  const x = normaliser(a), y = normaliser(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

// ── 1. Les analyses des N derniers jours ────────────────────────────────────
const depuis = new Date(Date.now() - JOURS * 86400000).toISOString();

// Supabase plafonne une réponse à mille lignes : sans pagination, un contrôle
// « complet » n'aurait porté que sur la moitié des analyses — et aurait donc
// certifié comme absents des matchs simplement jamais lus.
const analyses = [];
for (let page = 0; page < 20; page++) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('fixture_id, team1_name, team2_name, team1_logo, team2_logo, competition, ' +
            'score, real_score, winner_correct, score_correct, verified_at, created_at')
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .range(page * 1000, page * 1000 + 999);
  if (error) { console.error('Lecture impossible :', error.message); process.exit(1); }
  analyses.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

console.log(`\nAnalyses des ${JOURS} derniers jours : ${analyses.length}`);

// ── 2. Une ligne par rencontre ──────────────────────────────────────────────
const parMatch = new Map();
for (const l of analyses) {
  if (!l.fixture_id) continue;                    // sans identifiant, pas de résultat vérifiable
  const cle = `f${l.fixture_id}`;
  const m = parMatch.get(cle) ?? {
    fixtureId: l.fixture_id,
    equipe1: l.team1_name,
    equipe2: l.team2_name,
    logo1: l.team1_logo,
    competition: l.competition,
    analyses: 0,
    votes: new Map(),
    premiereAnalyse: l.created_at,
    verifiee: false,
  };
  m.analyses++;
  if (l.verified_at) m.verifiee = true;
  if (l.created_at < m.premiereAnalyse) m.premiereAnalyse = l.created_at;

  // Chaque score est remis dans le sens de la PREMIÈRE ligne rencontrée.
  const memeSens = normaliser(l.team1_name) === normaliser(m.equipe1);
  const lu = lireScore(l.score);
  const oriente = lu ? (memeSens ? `${lu[0]} - ${lu[1]}` : `${lu[1]} - ${lu[0]}`) : null;
  if (oriente) m.votes.set(oriente, (m.votes.get(oriente) ?? 0) + 1);

  parMatch.set(cle, m);
}
console.log(`Rencontres distinctes : ${parMatch.size}`);

// ── 3. La prédiction de référence de chaque rencontre ────────────────────────
const ids = [...parMatch.values()].map((m) => m.fixtureId);
const { data: figees } = await sb
  .from('predictions_match')
  .select('fixture_id, domicile_nom, buts_domicile, buts_exterieur')
  .in('fixture_id', ids);

const parFixture = new Map((figees ?? []).map((p) => [p.fixture_id, p]));

// ── 4. Le résultat réel, chez le fournisseur ────────────────────────────────
//
// Vingt identifiants par appel : le quota quotidien est de 7 500, et l'épuiser
// coupe TOUTES les analyses pour tout le monde jusqu'au lendemain.
const fiches = new Map();
for (let i = 0; i < ids.length; i += 20) {
  const lot = ids.slice(i, i + 20).join('-');
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${lot}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
  });
  const j = await r.json();
  for (const f of j?.response ?? []) fiches.set(f.fixture.id, f);
  process.stdout.write(`\r  fiches lues : ${fiches.size}/${ids.length}`);
}
console.log();

// ── 5. L'état du mur ────────────────────────────────────────────────────────
const { data: preuves } = await sb
  .from('preuves')
  .select('fixture_id, publiee, issue_correcte, prono_score, score_reel, mise_en_avant')
  .in('fixture_id', ids);
const parPreuve = new Map((preuves ?? []).map((p) => [p.fixture_id, p]));

// ── 6. Le verdict, rencontre par rencontre ──────────────────────────────────
const TERMINES = new Set(['FT', 'AET', 'PEN']);
const lignes = [];

for (const m of parMatch.values()) {
  const f = fiches.get(m.fixtureId);
  const statut = f?.fixture?.status?.short ?? '?';
  if (!TERMINES.has(statut)) continue;            // seuls les matchs JOUÉS

  const domicile = f.teams.home.name;
  const exterieur = f.teams.away.name;
  const butsDom = f.goals.home;
  const butsExt = f.goals.away;

  // Le résultat, remis dans le sens de la carte — par les NUMÉROS d'équipe,
  // jamais par les noms. Voir le commentaire de `idDuLogo`.
  const carteDansLeSensDuTerrain = idDuLogo(m.logo1) === String(f.teams.home.id);
  const reel = carteDansLeSensDuTerrain ? [butsDom, butsExt] : [butsExt, butsDom];

  // Le pronostic : la prédiction de référence d'abord, le vote en repli.
  const figee = parFixture.get(m.fixtureId);
  let prono = null;
  let origine = '';
  if (figee) {
    prono = memeEquipe(m.equipe1, figee.domicile_nom)
      ? [figee.buts_domicile, figee.buts_exterieur]
      : [figee.buts_exterieur, figee.buts_domicile];
    origine = 'référence';
  } else {
    const majoritaire = [...m.votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    prono = lireScore(majoritaire);
    origine = 'vote (pas de référence)';
  }

  const juste = !!prono && issue(prono[0], prono[1]) === issue(reel[0], reel[1]);
  const exact = juste && prono[0] === reel[0] && prono[1] === reel[1];
  const p = parPreuve.get(m.fixtureId);

  lignes.push({
    fixtureId: m.fixtureId,
    affiche: `${m.equipe1} — ${m.equipe2}`,
    competition: f.league?.name ?? m.competition ?? '—',
    dateMatch: f.fixture?.date ?? null,
    prono: prono ? `${prono[0]} - ${prono[1]}` : '—',
    pronoIssue: prono ? issue(prono[0], prono[1]) : null,
    reel: `${reel[0]} - ${reel[1]}`,
    reelIssue: issue(reel[0], reel[1]),
    juste, exact, origine,
    analyses: m.analyses,
    verifiee: m.verifiee,
    enBase: !!p,
    publiee: !!p?.publiee,
    miseEnAvant: !!p?.mise_en_avant,
    verdictEnBase: p ? !!p.issue_correcte : null,
  });
}

// ── 7. Le rapport ───────────────────────────────────────────────────────────
lignes.sort((a, b) => String(b.dateMatch).localeCompare(String(a.dateMatch)));

const nom = (l) =>
  l.pronoIssue === 'team1' ? l.affiche.split(' — ')[0]
  : l.pronoIssue === 'team2' ? l.affiche.split(' — ')[1]
  : 'Nul';
const nomReel = (l) =>
  l.reelIssue === 'team1' ? l.affiche.split(' — ')[0]
  : l.reelIssue === 'team2' ? l.affiche.split(' — ')[1]
  : 'Nul';

console.log('\n' + '='.repeat(100));
console.log(`MATCHS JOUÉS ET ANALYSÉS — ${JOURS} DERNIERS JOURS`);
console.log('='.repeat(100));

for (const l of lignes) {
  const jour = String(l.dateMatch ?? '').slice(0, 10);
  const verdict = l.juste ? (l.exact ? 'JUSTE + SCORE EXACT' : 'JUSTE') : 'RATÉ';
  const etat = !l.enBase ? 'ABSENT DU MUR'
    : l.publiee ? 'PUBLIÉ'
    : l.juste ? 'NON PUBLIÉ  <-- à corriger'
    : 'admin seulement';

  console.log(`\n${jour}  ${l.affiche}`);
  console.log(`   compétition : ${l.competition}`);
  console.log(`   pronostic   : ${l.prono}  (${nom(l)})   [${l.origine}, ${l.analyses} analyse(s)]`);
  console.log(`   résultat    : ${l.reel}  (${nomReel(l)})`);
  console.log(`   verdict     : ${verdict}`);
  console.log(`   mur public  : ${etat}${l.miseEnAvant ? '  [mis en avant]' : ''}`);
  if (l.enBase && l.verdictEnBase !== l.juste)
    console.log(`   /!\\ DÉSACCORD : la base dit ${l.verdictEnBase ? 'juste' : 'raté'}, le contrôle dit ${l.juste ? 'juste' : 'raté'}`);
  if (!l.verifiee) console.log(`   /!\\ jamais vérifiée automatiquement (verified_at vide)`);
}

const justes = lignes.filter((l) => l.juste);
const publies = justes.filter((l) => l.publiee);
const manquants = justes.filter((l) => !l.publiee);

// ── UN DÉSACCORD N'EST PAS FORCÉMENT UNE ERREUR DE L'APPLICATION ────────────
//
// Quand la rencontre n'a PAS de prédiction de référence, ce contrôle retombe
// sur le vote majoritaire des analyses. Or c'est précisément ce vote que la
// production a appris à ne plus suivre : il mélange les deux sens de saisie et
// intègre les analyses produites pendant les pannes connues.
//
// Vérifié sur pièces le 20 août 2026 : Alavés — Getafe et Santa Clara —
// Academico Viseu étaient signalés « publiés à tort » par ce script, et les
// deux étaient en réalité de vraies réussites. C'était le contrôle qui avait
// tort, pas le mur.
//
// Un désaccord sans prédiction de référence est donc rapporté à part, comme un
// point à regarder — jamais comme une faute constatée.
const fautifs = lignes.filter((l) => !l.juste && l.publiee && l.origine === 'référence');
const aRegarder = lignes.filter((l) => !l.juste && l.publiee && l.origine !== 'référence');

console.log('\n' + '='.repeat(100));
console.log(`Matchs joués et analysés : ${lignes.length}`);
console.log(`  réussites              : ${justes.length}  (dont ${justes.filter((l) => l.exact).length} score exact)`);
console.log(`  ratés                  : ${lignes.length - justes.length}`);
console.log(`  réussites EN LIGNE     : ${publies.length}`);
console.log(`  réussites MANQUANTES   : ${manquants.length}`);
console.log(`  ratés publiés à tort   : ${fautifs.length}`);
if (manquants.length) {
  console.log('\nRÉUSSITES ABSENTES DU MUR :');
  for (const l of manquants) console.log(`  - ${l.affiche}  ${l.prono} / ${l.reel}  (${l.enBase ? 'en base, non publiée' : 'absente de la table'})`);
}
if (fautifs.length) {
  console.log('\nRATÉS PUBLIÉS À TORT (prédiction de référence, désaccord certain) :');
  for (const l of fautifs) console.log(`  - ${l.affiche}  ${l.prono} / ${l.reel}`);
}
if (aRegarder.length) {
  console.log('\nÀ REGARDER (aucune prédiction de référence — le contrôle est le moins fiable des deux) :');
  for (const l of aRegarder)
    console.log(`  ? ${l.affiche}  contrôle: ${l.prono} / ${l.reel}  — vérifier la fiche avant toute conclusion`);
}
console.log('='.repeat(100) + '\n');
