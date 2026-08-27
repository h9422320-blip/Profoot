/**
 * ENQUÊTE — « l'application m'avait annoncé une victoire du Real Betis ».
 *
 * Diagnostic seul : rien n'est écrit, rien n'est publié.
 *
 * Le relevé du 25 août 2026 classe « Real Betis — Valencia CF » en RATÉ, avec
 * un pronostic « 0 - 1 » face à un résultat réel « 1 - 0 ». Le propriétaire se
 * souvient d'une analyse annonçant Betis vainqueur. Les deux ne peuvent pas
 * être vrais en même temps.
 *
 * On sort donc TOUT ce que la base contient sur cette rencontre : chaque
 * analyse dans son ordre d'origine, la prédiction figée, et le sens dans lequel
 * le mur la relit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { pronoDansLeSensDeLaCarte } = await jiti.import('./src/lib/preuves.ts');
const { lirePredictionBrute } = await jiti.import('./src/lib/prediction-figee.ts');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const K = process.env.API_FOOTBALL_KEY;
const api = async (u) => {
  const r = await fetch('https://v3.football.api-sports.io' + u, { headers: { 'x-apisports-key': K } });
  return r.json();
};

const MOTIF = process.argv[2] ?? 'betis';

// ── Toutes les analyses citant l'équipe, dans les deux sens ──────────────
const { data, error } = await sb
  .from('analysis_history')
  .select(
    'id, user_id, fixture_id, team1_name, team2_name, competition, score, predicted_winner, ' +
      'real_score, real_winner, winner_correct, score_correct, confidence, created_at, verified_at'
  )
  .or(`team1_name.ilike.%${MOTIF}%,team2_name.ilike.%${MOTIF}%`)
  .order('created_at', { ascending: true });

if (error) {
  console.log('  erreur : ' + error.message);
  process.exit(1);
}

console.log(`\n  ${data.length} analyse(s) citant « ${MOTIF} ».\n`);

// ── On se concentre sur les rencontres jouées, par identifiant ───────────
const parFixture = new Map();
for (const a of data) {
  const cle = String(a.fixture_id ?? `sans-id:${a.team1_name}|${a.team2_name}`);
  if (!parFixture.has(cle)) parFixture.set(cle, []);
  parFixture.get(cle).push(a);
}

const mot = (v) =>
  v === 'team1' ? 'victoire equipe 1' : v === 'team2' ? 'victoire equipe 2' : v === 'draw' ? 'nul' : '?';

for (const [cle, lignes] of parFixture) {
  const id = Number(cle);
  let fiche = null;
  if (Number.isFinite(id)) {
    const r = await api(`/fixtures?id=${id}`);
    const f = r?.response?.[0];
    if (f)
      fiche = {
        date: String(f.fixture.date).slice(0, 10),
        statut: f.fixture?.status?.short,
        dom: f.teams?.home?.name,
        ext: f.teams?.away?.name,
        butsDom: f.goals?.home,
        butsExt: f.goals?.away,
        competition: f.league?.name,
      };
  }

  console.log('═'.repeat(78));
  console.log(`  rencontre ${cle}   ${fiche ? `— ${fiche.date} — ${fiche.competition}` : ''}`);
  if (fiche) {
    console.log(`  chez le fournisseur : ${fiche.dom} (domicile) reçoit ${fiche.ext}`);
    console.log(`  resultat reel ...... ${fiche.dom} ${fiche.butsDom} - ${fiche.butsExt} ${fiche.ext}  [${fiche.statut}]`);
  }

  const figee = Number.isFinite(id) ? await lirePredictionBrute(id) : null;
  if (figee) {
    console.log(
      `\n  PREDICTION FIGEE ... ${figee.domicileNom} ${figee.butsDomicile} - ${figee.butsExterieur} (exterieur)`
    );
  } else {
    console.log('\n  PREDICTION FIGEE ... aucune');
  }

  console.log(`\n  ${lignes.length} analyse(s) enregistree(s) :\n`);
  for (const a of lignes) {
    const sensCarte = figee ? pronoDansLeSensDeLaCarte(figee, a.team1_name) : null;
    console.log(
      `   ${String(a.created_at).slice(0, 16).replace('T', ' ')}  ` +
        `${String(a.team1_name).padEnd(20)} ${String(a.score ?? '—').padEnd(8)} ${String(a.team2_name).padEnd(20)}` +
        `  annonce=${mot(a.predicted_winner).padEnd(18)} reel=${String(a.real_score ?? '—').padEnd(8)}` +
        ` juste=${a.winner_correct === null ? '?' : a.winner_correct ? 'OUI' : 'non'}` +
        (sensCarte ? `  [figee vue de cette carte : ${sensCarte}]` : '')
    );
  }
  console.log('');
}
