/**
 * RATTRAPER L'ARRIÉRÉ DE VÉRIFICATION.
 *
 * POURQUOI LA TÂCHE QUOTIDIENNE N'Y ARRIVE PAS
 *
 * Elle examine les trois cents analyses LES PLUS RÉCENTES. C'est le bon choix
 * en régime normal : ce sont les matchs du jour qui intéressent. Mais après
 * trois jours d'analyses non vérifiables — l'identifiant de rencontre ne leur
 * était plus attribué —, deux mille quatre cents lignes attendent. Les trois
 * cents plus récentes portent toutes sur des rencontres à venir : la tâche
 * examine, ne trouve aucun match terminé, et repart. L'arriéré ne bouge jamais.
 *
 * CE QUE FAIT CE SCRIPT
 *
 * Il part de l'identifiant de rencontre, restauré par `rattraper-identifiants`,
 * au lieu de rechercher le match par ses équipes et sa date. C'est plus sûr et
 * bien moins coûteux : une seule interrogation pour vingt rencontres, quel que
 * soit le nombre d'analyses qui les concernent.
 *
 * Seules les rencontres RÉELLEMENT terminées sont jugées. Une rencontre à
 * venir, reportée ou en cours reste en attente — elle sera vue demain.
 *
 * LE SENS DE LECTURE
 *
 * Chaque analyse nomme ses équipes dans l'ordre choisi par l'utilisateur. Le
 * résultat est donc remis dans le sens de CHAQUE ligne avant comparaison. Sans
 * ce redressement, une analyse saisie « Elche — Barcelone » verrait le score de
 * « Barcelone — Elche » et serait comptée fausse alors qu'elle avait raison.
 *
 * SIMULATION PAR DÉFAUT. Écrit seulement avec `--ecrire`.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const ECRIRE = process.argv.includes('--ecrire');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const idDuLogo = (url) => {
  const m = String(url ?? '').match(/teams\/(\d+)\.png/);
  return m ? m[1] : null;
};
const lireScore = (s) => {
  const m = String(s ?? '').match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const issue = (a, b) => (a > b ? 'team1' : b > a ? 'team2' : 'draw');

// ── Les analyses en attente qui portent un identifiant ──────────────────────
const enAttente = [];
for (let page = 0; page < 20; page++) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('id, fixture_id, team1_name, team2_name, team1_logo, team2_logo, score, predicted_winner, created_at')
    .is('verified_at', null)
    .not('fixture_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(page * 1000, page * 1000 + 999);
  if (error) { console.error(error.message); process.exit(1); }
  enAttente.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`Analyses en attente avec identifiant : ${enAttente.length}`);

const fixtures = [...new Set(enAttente.map((a) => a.fixture_id))];
console.log(`Rencontres distinctes                : ${fixtures.length}`);

// ── Les fiches, vingt par appel ─────────────────────────────────────────────
const fiches = new Map();
for (let i = 0; i < fixtures.length; i += 20) {
  const lot = fixtures.slice(i, i + 20).join('-');
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${lot}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
  });
  const j = await r.json();
  for (const f of j?.response ?? []) fiches.set(f.fixture.id, f);
  process.stdout.write(`\r  fiches lues : ${fiches.size}/${fixtures.length}`);
}
console.log();

const TERMINES = new Set(['FT', 'AET', 'PEN']);
const termines = [...fiches.values()].filter((f) => TERMINES.has(f.fixture?.status?.short));
console.log(`Rencontres terminées                 : ${termines.length}`);

// ── Le verdict, analyse par analyse ─────────────────────────────────────────
let jugees = 0, justes = 0, exacts = 0, ignorees = 0;
const parMatch = new Map();
const majEcrites = [];

for (const a of enAttente) {
  const f = fiches.get(a.fixture_id);
  if (!f || !TERMINES.has(f.fixture?.status?.short)) { ignorees++; continue; }

  const prono = lireScore(a.score);
  if (!prono) { ignorees++; continue; }

  // Le résultat, remis dans le sens de CETTE analyse.
  const idDom = String(f.teams.home.id);
  const equipe1EstDomicile = idDuLogo(a.team1_logo) === idDom;
  const buts1 = equipe1EstDomicile ? f.goals.home : f.goals.away;
  const buts2 = equipe1EstDomicile ? f.goals.away : f.goals.home;

  const issueReelle = issue(buts1, buts2);
  // L'issue figée AVANT le match prime : c'est elle qui prouve l'antériorité.
  const issueAnnoncee = a.predicted_winner ?? issue(prono[0], prono[1]);
  const bonVainqueur = issueAnnoncee === issueReelle;
  const bonScore = prono[0] === buts1 && prono[1] === buts2;

  jugees++;
  if (bonVainqueur) justes++;
  if (bonScore) exacts++;

  majEcrites.push({
    id: a.id,
    real_score: `${buts1} - ${buts2}`,
    real_winner: issueReelle,
    predicted_winner: issueAnnoncee,
    winner_correct: bonVainqueur,
    score_correct: bonScore,
    verified_at: new Date().toISOString(),
    is_finished: true,
  });

  if (!parMatch.has(a.fixture_id))
    parMatch.set(a.fixture_id, {
      affiche: `${f.teams.home.name} — ${f.teams.away.name}`,
      competition: f.league?.name,
      date: f.fixture?.date,
      reel: `${f.goals.home} - ${f.goals.away}`,
      analyses: 0,
      justes: 0,
    });
  const m = parMatch.get(a.fixture_id);
  m.analyses++;
  if (bonVainqueur) m.justes++;
}

console.log(`\nAnalyses jugeables  : ${jugees}`);
console.log(`  vainqueur juste   : ${justes}`);
console.log(`  score exact       : ${exacts}`);
console.log(`  laissées en attente : ${ignorees}  (rencontre non terminée)`);
console.log(`\nRencontres jugées   : ${parMatch.size}`);

if (!ECRIRE) {
  console.log('\n[SIMULATION] Rien écrit. Relancer avec --ecrire.\n');
  process.exit(0);
}

console.log('\nÉcriture…');
let ok = 0, ko = 0;
for (const u of majEcrites) {
  const { id, ...valeurs } = u;
  const { error } = await sb.from('analysis_history').update(valeurs).eq('id', id);
  if (error) { ko++; if (ko < 4) console.warn('  ' + error.message); } else ok++;
  if (ok % 100 === 0) process.stdout.write(`\r  ${ok} écrite(s)`);
}
console.log(`\n\nVérifiées : ${ok}   échecs : ${ko}\n`);
