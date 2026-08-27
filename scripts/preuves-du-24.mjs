/**
 * LES PRONOSTICS DU 24 AOÛT, CONFRONTÉS AUX RÉSULTATS RÉELS.
 *
 * Diagnostic seul : rien n'est écrit, rien n'est publié.
 *
 * ── POURQUOI LA DATE VIENT DU FOURNISSEUR, PAS DE NOTRE BASE ──────────────
 *
 * `analysis_data.date` est une chaîne française — « 23 août 2026 » — que rien
 * ne sait comparer, et elle est absente de la majorité des analyses. La date
 * de création de l'analyse ne vaut pas non plus : on analyse un match plusieurs
 * jours à l'avance.
 *
 * La seule date fiable est celle de la fiche du match, lue par son identifiant.
 */
import fs from 'node:fs';
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
const K = process.env.API_FOOTBALL_KEY;
const api = async (u) => {
  const r = await fetch('https://v3.football.api-sports.io' + u, { headers: { 'x-apisports-key': K } });
  return r.json();
};

const JOUR = process.argv[2] ?? '2026-08-24';

// ── Toutes les analyses vérifiées portant un identifiant de rencontre ─────
const analyses = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb
    .from('analysis_history')
    .select(
      'fixture_id, team1_name, team2_name, competition, score, real_score, real_winner, ' +
      'predicted_winner, winner_correct, score_correct, confidence, created_at, verified_at'
    )
    .not('fixture_id', 'is', null)
    .order('created_at', { ascending: true })
    .range(de, de + 999);
  if (error) { console.log('  erreur : ' + error.message); break; }
  if (!data?.length) break;
  analyses.push(...data);
  if (data.length < 1000) break;
}

// Une rencontre, une observation : la PREMIÈRE analyse fait foi, c'est elle
// qui a été produite sans rien savoir. Les suivantes relisent une prédiction
// déjà figée.
const parFixture = new Map();
for (const a of analyses) {
  const id = String(a.fixture_id);
  if (!parFixture.has(id)) parFixture.set(id, { premiere: a, analyses: 0 });
  parFixture.get(id).analyses++;
}

console.log(`\n  ${analyses.length} analyses lues, portant sur ${parFixture.size} rencontres distinctes.`);

// ── La vraie date de chaque rencontre, chez le fournisseur ────────────────
const ids = [...parFixture.keys()];
const fiches = new Map();
for (let i = 0; i < ids.length; i += 20) {
  const paquet = ids.slice(i, i + 20);
  const r = await api(`/fixtures?ids=${paquet.join('-')}`);
  for (const f of r?.response ?? []) {
    fiches.set(String(f.fixture.id), {
      date: String(f.fixture.date).slice(0, 10),
      statut: String(f.fixture?.status?.short ?? ''),
      dom: f.teams?.home?.name,
      ext: f.teams?.away?.name,
      butsDom: f.goals?.home,
      butsExt: f.goals?.away,
      competition: f.league?.name,
    });
  }
  process.stdout.write(`\r  fiches lues : ${fiches.size} / ${ids.length}`);
}
console.log('');

// ── On garde les rencontres jouées CE JOUR-LÀ, et terminées ──────────────
const TERMINES = new Set(['FT', 'AET', 'PEN']);
const duJour = [];
for (const [id, e] of parFixture) {
  const f = fiches.get(id);
  if (!f || f.date !== JOUR) continue;
  duJour.push({ id, ...e, fiche: f });
}

const termines = duJour.filter((m) => TERMINES.has(m.fiche.statut));
const verifies = termines.filter((m) => m.premiere.real_winner && m.premiere.winner_correct !== null);
const reussis = verifies.filter((m) => m.premiere.winner_correct === true);

console.log(`\n${'═'.repeat(74)}`);
console.log(`  LE ${JOUR} — CE QUE L APPLICATION AVAIT ANNONCÉ`);
console.log('═'.repeat(74) + '\n');
console.log(`  Rencontres analysées jouées ce jour-là ..... ${duJour.length}`);
console.log(`  dont terminées ............................ ${termines.length}`);
console.log(`  dont vérifiées (résultat confronté) ....... ${verifies.length}`);
console.log(`  RÉUSSIES .................................. ${reussis.length}`);
if (verifies.length) {
  console.log(`\n  Taux de réussite du jour : ${Math.round((reussis.length / verifies.length) * 1000) / 10} %`);
}

const nonVerifies = termines.length - verifies.length;
if (nonVerifies > 0) {
  console.log(`\n  (${nonVerifies} rencontre(s) terminée(s) mais pas encore confrontée(s) au résultat.`);
  console.log('   Elles ne sont PAS comptées : sans vérification, on ne sait pas.)');
}

const issue = (v) => (v === 'team1' ? 'victoire 1' : v === 'team2' ? 'victoire 2' : v === 'draw' ? 'match nul' : '?');

if (reussis.length) {
  console.log(`\n${'═'.repeat(74)}`);
  console.log('  LES RÉUSSITES, UNE PAR UNE');
  console.log('═'.repeat(74) + '\n');
  for (const m of reussis.sort((a, b) => (b.premiere.confidence ?? 0) - (a.premiere.confidence ?? 0))) {
    const p = m.premiere;
    console.log(`  ${p.team1_name} — ${p.team2_name}`);
    console.log(`     competition ...... ${p.competition ?? m.fiche.competition ?? '—'}`);
    console.log(`     pronostic ........ ${String(p.score ?? '—').padEnd(9)} (${issue(p.predicted_winner)})`);
    console.log(`     score reel ....... ${p.real_score ?? '—'}  →  ${issue(p.real_winner)}`);
    console.log(`     score exact ...... ${p.score_correct ? 'OUI' : 'non'}`);
    console.log(`     confiance ........ ${p.confidence ?? '—'} %`);
    console.log(`     analysée le ...... ${String(p.created_at).slice(0, 16).replace('T', ' à ')}  (${m.analyses} fois)`);
    console.log('');
  }
}

const rates = verifies.filter((m) => m.premiere.winner_correct === false);
if (rates.length) {
  console.log(`${'═'.repeat(74)}`);
  console.log(`  LES ${rates.length} RATÉS DU MÊME JOUR — pour que le compte soit honnête`);
  console.log('═'.repeat(74) + '\n');
  for (const m of rates) {
    const p = m.premiere;
    console.log(
      `  ${(p.team1_name + ' — ' + p.team2_name).padEnd(42)} annonce ${String(p.score ?? '—').padEnd(8)} · reel ${p.real_score ?? '—'}`
    );
  }
  console.log('');
}
